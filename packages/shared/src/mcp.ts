import { MUTATING_CHAT_TOOLS } from "./chat";

/**
 * The MCP surface: what an outside agent client (Claude Code, Cursor, an
 * in-house agent) is allowed to ask this app to do, and under which OAuth
 * scope.
 *
 * The server exposes the *same* tools the built-in assistant calls — one
 * definition in `MindmapToolsService`, two transports — so anything the chat
 * panel can do to a mindmap, a connected agent can do too. What differs is the
 * authorization: the chat panel rides the user's session cookie and gets
 * everything, while an MCP client holds an access token that was granted
 * specific scopes on a consent screen, and only the tools those scopes cover
 * are registered on its server instance.
 */

/**
 * Scopes bound to the MCP resource itself. They are deliberately coarse — a
 * mindmap is a small enough thing that per-tool scopes would be consent-screen
 * noise — but the read/write split is the one that matters: a client that only
 * needs to summarize the user's library never gets the ability to delete it.
 */
export const MCP_SCOPES = ["mindmaps:read", "mindmaps:write"] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

/**
 * Human-readable purpose per scope, shown on the consent screen. It lives here
 * rather than in the web app so the wording is checked against the same list
 * the server enforces.
 */
export const MCP_SCOPE_DESCRIPTIONS: Record<McpScope, string> = {
  "mindmaps:read": "Read your mindmaps and the topics inside them",
  "mindmaps:write":
    "Create, rename, reorganize, and delete your mindmaps and topics",
};

/**
 * The scope a tool needs. Derived from `MUTATING_CHAT_TOOLS` — the list that
 * already says which tools write — so a new write tool cannot be added to the
 * assistant and silently end up callable with a read-only token.
 */
export function mcpScopeForTool(toolName: string): McpScope {
  return (MUTATING_CHAT_TOOLS as readonly string[]).includes(toolName)
    ? "mindmaps:write"
    : "mindmaps:read";
}

/**
 * Tools that can destroy work the user wrote by hand. MCP clients surface
 * `destructiveHint` in their own confirmation prompts, which is the only place
 * a human sees the warning — there is no chat transcript to ask "are you sure?"
 * in.
 *
 * The line is "content that cannot be typed back", not the spec's broader
 * additive/non-additive split: flagging every update would put a confirmation
 * in front of renaming a topic and teach people to click through them.
 * `set_topic_note` is on the list for the same reason the deletes are — it
 * replaces a note wholesale, so an agent extending one without reading it
 * first silently loses however many paragraphs were there.
 */
const DESTRUCTIVE_TOOLS: readonly string[] = [
  "delete_mindmap",
  "delete_topics",
  "set_topic_note",
];

export function isDestructiveMcpTool(toolName: string): boolean {
  return DESTRUCTIVE_TOOLS.includes(toolName);
}

/** Whether a granted scope set covers a tool. */
export function isToolGranted(
  toolName: string,
  grantedScopes: Iterable<string>,
): boolean {
  const required: string = mcpScopeForTool(toolName);
  for (const scope of grantedScopes) {
    if (scope === required) return true;
  }
  return false;
}

/**
 * Parses the space-delimited `scope` claim of an OAuth access token. Anything
 * unparseable reads as "no scopes", which registers no tools rather than
 * failing open.
 */
export function parseScopeClaim(scope: unknown): string[] {
  return typeof scope === "string" ? scope.split(" ").filter(Boolean) : [];
}
