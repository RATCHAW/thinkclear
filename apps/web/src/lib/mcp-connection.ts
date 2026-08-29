/**
 * What a person needs in order to point an agent client at their mindmaps: the
 * endpoint, and the two or three lines that get a given client talking to it.
 *
 * This is documentation that has to stay true, so it is data rather than prose
 * inside a component — the endpoint is substituted into every snippet from one
 * place, and supporting another client is adding an entry.
 */

/**
 * The URL an agent client connects to.
 *
 * Derived from the address bar rather than fetched, and correct by
 * construction: the whole app is one origin, with `/api` proxied to the API
 * behind it (vite in dev, nginx in the image, a rewrite on Vercel). That is the
 * same fact `MCP_RESOURCE_URL` defaults to on the server, and the same fact
 * that makes discovery work — an origin where this guess were wrong would be
 * one where the client's RFC 9728 lookup failed too, so there is nothing here
 * that could be right while the rest of the flow was broken.
 */
export function mcpEndpointUrl(): string {
  return `${window.location.origin}/api/mcp`;
}

export interface McpSetupStep {
  /** What this step is for, in one line. */
  text: string;
  /** The line to run or paste, when the step has one. */
  snippet?: string;
}

export interface McpClient {
  id: string;
  /** What the client calls itself. */
  name: string;
  /** The steps, in order, that connect it. */
  steps: (endpoint: string) => McpSetupStep[];
  /**
   * The aside under them — the other way to do the same thing, or the version
   * for an older release. Kept out of the numbered list because a step nobody
   * has to take is not a step.
   */
  aside: (endpoint: string) => McpSetupStep;
}

/**
 * Every client below authenticates the same way, and none of them needs a
 * client id or an API key: the server registers agent clients dynamically
 * (RFC 7591) and answers an unauthenticated call with the challenge that
 * bootstraps the OAuth flow. So every setup is "name the URL, then sign in" —
 * worth saying out loud, because most MCP instructions start by asking for a
 * token, and its absence here reads as a missing step rather than as the point.
 */
export const MCP_CLIENTS: McpClient[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    steps: (endpoint) => [
      {
        text: "Add the server.",
        snippet: `claude mcp add --transport http thinkclear ${endpoint}`,
      },
      {
        text: "Sign in. A browser opens on the consent screen, and the tokens are stored and refreshed for you.",
        snippet: "claude mcp login thinkclear",
      },
    ],
    aside: () => ({
      text: "Before Claude Code 2.1.186 there is no login command: run /mcp inside a session and pick thinkclear from the panel instead.",
    }),
  },
  {
    id: "codex",
    name: "Codex",
    steps: (endpoint) => [
      {
        text: "Add the server.",
        snippet: `codex mcp add thinkclear --url ${endpoint}`,
      },
      {
        text: "Sign in.",
        snippet: "codex mcp login thinkclear",
      },
    ],
    aside: (endpoint) => ({
      text: "The same entry, written into ~/.codex/config.toml by hand.",
      snippet: `[mcp_servers.thinkclear]\nurl = "${endpoint}"\nauth = "oauth"`,
    }),
  },
  {
    id: "other",
    name: "Anything else",
    steps: (endpoint) => [
      {
        text: "Add a remote server over streamable HTTP. Some clients spell that transport streamable-http and some spell it http; both mean this one.",
        snippet: endpoint,
      },
      {
        text: "Leave the token field empty and connect. The client registers itself and sends you here to sign in, so there is nothing to paste.",
      },
    ],
    aside: (endpoint) => ({
      text: "A client configured from a file wants roughly this.",
      snippet: `{\n  "mcpServers": {\n    "thinkclear": {\n      "type": "streamable-http",\n      "url": "${endpoint}"\n    }\n  }\n}`,
    }),
  },
];
