/**
 * The prose this site says more than once.
 *
 * Every one of these lists is read by at least two surfaces — a rendered
 * section, the JSON-LD, the markdown twin of the page, `llms.txt` — and the
 * only arrangement in which they cannot disagree is the one where there is a
 * single array and each surface derives its own shape from it. That is already
 * how the FAQ markup is built from the questions the FAQ renders; this file is
 * that idea with the rest of the repeated content moved into it.
 */

/**
 * The FAQ, rendered by `faq-section.tsx`, published as `FAQPage` markup, and
 * lifted whole into the markdown twin of the home page — which is the point of
 * it existing in a machine-readable form at all: the FAQ is where this page
 * answers the questions somebody actually types.
 */
export const FAQ_QUESTIONS = [
  {
    question: "Do I need an API key to connect an agent?",
    answer:
      "No, and its absence is the point rather than a missing step. The server registers your client itself and answers its first call with the challenge that starts the OAuth flow — the client opens a browser, you approve the scopes on a consent screen, and it holds a token it refreshes on its own. Nothing to paste, nothing to rotate.",
  },
  {
    question: "What happens on the canvas while an agent is editing?",
    answer:
      "It redraws. The editor tracks the version it drew from, and when the document comes back carrying an edit it did not make, it reseeds and drops whatever save it had pending — so an edit made from your terminal cannot be quietly overwritten by the autosave of a stale local graph.",
  },
  {
    question: "Which model does the assistant use?",
    answer:
      "Whichever one the deployment points at. Models are reached through LLM Gateway and named vendor/model, so a self-hosted instance sets AI_CHAT_MODEL to whatever it wants to pay for — and LLM_GATEWAY_URL to its own gateway if it runs one.",
  },
  {
    question: "Can I sign in with Google?",
    answer:
      "Yes — the button is on the sign-in screen, and on the account screen if you would rather add Google to an account you already have. Signing in with Google at an address you already use joins that account instead of starting a second one, because the join is keyed on the address Google verified. Email and password work too, and always will. A copy you host yourself offers Google only once it holds its own client credentials: both halves have to be present or the provider is not registered and the button is not drawn, since a button that fails on press is worse than no button.",
  },
  {
    question: "What does it cost?",
    answer:
      "Nothing to sign up for, and there is no seat count. The source is AGPL-3.0, so the alternative is running it yourself, which costs you a container and a MongoDB and no license.",
  },
] as const;

/** `SoftwareApplication.featureList`, and the feature list in `llms.txt`. */
export const PRODUCT_FEATURES = [
  "Mindmap canvas with drag-and-drop topics",
  "AI assistant that creates, renames, moves and deletes topics",
  "Markdown notes on every topic",
  "MCP server so external agents can edit the same mindmaps",
  "Self-hostable under AGPL-3.0",
] as const;

/**
 * When an agent should reach for ThinkClear, and when it should not.
 *
 * The second list is the half that makes the first one worth reading. An
 * agent choosing between tools is doing elimination, and a page that only ever
 * says yes gives it nothing to eliminate on — so the fit has to be drawn from
 * both sides or it does not read as guidance at all.
 */
export const WHEN_TO_USE = [
  "The user is thinking something through out loud — planning, decomposing a problem, taking apart an argument — and wants the structure kept as a tree they can look at afterwards.",
  "You need somewhere durable to put a hierarchy you just derived: a research outline, a project breakdown, a dependency map, the shape of a codebase.",
  "The user already has mindmaps here and asks you to read, search, extend, or reorganize them from your own client rather than from the app.",
  "You want to leave prose behind on a specific branch — every topic carries one markdown note, so findings can live on the node they belong to instead of in a chat log.",
  "A human needs to see the result. The same maps open on a canvas the user can drag, and server-side edits appear there as they happen.",
] as const;

export const WHEN_NOT_TO_USE = [
  "Free-form documents, tables, or anything that is not a tree — a mindmap has one root and no loops, and forcing a flat list into it loses the thing that made it a list.",
  "Long-term storage of secrets or personal data. Notes are ordinary database rows, not a vault.",
  "Bulk data you never intend a person to look at. A map is capped at 500 topics because past that it stops being readable, which is the only reason to have drawn it.",
] as const;

export const MCP_SCOPES = {
  read: "mindmaps:read",
  write: "mindmaps:write",
} as const;

export type McpScopeName = (typeof MCP_SCOPES)[keyof typeof MCP_SCOPES];

/**
 * Every tool served over MCP, with the one-line job each does and the scope it
 * needs.
 *
 * This is a *copy* of a fact that lives in `packages/shared`, and it is written
 * out rather than imported because the rule for this app is that it imports no
 * workspace package — a marketing copy change should not be a reason to rebuild
 * the API. What keeps a copy honest is a test rather than an import:
 * `test/content.spec.ts` asserts this list against the real derivation in
 * `@thinkclear/shared`, so a tool added or a scope moved fails there instead of
 * quietly leaving a page that describes a server that no longer exists.
 *
 * The scopes are not decoration either. An agent reads them to decide what to
 * ask for, and asking for `mindmaps:write` to do a job that only ever reads is
 * a consent screen the user is right to refuse.
 */
export const MCP_TOOLS: readonly {
  name: string;
  summary: string;
  scope: McpScopeName;
}[] = [
  {
    name: "list_mindmaps",
    summary: "Every mindmap the signed-in user owns.",
    scope: MCP_SCOPES.read,
  },
  {
    name: "read_mindmap",
    summary: "One mindmap as an indented outline, topic ids included.",
    scope: MCP_SCOPES.read,
  },
  {
    name: "search_topics",
    summary: "Find topics by words in their title or note, across every map.",
    scope: MCP_SCOPES.read,
  },
  {
    name: "read_topic_note",
    summary: "The markdown note on one topic.",
    scope: MCP_SCOPES.read,
  },
  {
    name: "create_mindmap",
    summary: "Start a new map from a title.",
    scope: MCP_SCOPES.write,
  },
  {
    name: "rename_mindmap",
    summary: "Retitle a map and its root topic.",
    scope: MCP_SCOPES.write,
  },
  {
    name: "delete_mindmap",
    summary: "Delete a map. Irreversible.",
    scope: MCP_SCOPES.write,
  },
  {
    name: "add_topics",
    summary: "Graft a nested tree of topics under a parent, in one call.",
    scope: MCP_SCOPES.write,
  },
  {
    name: "rename_topics",
    summary: "Retitle topics in a batch.",
    scope: MCP_SCOPES.write,
  },
  {
    name: "move_topics",
    summary: "Re-parent topics in a batch.",
    scope: MCP_SCOPES.write,
  },
  {
    name: "delete_topics",
    summary: "Delete topics and their descendants.",
    scope: MCP_SCOPES.write,
  },
  {
    name: "set_topic_note",
    summary: "Replace a topic's markdown note wholesale.",
    scope: MCP_SCOPES.write,
  },
];
