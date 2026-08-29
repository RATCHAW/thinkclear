/**
 * The workspace's addressable state, and the grammar that writes it as a URL.
 *
 * Everything the user can be *in* — the mindmap on the canvas, the chat the
 * assistant is holding, which floating surface is showing — is described here
 * rather than kept in a client-side store, so a workspace can be linked to,
 * reloaded into, and backed out of with the browser's own Back button. It also
 * means anything that can only write a URL can drive the app: the grammar
 * below is the whole navigation surface, deliberately guessable.
 *
 *   /                    nothing open
 *   /mindmaps/<id>       that mindmap on the canvas
 *   ?library             the library sheet is open
 *   ?assistant           the assistant is open, showing the chat
 *   ?assistant=history   …showing chat history over the chat instead
 *   ?chat=<id>           the conversation the assistant holds, whether or not
 *                        the panel is open
 *
 * Reading is lenient and writing is canonical: an unknown path or a stray
 * parameter reads as "not open" rather than as an error, and the next
 * navigation rewrites the URL in exactly the form above.
 */
export interface WorkspaceRoute {
  /** The mindmap on the canvas, or `null` for the empty state. */
  mindmapId: string | null;
  /** The conversation the assistant shows. `null` is a new, unsaved chat. */
  conversationId: string | null;
  libraryOpen: boolean;
  assistantOpen: boolean;
  /** Whether the assistant is showing chat history instead of the chat. */
  historyOpen: boolean;
}

const MINDMAPS_SEGMENT = "mindmaps";

export function parseWorkspaceRoute(url: string): WorkspaceRoute {
  // A relative URL is what `location.pathname + location.search` gives; the
  // base only exists to satisfy the parser and never survives it.
  const { pathname, searchParams } = new URL(url, "http://workspace.invalid");
  const [collection, id] = pathname.split("/").filter(Boolean);
  const assistant = searchParams.get("assistant");

  return {
    mindmapId:
      collection === MINDMAPS_SEGMENT && id ? decodeURIComponent(id) : null,
    conversationId: searchParams.get("chat") || null,
    libraryOpen: searchParams.has("library"),
    assistantOpen: assistant !== null,
    historyOpen: assistant === "history",
  };
}

export function workspaceRouteUrl(route: WorkspaceRoute): string {
  const path = route.mindmapId
    ? `/${MINDMAPS_SEGMENT}/${encodeURIComponent(route.mindmapId)}`
    : "/";

  // Assembled by hand rather than through URLSearchParams so the flags stay
  // bare — `?library`, not `?library=` — since these URLs are meant to be read
  // and typed. Writing history only alongside the panel is also what keeps
  // "history showing over a closed assistant" unrepresentable: every
  // navigation round-trips through this grammar, so the state can't drift into
  // a combination the URL has no way to say.
  const query: string[] = [];
  if (route.libraryOpen) query.push("library");
  if (route.assistantOpen) {
    query.push(route.historyOpen ? "assistant=history" : "assistant");
  }
  if (route.conversationId) {
    query.push(`chat=${encodeURIComponent(route.conversationId)}`);
  }

  return query.length > 0 ? `${path}?${query.join("&")}` : path;
}
