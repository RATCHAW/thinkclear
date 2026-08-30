import { ChevronDownIcon } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { JsonLd } from "@/components/structured-data";
import { SectionHeader } from "@/components/ui/section-header";

/**
 * `<details>`, not a JavaScript accordion. It is keyboard-operable, findable
 * by the browser's own in-page search, and works before hydration — and the
 * open/close motion is a progressive enhancement in CSS
 * (`::details-content`), so a browser without it opens instantly instead of
 * not at all.
 */
const QUESTIONS = [
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
      "When the deployment has a Google app configured. Both halves of the credential have to be present or the provider is not registered and the button is not drawn — a button that 400s on press is worse than no button. Email and password always work, and signing in with Google at an address you already use joins that account rather than starting a second one.",
  },
  {
    question: "What does it cost?",
    answer:
      "Nothing to sign up for, and there is no seat count. The source is AGPL-3.0, so the alternative is running it yourself, which costs you a container and a MongoDB and no license.",
  },
];

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
