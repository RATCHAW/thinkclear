import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
  Res,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
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
import { AiService } from "./ai.service";
import { ChatRequestDto } from "./chat.dto";
import { MindmapToolsService } from "./mindmap-tools.service";

/** Tool loops stop after this many model round trips per user message. */
const MAX_STEPS = 12;

@ApiTags("chat")
@Controller("api/chat")
export class ChatController {
  constructor(
    @Inject(AiService) private readonly ai: AiService,
    @Inject(MindmapToolsService) private readonly tools: MindmapToolsService,
  ) {}

  /**
   * Streams a `useChat`-compatible UI message stream. This route bypasses the
   * typed openapi-fetch client on the web side — SSE doesn't fit a generated
   * JSON contract — so it is documented here for Swagger completeness and
   * consumed through the AI SDK's own transport.
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
  @ApiServiceUnavailableResponse({
    description: "ANTHROPIC_API_KEY is not configured on the server",
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

    const result = streamText({
      model: this.ai.chatModel(),
      system: systemPrompt(body.mindmapId),
      messages: await convertToModelMessages(messages),
      tools: this.tools.forOwner(session.user.id),
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
      }),
    });
  }
}

function systemPrompt(mindmapId: string | null | undefined): string {
  return [
    "You are the mindmap assistant inside a mindmap editor. You help the user build, edit, and organize mindmaps through your tools; the user sees the result live on their canvas.",
    "",
    "Rules of the data model:",
    '- A mindmap is a tree of topics. Every mindmap has a root topic with id "root" whose title mirrors the mindmap title; the root can be renamed but never deleted or moved.',
    "- Topics are connected parent → child. No loops, no duplicate connections, at most 500 topics and 1000 connections per mindmap.",
    "- Topic ids are shown in [brackets] in outlines from read_mindmap; always use those exact ids when editing.",
    "",
    "How to work:",
    "- Before editing an existing mindmap, call read_mindmap first so you edit the current state, not a remembered one.",
    "- Prefer one tool call that does the whole job (add_topics takes a nested tree) over many small calls.",
    "- When generating content, keep topic titles short — a few words, like nodes on a whiteboard, not sentences.",
    "- If a tool returns an error with issues, fix your edit and retry; don't ask the user to do it.",
    "- delete_mindmap is irreversible: ask the user to confirm and only call it after they have clearly said yes in this conversation. Deleting topics inside a map needs no confirmation.",
    "- After editing, answer with one short sentence about what changed. The user sees the mindmap update on the canvas — don't repeat the whole outline in text.",
    "",
    mindmapId
      ? `The user currently has the mindmap with id "${mindmapId}" open on their canvas. When they say "this mindmap", "here", or just ask for topics without naming a map, they mean this one.`
      : "The user has no mindmap open right now. If they ask for edits, either create a new mindmap or use list_mindmaps to find the one they mean.",
  ].join("\n");
}
