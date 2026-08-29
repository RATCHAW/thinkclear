import { ArrowRightIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { CanvasMock } from "@/components/visuals/canvas-mock";
import { GITHUB_URL, SIGN_UP_URL } from "@/lib/site";

/**
 * The hero animates on load rather than on scroll, which is why it is CSS
 * animations with delays instead of the IntersectionObserver everything below
 * uses: it fires while the browser is still fetching and painting the rest of
 * the page, and CSS animations run off the main thread where a JS-driven one
 * would drop its first frames.
 */
export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="mx-auto grid max-w-page items-center gap-14 px-5 pt-16 pb-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:pt-24 lg:pb-28">
        <div className="max-w-[620px]">
          <div className="rise" style={{ animationDelay: "40ms" }}>
            <Badge>Open source · MCP-native</Badge>
          </div>

          {/* `text-heading-lg`, not `text-display`, and three words rather than
              six. The system's hero range is 50–80px, but the column beside a
              product card is ~520px: 80px fits about nine characters a line,
              so the top of the range is sized for a headline this one is not.
              At 68px "Think out loud." is one line with room to spare, and the
              second half of the thought carries the paragraph instead. */}
          <h1
            className="rise mt-6 text-heading-lg text-ink-navy"
            style={{ animationDelay: "100ms" }}
          >
            Think out loud.
          </h1>

          <p
            className="rise mt-6 max-w-[540px] text-body-lg text-pretty text-slate-gray"
            style={{ animationDelay: "180ms" }}
          >
            The map keeps up. ThinkClear is a mindmap canvas with an assistant
            that can build it with you — say what you&rsquo;re working through
            and the branches appear, move, and pick up notes underneath. Or
            point the agent you already use at the same maps.
          </p>

          <div
            className="rise mt-9 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "250ms" }}
          >
            <ButtonLink href={SIGN_UP_URL}>
              Start for free
              <ArrowRightIcon className="size-[18px]" />
            </ButtonLink>
            <ButtonLink href="#features" variant="quiet">
              See how it works
            </ButtonLink>
          </div>

          <p
            className="rise mt-6 text-body-sm text-slate-gray"
            style={{ animationDelay: "310ms" }}
          >
            No credit card, no seat count.{" "}
            <a
              href={GITHUB_URL}
              rel="noreferrer"
              className="font-semibold text-ink-navy underline decoration-hairline underline-offset-4 transition-colors duration-150 hover:decoration-signal-blue"
            >
              AGPL-3.0
            </a>{" "}
            — run the whole thing on your own machine instead.
          </p>
        </div>

        {/* Every product visual sits in front of a magenta or cyan blob,
            offset behind it. Atmosphere only: the decorative accents are never
            a fill for something the user can act on. */}
        <div className="rise relative" style={{ animationDelay: "200ms" }}>
          <span
            aria-hidden="true"
            className="blob -top-10 -left-6 size-64 bg-coral-magenta"
          />
          <span
            aria-hidden="true"
            className="blob -right-8 -bottom-12 size-72 bg-sky-cyan"
          />
          <div className="relative overflow-hidden rounded-product bg-paper shadow-product">
            <CanvasMock />
          </div>
        </div>
      </div>
    </section>
  );
}
