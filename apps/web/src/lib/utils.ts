import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge has to be told about the DESIGN.md token scales, otherwise it
 * mis-groups them: `text-body-md` looks like a text *color* to the default
 * config, so `cn("text-body-md", "text-ink")` would silently drop the size.
 * Registering the token names against the right theme scales keeps
 * size-vs-color, radius, shadow and spacing conflicts resolving correctly.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      // {typography}
      text: [
        "display-xxl",
        "display-xl",
        "display-lg",
        "display-md",
        "display-sm",
        "display-xs",
        "body-lg",
        "body-md",
        "body-emphasis",
        "caption-md",
        "caption-bold",
        "caption-sm",
        "link-md",
        "button-md",
        "button-sm",
        "price-md",
      ],
      // {rounded}
      radius: ["pill"],
      // Elevation & Depth
      shadow: ["soft-lift", "floating"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * A last-used stamp for list rows: short enough to sit at the end of a title
 * without competing with it. Past a week it becomes a date, because "9d" stops
 * meaning anything once the answer is just "a while ago".
 */
export function formatRelativeTime(
  timestamp: string,
  now: Date = new Date(),
): string {
  const then = new Date(timestamp);
  const elapsed = now.getTime() - then.getTime();
  if (Number.isNaN(elapsed)) return "";
  // A clock skew between server and browser can date a row a few seconds into
  // the future; "now" is the honest reading of that, not a negative age.
  if (elapsed < MINUTE) return "now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
