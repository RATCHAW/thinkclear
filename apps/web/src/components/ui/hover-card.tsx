import * as React from "react";
import { HoverCard as HoverCardPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function HoverCard({
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />;
}

function HoverCardTrigger({
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return (
    <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
  );
}

function HoverCardContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal data-slot="hover-card-portal">
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          // Scales from the trigger rather than from its own middle — the card
          // belongs to the thing under the pointer, and growing out of it is
          // what says so. Motion is DESIGN.md › Motion: never from scale(0),
          // ease-out both ways, and out faster than in.
          "z-50 w-64 origin-(--radix-hover-card-content-transform-origin) rounded-xl border border-hairline bg-popover p-4 text-popover-foreground shadow-floating outline-hidden",
          "data-[state=open]:animate-hover-card-in data-[state=closed]:animate-hover-card-out",
          className,
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
