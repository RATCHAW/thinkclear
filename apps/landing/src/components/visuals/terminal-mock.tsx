/**
 * The two lines that connect an agent. Verbatim from the app's own MCP guide
 * (`apps/web/src/lib/mcp-connection.ts`), so this stays a screenshot of the
 * instructions rather than a paraphrase of them.
 *
 * The endpoint is long enough that the `add` line overflows the card at every
 * width the card is ever drawn at, so it is broken with a shell continuation
 * rather than left to scroll — the URL is the one part of this a reader has to
 * be able to see.
 */

import { MCP_ENDPOINT } from "@/lib/site";

type Line =
  | { kind: "command"; text: string }
  | { kind: "continuation"; text: string }
  | { kind: "output"; text: string };

const LINES: Line[] = [
  { kind: "command", text: "claude mcp add --transport http thinkclear \\" },
  { kind: "continuation", text: MCP_ENDPOINT },
  { kind: "command", text: "claude mcp login thinkclear" },
  { kind: "output", text: "Opening your browser to sign in…" },
  { kind: "output", text: "thinkclear  connected · 11 tools" },
];

export function TerminalMock() {
  return (
    <div className="overflow-hidden rounded-product border border-white/12 bg-white/[0.06]">
      <div className="flex items-center gap-2 border-b border-white/12 px-4 py-3">
        <span
          aria-hidden="true"
          className="size-2.5 rounded-full bg-white/25"
        />
        <span
          aria-hidden="true"
          className="size-2.5 rounded-full bg-white/25"
        />
        <span
          aria-hidden="true"
          className="size-2.5 rounded-full bg-white/25"
        />
        <span className="ml-2 text-caption text-mist-gray">
          Terminal — no API key
        </span>
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-caption leading-[1.9] sm:px-5 sm:text-body-sm">
        <code>
          {LINES.map((line) => (
            <span key={line.text} className="block whitespace-pre">
              {line.kind === "command" ? (
                <>
                  <span className="text-sky-cyan select-none">$ </span>
                  <span className="text-paper">{line.text}</span>
                </>
              ) : null}
              {line.kind === "continuation" ? (
                <span className="text-paper">{`      ${line.text}`}</span>
              ) : null}
              {line.kind === "output" ? (
                <span className="text-mist-gray">{`  ${line.text}`}</span>
              ) : null}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
