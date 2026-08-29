import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Logger,
  Post,
  Res,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProduces,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import type { Response } from "express";
import {
  convertToModelMessages,
  isStepCount,
  pipeUIMessageStreamToResponse,
  streamText,
  toUIMessageStream,
  validateUIMessages,
  type UIMessage,
} from "ai";
import { chatRequestSchema, type ChatRequestInput } from "@mindmap/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ConversationsService } from "../conversations/conversations.service";
import { AiService } from "./ai.service";
import { ChatRequestDto } from "./chat.dto";
import { MindmapToolsService } from "./mindmap-tools.service";

/** Tool loops stop after this many model round trips per user message. */
const MAX_STEPS = 12;

@ApiTags("chat")
@Controller("api/chat")
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    @Inject(AiService) private readonly ai: AiService,
    @Inject(MindmapToolsService) private readonly tools: MindmapToolsService,
    @Inject(ConversationsService)
    private readonly conversations: ConversationsService,
  ) {}

  /**
   * Streams a `useChat`-compatible UI message stream and persists the turn
   * into the caller's conversation. This route bypasses the typed
   * openapi-fetch client on the web side — SSE doesn't fit a generated JSON
   * contract — so it is documented here for Swagger completeness and consumed
   * through the AI SDK's own transport.
   */
  @Post()
  @ApiBody({ type: ChatRequestDto })
  @ApiProduces("text/event-stream")
  @ApiOkResponse({
    description:
      "AI SDK UI message event stream (SSE). Assistant text and mindmap tool calls arrive as streamed message parts.",
    schema: { type: "string" },
  })
  @ApiBadRequestResponse({ description: "Body failed validation" })
  @ApiNotFoundResponse({
    description: "No conversation with that id belongs to the caller",
  })
  @ApiServiceUnavailableResponse({
    description: "LLM_GATEWAY_API_KEY is not configured on the server",
  })
  async chat(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequestInput,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.ai.isReady()) {
      throw new ServiceUnavailableException(
        "AI chat is not configured: set LLM_GATEWAY_API_KEY in apps/api/.env",
      );
    }

    // The zod schema only vouched for the envelope; the SDK validates the
    // message parts it will actually interpret.
    let messages: UIMessage[];
    try {
      messages = await validateUIMessages({
        messages: body.messages as unknown as UIMessage[],
      });
    } catch {
      throw new BadRequestException("messages is not a valid UIMessage array");
    }

    const ownerId = session.user.id;
    const conversationId = body.conversationId;

    // Ownership is checked before a single token is spent, and the user's
    // message is banked before the model runs: a failed or abandoned
    // generation still leaves the question in the history rather than
    // swallowing it.
    await this.conversations.findOne(ownerId, conversationId);
    await this.conversations.replaceMessages(
      ownerId,
      conversationId,
      body.messages,
    );

    const result = streamText({
      model: this.ai.chatModel(),
      system: systemPrompt(body.mindmapId),
      messages: await convertToModelMessages(messages),
      tools: this.tools.forOwner(ownerId),
      stopWhen: isStepCount(MAX_STEPS),
    });

    await pipeUIMessageStreamToResponse({
      response: res,
      stream: toUIMessageStream({
        stream: result.stream,
        originalMessages: messages,
        // Surface the real message instead of the SDK's generic redaction —
        // this is a first-party app talking to its own API.
        onError: (error) =>
          error instanceof Error ? error.message : String(error),
        // Whatever the stream produced — a full answer, a half-finished one
        // the user stopped, or an error mid-way — is what the conversation
        // now contains. The response has already been sent by the time this
        // runs, so a failed write is logged rather than thrown: it would have
        // nowhere to go but a stream the client has finished reading.
        onEnd: async ({ messages: turn }) => {
          try {
            await this.conversations.replaceMessages(
              ownerId,
              conversationId,
              turn as unknown as Record<string, unknown>[],
            );
          } catch (error) {
            this.logger.error(
              `Could not persist conversation ${conversationId}`,
              error,
            );
          }
        },
      }),
    });
  }
}

/**
 * The assistant is scoped to the user's whole library, not to one open map:
 * its tools list, create, rename, and delete mindmaps as well as edit the
 * topics inside them, and the panel it answers in is app chrome rather than
 * part of the canvas. The open mindmap is context for resolving "this one",
 * nothing more.
 */
function systemPrompt(mindmapId: string | null | undefined): string {
  return [
    "You are the assistant inside a mindmap app. You are how the user manages their whole library by talking: create, rename, reorganize, and delete mindmaps, and edit the topics inside any of them. Every change you make shows up immediately — in the user's library list, and on the canvas if that mindmap is open.",
    "",
    "Rules of the data model:",
    '- A mindmap is a tree of topics. Every mindmap has a root topic with id "root" whose title mirrors the mindmap title; the root can be renamed but never deleted or moved.',
    "- Topics are connected parent → child. No loops, no duplicate connections, at most 500 topics and 1000 connections per mindmap.",
    "- Topic ids are shown in [brackets] in outlines from read_mindmap; always use those exact ids when editing.",
    "- Every topic can carry one note: markdown prose hanging off the title, which the user reads and edits in a panel beside the canvas. An outline marks a topic that has one with a trailing (note).",
    "",
    "How to work:",
    "- When the user names a mindmap you have not seen yet, call list_mindmaps to turn that name into an id rather than guessing one.",
    "- Before editing an existing mindmap, call read_mindmap first so you edit the current state, not a remembered one.",
    "- Prefer one tool call that does the whole job (add_topics takes a nested tree) over many small calls.",
    "- When generating content, keep topic titles short — a few words, like nodes on a whiteboard, not sentences. Detail belongs in a topic's note, not in its title.",
    "- set_topic_note replaces a note outright, so read_topic_note first whenever you mean to add to one. Keep notes to a few short paragraphs or a list — headings, bold, lists, links and code fences all render.",
    "- If a tool returns an error with issues, fix your edit and retry; don't ask the user to do it.",
    "- delete_mindmap is irreversible: ask the user to confirm and only call it after they have clearly said yes in this conversation. Deleting topics inside a map needs no confirmation.",
    "- After editing, answer with one short sentence about what changed. The user sees the result in the app — don't repeat the whole outline in text.",
    "",
    mindmapId
      ? `The user currently has the mindmap with id "${mindmapId}" open on their canvas. When they say "this mindmap", "here", or just ask for topics without naming a map, they mean this one. They can still ask about any other mindmap they own.`
      : "The user has no mindmap open right now. If they ask for edits without naming a map, either create a new mindmap or use list_mindmaps to find the one they mean.",
  ].join("\n");
}
