import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * DESIGN.md › Components › Buttons.
 *
 * Variant names stay shadcn-compatible so components installed later keep
 * working; each one maps to a spec entry:
 *   default   → button-primary       secondary → button-outline-ink
 *   ink       → button-ink           link      → button-text-link
 *   outline   → button-outline
 *
 * The spec documents Default and Pressed only. Hover and press-scale are
 * implementation deviations (recorded in DESIGN.md › Implementation Map) — they
 * introduce no new colors and :active lands on the documented
 * {colors.primary-deep}.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md uppercase outline-none transition-[color,background-color,border-color,transform] duration-[160ms] ease-out-strong active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // button-primary — the lone {colors.primary} CTA
        default:
          "bg-primary text-on-primary hover:bg-primary/90 active:bg-primary-deep disabled:bg-steel disabled:text-on-primary",
        // button-ink — black filled CTA for dark photo overlays
        ink: "bg-ink text-on-primary hover:bg-ink/90 active:bg-ink-deep disabled:bg-steel disabled:text-on-primary",
        // button-outline — blue-text outlined CTA
        outline:
          "border border-primary bg-transparent text-primary hover:bg-primary-soft/40 active:border-primary-deep active:text-primary-deep disabled:border-steel disabled:text-steel",
        // button-outline-ink — neutral outlined CTA
        secondary:
          "border border-current bg-transparent text-foreground hover:bg-cloud active:bg-fog disabled:border-steel disabled:text-steel",
        // Unspec'd but needed by shadcn primitives — kept inside the palette
        ghost: "text-foreground hover:bg-cloud active:bg-fog disabled:text-steel",
        destructive:
          "bg-destructive text-on-primary hover:bg-destructive/90 active:bg-bloom-wine disabled:bg-steel",
        // button-text-link — inline blue link with underline
        link: "px-0 text-primary underline underline-offset-4 normal-case active:text-primary-deep disabled:text-steel",
      },
      size: {
        // 44px clears the WCAG-AAA touch target called out in Touch Targets
        default: "h-11 px-6 text-button-md",
        sm: "h-9 px-4 text-button-sm",
        lg: "h-12 px-8 text-button-md",
        icon: "size-11",
      },
    },
    compoundVariants: [
      // button-text-link is type-led, not a box: {typography.link-md}, no
      // height. Press-scale is skipped too — a run of text shrinking mid-
      // sentence reads as a glitch, not as feedback.
      {
        variant: "link",
        class: "h-auto px-0 py-1 text-link-md active:scale-100",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
