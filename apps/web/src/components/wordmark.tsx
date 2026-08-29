import { cn } from "@/lib/utils";

/**
 * The logo — "The Unknotting": two threads cross once, then run parallel.
 * Two shapes and no third, so there is nothing to lose at favicon size.
 *
 * A deliberate second copy of the glyph in `apps/landing`. The two apps share
 * no package (see CLAUDE.md › The landing page shares the repository and
 * nothing else) and this is a fifteen-line path, not a dependency worth
 * inventing — what they share is the drawing, and the drawing is in the design
 * system, not in either app.
 *
 * The mark is drawn in `currentColor` rather than the board's Ink Navy: that
 * navy is the *landing's* palette, and this app's ink is {colors.ink}. The one
 * place the product's own icon colours appear here is `public/icon.svg`, which
 * has to match the browser tab on the marketing site because it is the same
 * product.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.4 5.8C8.6 5.8 8.6 18.2 13.4 18.2H20.6" />
      <path d="M3.4 18.2C8.6 18.2 8.6 5.8 13.4 5.8H20.6" />
    </svg>
  );
}

/**
 * The lockup: mark then name, on the board's ratios — the glyph a shade larger
 * than the cap height, and a gap of about a third of it.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-1.5 text-ink", className)}>
      <LogoMark className="size-5 shrink-0" />
      <span className="text-body-lg font-bold">ThinkClear</span>
    </span>
  );
}
