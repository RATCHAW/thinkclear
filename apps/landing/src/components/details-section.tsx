import { HistoryIcon, LinkIcon, LockIcon } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { SectionHeader } from "@/components/ui/section-header";

/**
 * The three decisions that do not show up in a screenshot and are the reason
 * the app is pleasant to live in. A card grid is rare in this system; three
 * short items that are peers of each other is the case that earns one.
 */
const DETAILS = [
  {
    icon: <HistoryIcon className="size-6" />,
    title: "Chat history is a real resource",
    body: "Every turn is written as you send it, so a generation that fails or gets abandoned still leaves your question behind. Conversations are titled from the first message and sorted by the last one.",
  },
  {
    icon: <LinkIcon className="size-6" />,
    title: "Every view is a URL",
    body: "The open map, the panel, which notes are up and which of them is in front — all of it is in the address bar. Back works. Reload works. A pasted link puts somebody exactly where you were.",
  },
  {
    icon: <LockIcon className="size-6" />,
    title: "Your maps are yours",
    body: "Every query is filtered by owner before it runs. Somebody else's mindmap and one that never existed come back as the same 404 — there is no route that reads a document by id alone.",
  },
];

export function DetailsSection() {
  return (
    <section className="border-y border-hairline bg-paper">
      <div className="mx-auto max-w-page px-5 py-20 sm:px-8 lg:py-28">
        <SectionHeader
          eyebrow="The unglamorous half"
          title="The parts you only notice when they're missing."
        />
        <ul className="mt-14 grid gap-6 md:grid-cols-3">
          {DETAILS.map((detail, index) => (
            <Reveal as="li" key={detail.title} delay={index * 70}>
              <div className="h-full rounded-card border border-hairline bg-cloud p-6">
                <span className="inline-flex size-11 items-center justify-center rounded-input bg-badge-wash text-signal-blue">
                  {detail.icon}
                </span>
                <h3 className="mt-5 text-body-lg font-semibold text-ink-navy">
                  {detail.title}
                </h3>
                <p className="mt-3 text-body text-slate-gray">{detail.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
