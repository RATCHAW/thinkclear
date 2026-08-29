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
 *   ?account             account settings, on the first section
 *   ?account=mcp         …on that section instead
 *   ?note=<id>,<id>      those topics' notes are open, front-most last
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
  /**
   * The section of account settings on screen, or `null` when settings are
   * closed. One field rather than an open flag beside a section, because there
   * is no such thing as settings open on no section — and because the list
   * below is expected to grow, and a grammar that grows by one entry is
   * cheaper than one that grows by one flag.
   */
  accountSection: AccountSection | null;
  /**
   * The topics whose notes are open, as windows over the canvas — **front-most
   * last**, so this is the stacking order as well as the guest list. Notes are
   * read side by side, so opening one never closes another.
   *
   * A note belongs to a topic of the open mindmap, which the grammar below
   * enforces rather than leaving as a fact every caller has to remember. Where
   * each window *sits* and how big it is are deliberately not here: those are
   * transient chrome, not somewhere the user can be. Which window is in front
   * is the borderline case, and it is here because it is the difference
   * between a link that restores the arrangement you shared and one that
   * restores a pile in a random order.
   */
  noteNodeIds: string[];
}

/**
 * The sections of account settings, in the order they are listed.
 *
 * The first one is the default: `?account` means "settings, wherever they
 * open", and only a section that is not the default is named in the URL. That
 * keeps the common link short and stops the parameter from encoding a choice
 * nobody made.
 */
export const ACCOUNT_SECTIONS = ["profile", "sign-in", "mcp"] as const;

export type AccountSection = (typeof ACCOUNT_SECTIONS)[number];

export const DEFAULT_ACCOUNT_SECTION: AccountSection = ACCOUNT_SECTIONS[0];

const MINDMAPS_SEGMENT = "mindmaps";

export function parseWorkspaceRoute(url: string): WorkspaceRoute {
  // A relative URL is what `location.pathname + location.search` gives; the
  // base only exists to satisfy the parser and never survives it.
  const { pathname, search, searchParams } = new URL(
    url,
    "http://workspace.invalid",
  );
  const [collection, id] = pathname.split("/").filter(Boolean);
  const assistant = searchParams.get("assistant");
  const account = searchParams.get("account");
  const mindmapId =
    collection === MINDMAPS_SEGMENT && id ? decodeURIComponent(id) : null;

  return {
    mindmapId,
    conversationId: searchParams.get("chat") || null,
    libraryOpen: searchParams.has("library"),
    assistantOpen: assistant !== null,
    historyOpen: assistant === "history",
    // A section this build doesn't have — an older link, a typo — opens
    // settings on the default one rather than on nothing. The parameter says
    // "the user is in settings"; which pane they land on is the lenient part.
    accountSection: account === null ? null : accountSection(account),
    // Resolved the same way the serializer writes it, so a hand-typed URL
    // asking for notes with no map under them lands somewhere definite instead
    // of on a state the app can't render. Duplicates collapse: a topic's note
    // is one window, and asking for it twice cannot make it two.
    noteNodeIds: mindmapId ? noteIds(rawParam(search, "note")) : [],
  };
}

/**
 * The still-escaped value of a query parameter.
 *
 * `URLSearchParams` decodes on the way out, which for a list is too early: an
 * id escaped to `%2C` would come back a comma and split itself in two. Reading
 * it raw is what lets the separator mean only what the serializer meant by it.
 */
function rawParam(search: string, name: string): string | null {
  for (const pair of search.replace(/^\?/, "").split("&")) {
    const equals = pair.indexOf("=");
    if (equals !== -1 && pair.slice(0, equals) === name) {
      return pair.slice(equals + 1);
    }
  }
  return null;
}

function accountSection(value: string): AccountSection {
  return (ACCOUNT_SECTIONS as readonly string[]).includes(value)
    ? (value as AccountSection)
    : DEFAULT_ACCOUNT_SECTION;
}

function noteIds(value: string | null): string[] {
  if (!value) return [];
  const ids = new Set<string>();
  for (const part of value.split(",")) {
    const id = safeDecode(part).trim();
    if (id) ids.add(id);
  }
  return [...ids];
}

/** A hand-typed URL can carry a stray `%`; that reads as text, not an error. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
  // a combination the URL has no way to say. Notes are bound the same way to
  // the map they hang off — the ids name topics of that map, so closing the
  // canvas puts every note away without anything having to remember to. They
  // do *not* fight the assistant for room: a note is a window over the canvas,
  // not a second panel, so any number of them coexist with it.
  //
  // Comma-separated rather than repeated, because these URLs are meant to be
  // read: `?note=root,backend` says "two notes, backend in front" at a glance.
  // Each id is escaped first, so a comma inside one can't split it in two.
  const query: string[] = [];
  if (route.libraryOpen) query.push("library");
  if (route.assistantOpen) {
    query.push(route.historyOpen ? "assistant=history" : "assistant");
  }
  if (route.accountSection) {
    query.push(
      route.accountSection === DEFAULT_ACCOUNT_SECTION
        ? "account"
        : `account=${route.accountSection}`,
    );
  }
  if (route.noteNodeIds.length > 0 && route.mindmapId) {
    query.push(`note=${route.noteNodeIds.map(encodeURIComponent).join(",")}`);
  }
  if (route.conversationId) {
    query.push(`chat=${encodeURIComponent(route.conversationId)}`);
  }

  return query.length > 0 ? `${path}?${query.join("&")}` : path;
}
