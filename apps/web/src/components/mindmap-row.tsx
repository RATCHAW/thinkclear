import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Mindmap } from "@/hooks/use-mindmaps";
import { cn } from "@/lib/utils";

export type RowMode = "renaming" | "confirming-delete";

/**
 * One mindmap in the library list. Rename and delete happen in place rather
 * than in a nested dialog — a dialog stacked on a sheet is two layers of chrome
 * for a one-field edit, and it takes the list you are editing off screen.
 *
 * `mode` is owned by the list, not by the row: only one row can be mid-edit at
 * a time, and the sheet needs to know an edit is open so Escape cancels the
 * edit instead of closing the whole panel.
 *
 * Every mode is pinned to the same 44px row height, so switching between them
 * never shifts the rows below. That is the WCAG-AAA touch target from
 * DESIGN.md › Touch Targets doing double duty.
 */
export function MindmapRow({
  mindmap,
  active,
  index,
  leaving,
  mode,
  onModeChange,
  onSelect,
  onRename,
  onDelete,
}: {
  mindmap: Mindmap;
  active: boolean;
  index: number;
  leaving: boolean;
  mode: RowMode | null;
  onModeChange: (mode: RowMode | null) => void;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={cn(
        "animate-row-in",
        leaving && "animate-row-out pointer-events-none",
      )}
      // Stagger is decoration: it caps out after a handful of rows so a long
      // library never waits on its own entrance.
      style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
    >
      {mode === "confirming-delete" ? (
        <ConfirmDelete
          title={mindmap.title}
          onCancel={() => onModeChange(null)}
          onConfirm={onDelete}
        />
      ) : mode === "renaming" ? (
        <RenameField
          title={mindmap.title}
          onCommit={(title) => {
            onModeChange(null);
            if (title !== mindmap.title) onRename(title);
          }}
        />
      ) : (
        <div
          className={cn(
            "flex h-11 items-center rounded-lg pr-1 transition-colors duration-[160ms] ease-out-strong",
            active ? "bg-fog" : "hover:bg-cloud",
          )}
        >
          <button
            type="button"
            onClick={onSelect}
            className={cn(
              "min-w-0 flex-1 truncate rounded-lg px-3 text-left text-body-md outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              active && "text-body-emphasis",
            )}
          >
            {mindmap.title}
          </button>

          {/* Kept in the layout at all times. Hover-revealed actions are
              unreachable on touch, and fading them in on :hover leaves them
              stuck visible after a tap; low contrast does the hiding instead. */}
          <div className="flex shrink-0 items-center">
            <RowAction
              label={`Rename ${mindmap.title}`}
              onClick={() => onModeChange("renaming")}
            >
              <Pencil className="size-4" />
            </RowAction>
            <RowAction
              label={`Delete ${mindmap.title}`}
              destructive
              onClick={() => onModeChange("confirming-delete")}
            >
              <Trash2 className="size-4" />
            </RowAction>
          </div>
        </div>
      )}
    </li>
  );
}

function RowAction({
  label,
  destructive,
  onClick,
  children,
}: {
  label: string;
  destructive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md text-graphite outline-none",
        "transition-[color,background-color,transform] duration-[160ms] ease-out-strong",
        "active:scale-[0.94] focus-visible:ring-2 focus-visible:ring-ring",
        destructive
          ? "hover:bg-bloom-rose/50 hover:text-destructive"
          : "hover:bg-paper hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function RenameField({
  title,
  onCommit,
}: {
  title: string;
  onCommit: (title: string) => void;
}) {
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  // Blur commits, so clicking away saves rather than silently discarding.
  // Cancelling is Escape, which the sheet turns into an unmount — and browsers
  // don't fire blur on a node that gets removed, so the two don't collide.
  function commit() {
    const trimmed = draft.trim();
    onCommit(trimmed || title);
  }

  return (
    <div className="flex h-11 items-center px-1">
      <Input
        ref={inputRef}
        autoFocus
        value={draft}
        aria-label="Mindmap title"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        className="h-9 rounded-md"
      />
    </div>
  );
}

function ConfirmDelete({
  title,
  onCancel,
  onConfirm,
}: {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex h-11 animate-fade-in items-center gap-2 rounded-lg bg-cloud pr-1 pl-3">
      {/* Only the title truncates. Letting the whole line clip would swallow
          the closing quote and the question mark, which reads as a bug rather
          than as a long name. */}
      <p className="flex min-w-0 flex-1 items-center text-caption-md text-charcoal">
        <span className="shrink-0">Delete&nbsp;“</span>
        <span className="truncate">{title}</span>
        <span className="shrink-0">”?</span>
      </p>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      {/* Autofocused so confirming is one keystroke away, and so focus is
          somewhere sensible when the row swaps back after cancelling. */}
      <Button variant="destructive" size="sm" autoFocus onClick={onConfirm}>
        Delete
      </Button>
    </div>
  );
}
