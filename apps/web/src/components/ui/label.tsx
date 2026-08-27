import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

/** {typography.caption-md} at weight 500 — the metadata tier, per DESIGN.md. */
function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-caption-md font-medium text-foreground select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:text-graphite peer-disabled:cursor-not-allowed peer-disabled:text-graphite",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
