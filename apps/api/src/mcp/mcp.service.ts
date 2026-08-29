import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from "@nestjs/common";
import {
  createMcpHandler,
  McpServer,
  type AuthInfo,
  type McpHttpHandler,
  type McpRequestContext,
  type StandardSchemaWithJSON,
} from "@modelcontextprotocol/server";
import type { Tool } from "ai";
import {
  isDestructiveMcpTool,
  isToolGranted,
  mcpScopeForTool,
  ROOT_NODE_ID,
} from "@mindmap/shared";
import { MindmapToolsService } from "../ai/mindmap-tools.service";

/** What the server calls itself in the `initialize` handshake. */
const SERVER_INFO = { name: "mindmap", version: "1.0.0" } as const;

/**
 * Serves the mindmap tools over MCP.
 *
 * The tool definitions are not restated here: `MindmapToolsService.forOwner()`
 * is the single source, and this service adapts that AI SDK tool set to MCP
 * registrations. That is what the tools service was built for — every call
 * still goes through `MindmapsService`, so an outside agent gets exactly the
 * ownership scoping and graph validation the HTTP routes and the chat panel
 * get, and a tool added for the assistant shows up here for free.
 *
 * Serving is per-request and stateless: `createMcpHandler` builds a fresh
 * `McpServer` for every HTTP request from the factory below. That is what lets
 * the *token* decide what the server looks like — the owner it acts for and
 * the scopes it was granted are read off the request's `authInfo`, so two
 * clients hitting the same endpoint see two different tool lists and can never
 * see each other's data.
 */
@Injectable()
export class McpService implements OnModuleDestroy {
  private readonly logger = new Logger(McpService.name);

  private readonly handler: McpHttpHandler = createMcpHandler(
    (context) => this.serverFor(context),
    {
      // `stateless` (the default) keeps the 2025-era protocol served next to
      // the 2026-07-28 one from this same factory. Shipping clients — Claude
      // Code among them — still speak the older revision, and rejecting it
      // would mean an endpoint that validates but nothing can connect to.
      legacy: "stateless",
      onerror: (error) => this.logger.error("MCP request failed", error),
    },
  );

  constructor(
    @Inject(MindmapToolsService)
    private readonly tools: MindmapToolsService,
  ) {}

  /**
   * Serves one already-authenticated MCP request. The caller verified the
   * access token and passes what it proved; nothing here reads a header.
   */
  fetch(request: Request, authInfo: AuthInfo): Promise<Response> {
    return this.handler.fetch(request, { authInfo });
  }

  onModuleDestroy(): Promise<void> {
    return this.handler.close();
  }

  private serverFor({ authInfo }: McpRequestContext): McpServer {
    const ownerId = ownerFrom(authInfo);
    if (!ownerId) {
      // Unreachable through the controller, which only calls `fetch` with a
      // verified token. Throwing rather than serving an empty tool list keeps
      // a future caller from quietly getting an unowned server.
      throw new Error("MCP request reached the server without a verified user");
    }

    const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
    const granted = authInfo?.scopes ?? [];

    for (const [name, tool] of Object.entries(this.tools.forOwner(ownerId))) {
      // Scopes are enforced by *omission* rather than by refusing the call:
      // a read-only client's `tools/list` simply has no delete in it, so its
      // model never plans a call that was always going to be denied.
      if (isToolGranted(name, granted)) this.register(server, name, tool);
    }

    return server;
  }

  private register(server: McpServer, name: string, tool: Tool): void {
    const execute = tool.execute;
    if (!execute) return;

    server.registerTool(
      name,
      {
        // The AI SDK allows a description computed per call; ours are all
        // plain strings, and MCP advertises descriptions statically in
        // `tools/list`, so there is nothing to compute them from here.
        description:
          typeof tool.description === "string" ? tool.description : undefined,
        inputSchema: tool.inputSchema as StandardSchemaWithJSON,
        annotations: {
          readOnlyHint: mcpScopeForTool(name) === "mindmaps:read",
          destructiveHint: isDestructiveMcpTool(name),
          // Every tool acts on the user's own library and nothing else.
          openWorldHint: false,
        },
      },
      async (args: unknown) => {
        // The tools were written for the chat loop, where a failed edit comes
        // back as data the model can repair from rather than as a thrown
        // error. MCP has the same idea in `isError`, so the shape carries
        // over: the client's model sees the reason and can fix its own call.
        // The execution options belong to the chat loop — a tool call id to
        // correlate a streamed result with, the transcript so far, a context
        // object. None of the mindmap tools read them; they take the owner
        // from the closure `forOwner` put it in.
        const result = (await execute(args, {
          toolCallId: `mcp-${name}`,
          messages: [],
          context: undefined,
        })) as Record<string, unknown>;

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
          isError: typeof result?.error === "string",
        };
      },
    );
  }
}

/**
 * The user an access token acts for. Better Auth puts the user id in `sub`,
 * and the controller copies it onto `authInfo.extra` when it verifies the
 * token — `extra` being the SDK's own slot for "whatever the resource server
 * knows about this token".
 */
function ownerFrom(authInfo: AuthInfo | undefined): string | undefined {
  const userId = authInfo?.extra?.userId;
  return typeof userId === "string" && userId ? userId : undefined;
}

/**
 * Shown to the connecting agent once, at `initialize`. It carries the same
 * data-model rules the chat system prompt states, because the tools are the
 * same and an outside model has no other way to learn them — there is no
 * system prompt of ours in a client we do not own.
 */
const INSTRUCTIONS = [
  "Tools for reading and editing the signed-in user's mindmaps.",
  "",
  `A mindmap is a tree of topics. Every mindmap has a root topic with id "${ROOT_NODE_ID}" whose title mirrors the mindmap title; the root can be renamed but never deleted or moved.`,
  "Topics are connected parent → child. No loops, no duplicate connections, at most 500 topics and 1000 connections per mindmap.",
  "Topic ids appear in [brackets] in the outlines read_mindmap returns; use those exact ids when editing.",
  "",
  "Call list_mindmaps to turn a name the user said into an id, and read_mindmap before editing so you edit current state. Prefer one call that does the whole job — add_topics takes a nested tree. Keep topic titles short, a few words, like nodes on a whiteboard.",
  "A tool that returns an `error` with `issues` is telling you how to repair the edit; fix it and retry rather than asking the user.",
  "delete_mindmap is irreversible — confirm with the user before calling it.",
].join("\n");
