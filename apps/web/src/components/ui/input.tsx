import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * DESIGN.md › Components › Inputs & Forms › `text-input` + `text-input-focused`.
 *
 * 44px tall on {rounded.md} with {spacing.sm} {spacing.md} padding, a 1px
 * {colors.steel} border that goes 1px {colors.ink} on focus — explicitly no
 * halo, so there is no focus ring here by design.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-4 py-3 text-body-md text-foreground outline-none transition-colors",
        "placeholder:text-graphite selection:bg-primary selection:text-on-primary",
        "focus-visible:border-ring",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-steel disabled:text-graphite",
        "aria-invalid:border-destructive",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-caption-md file:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
