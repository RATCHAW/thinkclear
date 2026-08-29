"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * DESIGN.md › Elevation & Depth, level 3 "Floating Modal" — the same slab
 * `<Sheet>` uses, minus the edge it is anchored to. It is a {colors.paper}
 * panel on {rounded.xl} with the Floating shadow, centred in the viewport.
 *
 * Motion follows `<Sheet>`: CSS keyframes rather than transitions, because
 * Radix drives exit animations off `animationend` and a transition would
 * unmount before it ran. Enter 220ms, exit 160ms — quicker to leave than to
 * arrive, since by then the user has decided.
 *
 * The scale runs from `scale(0.97)`, and the transform origin stays centred:
 * unlike a popover, a modal is not anchored to the control that opened it, so
 * growing it out of one corner would point at nothing.
 */
function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-ink/20",
        "data-[state=open]:animate-scrim-in data-[state=closed]:animate-scrim-out",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        // Radix would focus the first control inside, which on a dialog that is
        // a place rather than a form puts a focus ring on a tab nobody pressed
        // — and reads as a selection fighting the one that is actually current.
        // Focusing the panel keeps the screen-reader context and starts the tab
        // order at the top, the same way `<SheetContent>` does.
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex w-full max-w-[calc(100vw_-_1rem)] flex-col sm:max-w-lg",
          "rounded-xl bg-paper text-foreground shadow-floating outline-none",
          // Centring and the entrance would collide on one `transform`, so
          // they use different properties: Tailwind v4 compiles these to the
          // standalone `translate`, leaving `transform` free for the keyframe's
          // scale. Nothing has to restate the other's value.
          "-translate-x-1/2 -translate-y-1/2 will-change-transform",
          "data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogCloseButton className="absolute top-3 right-3" />
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

/** {typography.display-xs} — the same title tier as `<SheetTitle>`. */
function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-display-xs", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-caption-md text-graphite", className)}
      {...props}
    />
  );
}

/** The 44px hit box the Touch Targets section asks for, around a 16px glyph. */
function DialogCloseButton({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return (
    <DialogClose
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-graphite outline-none",
        "transition-[color,background-color,transform] duration-[160ms] ease-out-strong",
        "hover:bg-cloud hover:text-foreground active:scale-[0.97] active:bg-fog",
        "focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      <X className="size-4" />
      <span className="sr-only">Close</span>
    </DialogClose>
  );
}

export {
  Dialog,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
