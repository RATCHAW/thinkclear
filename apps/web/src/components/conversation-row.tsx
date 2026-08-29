import { Pencil, Trash2 } from "lucide-react";
import {
  RowAction,
  RowConfirmDelete,
  RowRenameField,
  rowEnterDelay,
  type RowMode,
} from "@/components/list-row";
import type { ConversationSummary } from "@/hooks/use-conversations";
import { cn, formatRelativeTime } from "@/lib/utils";

/**
 * One chat in the assistant's history, built from the same row vocabulary as
 * the mindmap library so both lists behave identically: tap to open, pencil to
 * rename in place, bin to confirm and delete in place.
 */
export function ConversationRow({
  conversation,
  active,
  index,
  leaving,
  mode,
  onModeChange,
  onSelect,
  onRename,
  onDelete,
}: {
  conversation: ConversationSummary;
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
      style={rowEnterDelay(index)}
    >
      {mode === "confirming-delete" ? (
        <RowConfirmDelete
          title={conversation.title}
          onCancel={() => onModeChange(null)}
          onConfirm={onDelete}
        />
      ) : mode === "renaming" ? (
        <RowRenameField
          title={conversation.title}
          label="Chat title"
          onCommit={(title) => {
            onModeChange(null);
            if (title !== conversation.title) onRename(title);
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
            // Named explicitly because the row shows a last-used time next to
            // the title: "Earlier chat 21h" is not what this button does.
            aria-label={`Open ${conversation.title}`}
            className={cn(
              "flex min-w-0 flex-1 items-baseline gap-2 rounded-lg px-3 text-left outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
            )}
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-body-md",
                active && "text-body-emphasis",
              )}
            >
              {conversation.title}
            </span>
            {/* Last-used time, not a full date: in a history list the only
                question it answers is "how far back was this". */}
            <span className="shrink-0 text-caption-sm text-graphite tabular-nums">
              {formatRelativeTime(conversation.updatedAt)}
            </span>
          </button>

          <div className="flex shrink-0 items-center">
            <RowAction
              label={`Rename ${conversation.title}`}
              onClick={() => onModeChange("renaming")}
            >
              <Pencil className="size-4" />
            </RowAction>
            <RowAction
              label={`Delete ${conversation.title}`}
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
