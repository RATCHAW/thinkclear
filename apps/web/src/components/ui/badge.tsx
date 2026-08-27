import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * DESIGN.md › Components › Inputs & Forms:
 *   ink     → `badge-pill-ink`      (filled, {rounded.lg}, 6px 12px)
 *   outline → `badge-pill-outline`
 *   sale    → `badge-sale-coral`    ({rounded.sm}, {typography.caption-bold})
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap [&>svg]:pointer-events-none [&>svg:not([class*='size-'])]:size-3",
  {
    variants: {
      variant: {
        ink: "rounded-lg bg-ink px-3 py-1.5 text-body-md text-on-primary",
        outline:
          "rounded-lg border border-ink bg-transparent px-3 py-1.5 text-body-md text-ink",
        sale: "rounded-sm bg-bloom-coral px-2 py-1 text-caption-bold text-on-primary",
      },
    },
    defaultVariants: {
      variant: "ink",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
