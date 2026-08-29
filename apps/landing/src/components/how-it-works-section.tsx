import { ArrowRightIcon } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { SIGN_UP_URL } from "@/lib/site";

const STEPS = [
  {
    title: "Start a map",
    body: "Or ask for one. Every map is born with a root topic, so there is always something to branch from and never an empty canvas to stare at.",
  },
  {
    title: "Think out loud",
    body: "Type into the canvas, or tell the assistant what you are working through and watch it lay out the branches. Whatever it adds, you can drag.",
  },
  {
    title: "Bring your own agent",
    body: "Connect Claude Code or Codex over MCP and keep working on the same maps from the terminal you were already in. Sign in once; there is no key.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works">
      <div className="mx-auto max-w-page px-5 py-20 sm:px-8 lg:py-28">
        <SectionHeader
          eyebrow="How it works"
          title="Three steps, and none of them is setup."
        />

        <ol className="mt-14 grid gap-8 md:grid-cols-3 md:gap-10">
          {STEPS.map((step, index) => (
            <Reveal as="li" key={step.title} delay={index * 70}>
              <div className="flex h-full flex-col">
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-ink-navy text-body font-bold text-paper">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-subheading text-ink-navy">
                  {step.title}
                </h3>
                <p className="mt-3 text-body text-slate-gray">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={140}>
          <div className="mt-14 flex justify-center">
            <ButtonLink href={SIGN_UP_URL}>
              Start for free
              <ArrowRightIcon className="size-[18px]" />
            </ButtonLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
