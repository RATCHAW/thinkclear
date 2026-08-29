import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The pill badge: a Pebble-tinted wash with Deep Cobalt text. Informational,
 * never actionable — the badge blue is deliberately not the CTA blue.
 */
export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-badge-wash px-3 py-1 text-caption font-medium text-deep-cobalt",
        className,
      )}
    >
      {children}
    </span>
  );
}
