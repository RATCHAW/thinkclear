import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The interaction vocabulary shared by every editable list in the app: the
 * mindmap library and the assistant's chat history. Both are a column of named
 * things you open, rename, or delete, so they get one implementation rather
 * than two that drift.
 *
 * Rename and delete happen in place rather than in a nested dialog — a dialog
 * stacked on a panel is two layers of chrome for a one-field edit, and it
 * takes the list you are editing off screen.
 *
 * Every mode is pinned to the same 44px row height, so switching between them
 * never shifts the rows below. That is the WCAG-AAA touch target from
 * DESIGN.md › Touch Targets doing double duty.
 */
export type RowMode = "renaming" | "confirming-delete";

/** How long a deleted row gets to animate out before it leaves the list. */
export const ROW_EXIT_MS = 160;

/**
 * Holds a delete back until the row has animated out. Deletes are optimistic,
 * so without this the row vanishes from under the cursor mid-click; letting it
 * leave first costs 160ms nobody waits on. The timer is cleared on unmount so
 * closing the panel mid-exit doesn't fire a mutation into a dead tree.
 */
export function useDeferredRowDelete(remove: (id: string) => void) {
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  // The caller passes an inline closure, so the timeout reads the latest one
  // through a ref rather than the one that existed when the delete started.
  const removeRef = useRef(remove);
  useEffect(() => {
    removeRef.current = remove;
  });

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return {
    leavingId,
    requestDelete: (id: string) => {
      setLeavingId(id);
      timer.current = window.setTimeout(() => {
        setLeavingId(null);
        removeRef.current(id);
      }, ROW_EXIT_MS);
    },
  };
}

/**
 * Stagger is decoration: it caps out after a handful of rows so a long list
 * never waits on its own entrance.
 */
export function rowEnterDelay(index: number): React.CSSProperties {
  return { animationDelay: `${Math.min(index, 6) * 30}ms` };
}

export function RowAction({
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

export function RowRenameField({
  title,
  label,
  onCommit,
}: {
  title: string;
  label: string;
  onCommit: (title: string) => void;
}) {
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  // Blur commits, so clicking away saves rather than silently discarding.
  // Cancelling is Escape, which the list turns into an unmount — and browsers
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
        aria-label={label}
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

export function RowConfirmDelete({
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
