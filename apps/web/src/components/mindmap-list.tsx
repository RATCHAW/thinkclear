import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateMindmap, useMindmaps } from "@/hooks/use-mindmaps";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

export function MindmapList() {
  const { data: mindmaps, isPending, isError } = useMindmaps();
  const createMindmap = useCreateMindmap();
  const selectedMindmapId = useUiStore((s) => s.selectedMindmapId);
  const selectMindmap = useUiStore((s) => s.selectMindmap);
  const [title, setTitle] = useState("");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    createMindmap.mutate(trimmed, {
      onSuccess: (created) => {
        setTitle("");
        selectMindmap(created._id);
      },
    });
  }

  if (isPending) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-4 text-sm text-destructive">
        Could not load your mindmaps.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          placeholder="New mindmap title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={createMindmap.isPending}
        />
        <Button
          type="submit"
          disabled={createMindmap.isPending || !title.trim()}
        >
          {createMindmap.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Plus />
          )}
          Create
        </Button>
      </form>

      {mindmaps.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          No mindmaps yet — create your first one above.
        </p>
      ) : (
        <ul className="space-y-1">
          {mindmaps.map((mindmap) => (
            <li key={mindmap._id}>
              <button
                type="button"
                onClick={() => selectMindmap(mindmap._id)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                  mindmap._id === selectedMindmapId &&
                    "bg-muted font-medium",
                )}
              >
                {mindmap.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
