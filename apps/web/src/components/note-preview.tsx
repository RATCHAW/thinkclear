import { Suspense } from "react";
import { Loader2, SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoverCardContent } from "@/components/ui/hover-card";
import { NoteMarkdown } from "@/components/note-markdown-lazy";

/**
 * The note a topic carries, shown where the pointer already is.
 *
 * A glance, not a reading surface: the body is clipped at a fixed height and
 * faded out at the cut rather than scrolled, because a hover card the user has
 * to scroll is a hover card that should have been a window — and Edit, one
 * press away, is exactly that window.
 *
 * Rendered from the same component the window edits with, locked. One renderer
 * means the preview cannot drift from what editing it will look like, and it
 * is why links here are live: with nothing intercepting the click, a
 * non-editable anchor is just an anchor.
 */
export function NotePreview({
  note,
  title,
  onEdit,
}: {
  note: string;
  title: string;
  onEdit: () => void;
}) {
  return (
    <HoverCardContent
      align="start"
      sideOffset={10}
      // `nodrag`/`nopan` so hovering and reading inside the card never reaches
      // the canvas underneath as a gesture.
      className="nodrag nopan w-80 overflow-hidden p-0"
    >
      <div className="relative max-h-52 overflow-hidden px-4 pt-4">
        <Suspense
          fallback={
            <div className="flex justify-center py-6">
              <Loader2 className="size-4 animate-spin text-graphite" />
            </div>
          }
        >
          <NoteMarkdown markdown={note} label={`Note on ${title}`} />
        </Suspense>
        {/* The clip is a fade rather than a hard edge, so a note that
            continues looks like it continues instead of looking broken. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-b from-transparent to-paper" />
      </div>

      <div className="flex justify-end border-t border-hairline px-2 py-2">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <SquarePen /> Edit
        </Button>
      </div>
    </HoverCardContent>
  );
}
