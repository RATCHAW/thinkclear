import { useEffect, useState } from "react";
import { Loader2, RotateCw, SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationRow } from "@/components/conversation-row";
import { useDeferredRowDelete, type RowMode } from "@/components/list-row";
import {
  useConversations,
  useDeleteConversation,
  useRenameConversation,
} from "@/hooks/use-conversations";
import { cn } from "@/lib/utils";

/**
 * Chat history, as a layer over the assistant's conversation rather than a
 * route or a nested sheet. The chat stays mounted underneath — its scroll
 * position and any in-flight stream survive a look at the list — and the layer
 * descends from the header button that opened it.
 */
export function AssistantHistory({
  open,
  activeConversationId,
  onSelect,
  onNewChat,
  onDeleted,
}: {
  open: boolean;
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDeleted: (id: string) => void;
}) {
  const {
    data: conversations,
    isPending,
    isError,
    refetch,
  } = useConversations();
  const renameConversation = useRenameConversation();
  const deleteConversation = useDeleteConversation();

  const [editing, setEditing] = useState<{ id: string; mode: RowMode } | null>(
    null,
  );
  const { leavingId, requestDelete } = useDeferredRowDelete((id) => {
    deleteConversation.mutate(id);
    onDeleted(id);
  });

  useEffect(() => {
    if (!open) setEditing(null);
  }, [open]);

  return (
    <div
      aria-label="Chat history"
      aria-hidden={!open}
      inert={!open}
      // Escape belongs to the innermost thing that is open: with a row
      // mid-rename it undoes the rename, and only then does it reach the panel
      // and close the list.
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !editing) return;
        event.preventDefault();
        event.stopPropagation();
        setEditing(null);
      }}
      className={cn(
        "absolute inset-0 flex flex-col bg-paper",
        "transition-[opacity,transform] motion-reduce:transition-[opacity]",
        open
          ? "translate-y-0 opacity-100 duration-[220ms] ease-out-strong"
          : "pointer-events-none -translate-y-1 opacity-0 duration-[160ms] ease-out-strong motion-reduce:translate-y-0",
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-graphite" />
          </div>
        ) : isError ? (
          <div className="px-3 py-6 text-center">
            <p className="text-caption-md text-destructive">
              Could not load your chats.
            </p>
            <Button
              variant="link"
              className="mt-1"
              onClick={() => void refetch()}
            >
              <RotateCw /> Try again
            </Button>
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-caption-md text-graphite">
            No chats yet. Ask the assistant for something and it will show up
            here.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((conversation, index) => (
              <ConversationRow
                key={conversation._id}
                conversation={conversation}
                index={index}
                active={conversation._id === activeConversationId}
                leaving={conversation._id === leavingId}
                mode={editing?.id === conversation._id ? editing.mode : null}
                onModeChange={(mode) =>
                  setEditing(mode ? { id: conversation._id, mode } : null)
                }
                onSelect={() => onSelect(conversation._id)}
                onRename={(title) =>
                  renameConversation.mutate({ id: conversation._id, title })
                }
                onDelete={() => {
                  setEditing(null);
                  requestDelete(conversation._id);
                }}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-hairline p-3">
        <Button variant="secondary" className="w-full" onClick={onNewChat}>
          <SquarePen /> New chat
        </Button>
      </div>
    </div>
  );
}
