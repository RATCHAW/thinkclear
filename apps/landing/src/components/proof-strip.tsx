import { Reveal } from "@/components/reveal";

/**
 * The band under the hero.
 *
 * The system's version of this is a row of monochrome customer logos, and this
 * page does not have any it could show without inventing them. The shape is
 * kept — a single centered row in Mist Gray, floating on the canvas with no
 * card and no border — and filled with the four things that are actually true
 * about the product instead.
 */
const PROOF_POINTS = [
  "Open source, AGPL-3.0",
  "Self-host with one compose file",
  "MCP over OAuth 2.1",
  "No API keys to paste",
];

export function ProofStrip() {
  return (
    <section className="border-y border-hairline bg-paper">
      <div className="mx-auto max-w-page px-5 py-8 sm:px-8">
        <Reveal>
          <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-center">
            {PROOF_POINTS.map((point) => (
              <li
                key={point}
                className="text-body-sm font-semibold tracking-[0.02em] text-mist-gray"
              >
                {point}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
