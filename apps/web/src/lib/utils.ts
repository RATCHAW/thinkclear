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
