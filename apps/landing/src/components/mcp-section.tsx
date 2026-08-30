import { ArrowRightIcon } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { ButtonLink } from "@/components/ui/button";
import { TerminalMock } from "@/components/visuals/terminal-mock";
import { MCP_GUIDE_URL } from "@/lib/site";

/**
 * The dark band. One per page, and this is the section that earns it: MCP is
 * the thing about ThinkClear that is hardest to believe until you see the two
 * lines it takes.
 */

const SCOPES = [
  {
    scope: "mindmaps:read",
    summary: "Read your mindmaps and the topics inside them",
    tools: [
      "list_mindmaps",
      "read_mindmap",
      "search_topics",
      "read_topic_note",
    ],
  },
  {
    scope: "mindmaps:write",
    summary: "Create, rename, reorganize, and delete maps and topics",
    tools: [
      "create_mindmap",
      "rename_mindmap",
      "delete_mindmap",
      "add_topics",
      "rename_topics",
      "move_topics",
      "delete_topics",
      "set_topic_note",
    ],
  },
];

export function McpSection() {
  return (
    <section id="mcp" className="overflow-hidden bg-ink-navy">
      <div className="mx-auto max-w-page px-5 py-20 sm:px-8 lg:py-28">
        {/* `min-w-0` on both columns: the terminal's command line does not
            break, and a grid item's automatic minimum size is its content's,
            so without this the whole band is as wide as that line. */}
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0">
            <Reveal>
              <p className="text-caption font-semibold tracking-[0.14em] text-sky-cyan uppercase">
                Model Context Protocol
              </p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="mt-4 text-heading text-balance text-paper">
                Your own agent, on your own maps.
              </h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-6 max-w-[520px] text-body-lg text-pretty text-mist-gray">
                The tools the built-in assistant calls are served over MCP too —
                the same objects, a second transport. Point a client at the
                endpoint and sign in. There is no token to copy: the server
                registers the client itself and answers the first call with the
                challenge that starts the OAuth flow.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <div className="mt-8">
                <ButtonLink href={MCP_GUIDE_URL} variant="outline">
                  Read the setup guide
                  <ArrowRightIcon className="size-[18px]" />
                </ButtonLink>
              </div>
            </Reveal>
          </div>

          <Reveal delay={120} className="min-w-0">
            <TerminalMock />
          </Reveal>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {SCOPES.map((entry, index) => (
            <Reveal key={entry.scope} delay={index * 70}>
              <div className="h-full rounded-card border border-white/12 bg-white/[0.04] p-6">
                <code className="font-mono text-body-sm font-semibold text-sky-cyan">
                  {entry.scope}
                </code>
                <p className="mt-3 text-body-sm text-mist-gray">
                  {entry.summary}
                </p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {entry.tools.map((tool) => (
                    <li
                      key={tool}
                      className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 font-mono text-caption text-paper/85"
                    >
                      {tool}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={140}>
          <p className="mx-auto mt-10 max-w-[720px] text-center text-body-sm text-mist-gray">
            Scopes are enforced by leaving tools out. A read-only token is
            served a tool list with no way to edit anything, so the agent never
            plans a call that was going to be refused — and a grant is taken
            back from your account, not from a config file.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
