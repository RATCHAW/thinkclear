import type { ReactNode } from "react";
import { Reveal } from "@/components/reveal";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  body?: ReactNode;
  /** Ink Navy on light bands, Paper on the dark ones. */
  tone?: "light" | "dark";
  className?: string;
  children?: ReactNode;
}

/**
 * The centered intro block: eyebrow, H2, one paragraph capped at a readable
 * measure, and an optional CTA under it.
 */
export function SectionHeader({
  eyebrow,
  title,
  body,
  tone = "light",
  className,
  children,
}: SectionHeaderProps) {
  const dark = tone === "dark";
  return (
    <div className={cn("mx-auto max-w-[720px] text-center", className)}>
      {eyebrow ? (
        <Reveal>
          <p
            className={cn(
              "text-caption font-semibold tracking-[0.14em] uppercase",
              dark ? "text-sky-cyan" : "text-slate-gray",
            )}
          >
            {eyebrow}
          </p>
        </Reveal>
      ) : null}
      <Reveal delay={eyebrow ? 60 : 0}>
        <h2
          className={cn(
            "text-heading text-balance",
            eyebrow ? "mt-4" : undefined,
            dark ? "text-paper" : "text-ink-navy",
          )}
        >
          {title}
        </h2>
      </Reveal>
      {body ? (
        <Reveal delay={120}>
          <p
            className={cn(
              "mx-auto mt-6 max-w-[640px] text-body-lg text-pretty",
              dark ? "text-mist-gray" : "text-slate-gray",
            )}
          >
            {body}
          </p>
        </Reveal>
      ) : null}
      {children ? (
        <Reveal delay={180}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {children}
          </div>
        </Reveal>
      ) : null}
    </div>
  );
}
