/**
 * The logo: three topics on a branch, then the name. Drawn in `currentColor`
 * so the footer's dark band gets it for free.
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
          <circle cx="4.5" cy="12" r="2.5" />
          <circle cx="19.5" cy="6" r="2.5" />
          <circle cx="19.5" cy="18" r="2.5" />
          <path d="M7 11.2c3.4-1 4-1.3 5-2.4s1.8-1.5 5-2.5" />
          <path d="M7 12.8c3.4 1 4 1.3 5 2.4s1.8 1.5 5 2.5" />
        </svg>
        <span className="text-body-lg font-bold tracking-[-0.01em]">
          ThinkClear
        </span>
      </span>
    </span>
  );
}
