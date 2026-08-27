import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * DESIGN.md › Components › Cards & Containers.
 *
 * The `card-product` / `card-pricing-tier` / `card-customer-story` shape:
 * {colors.paper} on {rounded.xl} with {spacing.xl} padding and the Soft Lift
 * shadow. No border — Elevation level 2 is shadow-only, and depth otherwise
 * comes from color contrast (a white card on a {colors.cloud} band).
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl py-6 shadow-soft-lift",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}

/** {typography.display-xs} — the `card-product` title size. */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-display-xs", className)}
      {...props}
    />
  );
}

/** {typography.caption-md} in {colors.charcoal} — secondary description copy. */
function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-caption-md text-charcoal", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-content" className={cn("px-6", className)} {...props} />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
