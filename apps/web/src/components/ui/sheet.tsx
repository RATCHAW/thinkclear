import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * DESIGN.md › Elevation & Depth, level 3 "Floating Modal" — the row that lists
 * "mobile-nav sheet" as its use. It is a {colors.paper} panel on {rounded.xl}
 * with the Floating shadow, inset 8px from the viewport edges so it reads as
 * floating over the canvas rather than welded to it.
 *
 * Left-anchored only, on purpose. A `side` prop would be four more lines and
 * one more thing to keep honest against the spec; add it when a right-hand
 * sheet actually exists.
 *
 * Motion is CSS keyframes (see index.css) rather than transitions because Radix
 * drives exit animations off `animationend` — a transition would unmount before
 * it ran. Enter 280ms on the iOS panel curve, exit 200ms: slower to arrive,
 * quicker to leave.
 */
function Sheet(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(
  props: React.ComponentProps<typeof DialogPrimitive.Trigger>,
) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-40 bg-ink/20",
        "data-[state=open]:animate-scrim-in data-[state=closed]:animate-scrim-out",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <SheetOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        // A sheet is a place, not a form. Radix would focus the first field,
        // which on a phone throws the keyboard up over the thing you opened the
        // sheet to look at; focusing the panel keeps the screen-reader context
        // and leaves the keyboard down.
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          // Radix dispatches this on the content node, so currentTarget is the
          // panel — typed as a bare EventTarget because it's a CustomEvent.
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
        className={cn(
          "fixed inset-y-2 left-2 z-50 flex w-88 max-w-[calc(100vw_-_1rem)] flex-col",
          "rounded-xl bg-paper text-foreground shadow-floating outline-none",
          "will-change-transform data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "flex items-start justify-between gap-3 border-b border-hairline px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

/** {typography.display-xs} — the same title tier as `<CardTitle>`. */
function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-display-xs", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-caption-md text-graphite", className)}
      {...props}
    />
  );
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("min-h-0 flex-1 overflow-y-auto px-3 py-3", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("border-t border-hairline px-5 py-4", className)}
      {...props}
    />
  );
}

/** The 44px hit box the Touch Targets section asks for, around a 16px glyph. */
function SheetCloseButton({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return (
    <SheetClose
      className={cn(
        "-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-graphite outline-none",
        "transition-[color,background-color,transform] duration-[160ms] ease-out-strong",
        "hover:bg-cloud hover:text-foreground active:scale-[0.97] active:bg-fog",
        "focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      <X className="size-4" />
      <span className="sr-only">Close</span>
    </SheetClose>
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetCloseButton,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
};
