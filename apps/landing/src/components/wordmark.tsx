/**
 * The logo — "The Unknotting": two threads cross once, then run parallel.
 * Two shapes and no third, so there is nothing to lose at favicon size.
 *
 * Drawn on the 24×24 grid at 1.9px with round caps and joins, in
 * `currentColor`, so the header and the footer both get it from whatever ink
 * they already set. The app icon (`app/icon.svg`) is the same glyph in the
 * other skin — root yellow on Ink Navy.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="flex items-center gap-2">
        <svg
          viewBox="0 0 24 24"
          width={22}
          height={22}
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
        <span className="text-body-lg font-extrabold tracking-[-0.01em]">
          ThinkClear
        </span>
      </span>
    </span>
  );
}
