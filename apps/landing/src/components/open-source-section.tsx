import { GitHubIcon } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { ButtonLink } from "@/components/ui/button";
import {
  GITHUB_DEPLOYMENT_URL,
  GITHUB_LICENSE_URL,
  GITHUB_URL,
} from "@/lib/site";

const COMMANDS = [
  "git clone https://github.com/RATCHAW/thinkclear.git",
  "docker compose --profile full up --build",
  "# web on :5173, api on :3000, one origin",
];

export function OpenSourceSection() {
  return (
    <section
      id="open-source"
      className="overflow-hidden border-t border-hairline bg-paper"
    >
      {/* `min-w-0` on both columns is load-bearing, not defensive. A grid item
          defaults to `min-width: auto`, so the unbreakable `git clone …` line
          in the snippet sets the track's minimum and drags the whole section
          wider than the phone it is being read on. */}
      <div className="mx-auto grid max-w-page items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-28">
        <div className="min-w-0">
          <Reveal>
            <p className="text-caption font-semibold tracking-[0.14em] text-slate-gray uppercase">
              Open source
            </p>
          </Reveal>
          <Reveal delay={60}>
            <h2 className="mt-4 text-heading text-balance text-ink-navy">
              Built in the open. Run it yourself.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-6 max-w-[520px] text-body-lg text-pretty text-slate-gray">
              The whole stack is one repository — the Nest API, the React
              canvas, the MCP server, and the deployment it runs on. The compose
              file brings that topology up in miniature on your machine, behind
              one origin, the way it answers in production.
            </p>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-4 max-w-[520px] text-body text-slate-gray">
              Licensed{" "}
              <a
                href={GITHUB_LICENSE_URL}
                rel="noreferrer"
                className="font-semibold text-ink-navy underline decoration-hairline underline-offset-4 transition-colors duration-150 hover:decoration-signal-blue"
              >
                AGPL-3.0
              </a>
              , which means a modified copy running as a service owes its users
              the source. That clause is the reason for the license, not a side
              effect of it.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={GITHUB_URL} variant="dark">
                <GitHubIcon className="size-5" />
                View the source
              </ButtonLink>
              <ButtonLink href={GITHUB_DEPLOYMENT_URL} variant="quiet">
                Deployment guide
              </ButtonLink>
            </div>
          </Reveal>
        </div>

        <Reveal delay={120} className="min-w-0">
          <div className="relative">
            <span
              aria-hidden="true"
              className="blob -top-8 -left-8 size-56 bg-coral-magenta"
            />
            <div className="relative overflow-hidden rounded-product border border-hairline bg-cloud shadow-product">
              <div className="border-b border-hairline px-5 py-3 text-caption font-semibold tracking-[0.1em] text-slate-gray uppercase">
                Self-host
              </div>
              <pre className="overflow-x-auto px-5 py-5 font-mono text-caption leading-[2] sm:text-body-sm">
                <code>
                  {COMMANDS.map((command) => (
                    <span key={command} className="block whitespace-pre">
                      {command.startsWith("#") ? (
                        <span className="text-mist-gray">{command}</span>
                      ) : (
                        <>
                          <span className="text-signal-blue select-none">
                            ${" "}
                          </span>
                          <span className="text-ink-navy">{command}</span>
                        </>
                      )}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
