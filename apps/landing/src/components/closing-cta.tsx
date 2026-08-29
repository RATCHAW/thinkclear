import { ArrowRightIcon, GitHubIcon } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { ButtonLink } from "@/components/ui/button";
import { GITHUB_URL, SIGN_UP_URL } from "@/lib/site";

export function ClosingCta() {
  return (
    <section className="border-t border-hairline bg-paper">
      <div className="mx-auto max-w-page px-5 py-20 sm:px-8 lg:py-24">
        <Reveal>
          {/* No decorative blobs on this one. Behind a product card they read
              as atmosphere; behind a flat panel two of them blur into each
              other and the whole surface reads as a gradient, which is the one
              thing this system's backgrounds never do. */}
          <div className="rounded-card bg-ink-navy px-6 py-16 text-center sm:px-12">
            <div className="mx-auto max-w-[640px]">
              <h2 className="text-heading-sm text-balance text-paper">
                Get the thing out of your head.
              </h2>
              <p className="mx-auto mt-5 max-w-[520px] text-body-lg text-pretty text-mist-gray">
                Start a map, say what you are working through, and connect
                whatever agent you already have open.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <ButtonLink href={SIGN_UP_URL}>
                  Start for free
                  <ArrowRightIcon className="size-[18px]" />
                </ButtonLink>
                <ButtonLink href={GITHUB_URL} variant="outline">
                  <GitHubIcon className="size-5" />
                  Star on GitHub
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
