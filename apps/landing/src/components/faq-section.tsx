import { ChevronDownIcon } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { JsonLd } from "@/components/structured-data";
import { SectionHeader } from "@/components/ui/section-header";
import { FAQ_QUESTIONS as QUESTIONS } from "@/lib/content";

/**
 * `<details>`, not a JavaScript accordion. It is keyboard-operable, findable
 * by the browser's own in-page search, and works before hydration — and the
 * open/close motion is a progressive enhancement in CSS
 * (`::details-content`), so a browser without it opens instantly instead of
 * not at all.
 *
 * The questions moved to `lib/content.ts` when the markdown twin of this page
 * started needing them too. Three surfaces now read that array — this section,
 * the `FAQPage` markup below, and the markdown — and none of them can answer a
 * question differently from the others.
 */

/**
 * Built from the array above rather than written out beside it, which is the
 * only arrangement where the two cannot disagree — a `FAQPage` whose answers
 * have drifted from the visible ones is worse than no markup at all.
 *
 * Not here for rich results: Google narrowed those to government and health
 * sites in 2023, and this is neither. It is here because the FAQ is where the
 * page answers the questions somebody actually types, and this is the form an
 * AI search engine or Bing can lift them in.
 */
const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: QUESTIONS.map((entry) => ({
    "@type": "Question",
    name: entry.question,
    acceptedAnswer: { "@type": "Answer", text: entry.answer },
  })),
};

export function FaqSection() {
  return (
    <section className="border-t border-hairline">
      <JsonLd data={FAQ_SCHEMA} />
      <div className="mx-auto max-w-page px-5 py-20 sm:px-8 lg:py-28">
        <SectionHeader eyebrow="Questions" title="Before you sign up." />

        <div className="mx-auto mt-14 max-w-[760px]">
          {QUESTIONS.map((entry, index) => (
            <Reveal key={entry.question} delay={index * 50}>
              <details className="faq-item group border-b border-hairline">
                <summary className="flex cursor-pointer list-none items-center gap-4 py-5 text-left [&::-webkit-details-marker]:hidden">
                  <h3 className="flex-1 text-body-lg font-semibold text-ink-navy">
                    {entry.question}
                  </h3>
                  <ChevronDownIcon className="size-5 shrink-0 text-slate-gray transition-transform duration-200 ease-out group-open:-rotate-180 motion-reduce:transition-none" />
                </summary>
                <p className="pr-9 pb-6 text-body text-slate-gray">
                  {entry.answer}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
