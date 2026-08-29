import { useEffect, useState } from "react";
import { Loader2, LogOut, PanelLeft, Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetCloseButton,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useDeferredRowDelete, type RowMode } from "@/components/list-row";
import { MindmapRow } from "@/components/mindmap-row";
import {
  useActiveMindmap,
  useCreateMindmap,
  useDeleteMindmap,
  useMindmaps,
  useUpdateMindmap,
} from "@/hooks/use-mindmaps";
import {
  openMindmap,
  setLibraryOpen,
  useWorkspaceRoute,
} from "@/hooks/use-workspace-route";
import { signOut } from "@/lib/auth-client";

/**
 * The mindmap library: a floating sheet hung off a trigger in the top-left of
 * the canvas. It owns the whole CRUD surface — create, pick, rename, delete —
 * so the canvas underneath stays exactly one thing.
 */
export function MindmapLibrary({ user }: { user: { email: string } }) {
  const { libraryOpen: open } = useWorkspaceRoute();
  const activeMindmap = useActiveMindmap();

  return (
    <Sheet open={open} onOpenChange={setLibraryOpen}>
      <SheetTrigger asChild>
        {/* A nav control, not a CTA: `nav-link` type on {colors.canvas} with the
            Elevation level-1 hairline. Filling it or lifting it with a shadow
            would put a second competing surface on top of the canvas. */}
        <button
          type="button"
          className="inline-flex h-11 max-w-[min(20rem,60vw)] items-center gap-2 rounded-md border border-hairline bg-paper pr-4 pl-3 text-left outline-none transition-[color,background-color,border-color,transform] duration-[160ms] ease-out-strong hover:bg-cloud active:scale-[0.97] active:bg-fog focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PanelLeft className="size-4 shrink-0 text-graphite" />
          <span className="truncate text-body-md">
            {activeMindmap?.title ?? "Mindmaps"}
          </span>
        </button>
      </SheetTrigger>

      <LibraryPanel
        open={open}
        user={user}
        activeMindmapId={activeMindmap?._id ?? null}
        onOpenMindmap={openMindmap}
      />
    </Sheet>
  );
}

/**
 * Row state lives here rather than inside `SheetContent` because the sheet's
 * Escape handler has to see it — but `SheetContent` unmounts when the sheet
 * closes, so it gets cleared on the way out instead. The rows themselves do
 * unmount, which is what makes their entrance replay on every open.
 */
function LibraryPanel({
  open,
  user,
  activeMindmapId,
  onOpenMindmap,
}: {
  open: boolean;
  user: { email: string };
  activeMindmapId: string | null;
  onOpenMindmap: (id: string) => void;
}) {
  const { data: mindmaps, isPending, isError, refetch } = useMindmaps();
  const createMindmap = useCreateMindmap();
  const updateMindmap = useUpdateMindmap();
  const deleteMindmap = useDeleteMindmap();

  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState<{ id: string; mode: RowMode } | null>(
    null,
  );
  const { leavingId, requestDelete } = useDeferredRowDelete((id) =>
    deleteMindmap.mutate(id),
  );

  useEffect(() => {
    if (!open) setEditing(null);
  }, [open]);

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    createMindmap.mutate(trimmed, {
      onSuccess: (created) => {
        setTitle("");
        onOpenMindmap(created._id);
      },
    });
  }

  function handleDelete(id: string) {
    setEditing(null);
    requestDelete(id);
  }

  return (
    <SheetContent
      onEscapeKeyDown={(event) => {
        // Escape belongs to the innermost thing that is open. With a row
        // mid-rename it undoes the rename; the sheet only closes on the second
        // press.
        if (!editing) return;
        event.preventDefault();
        setEditing(null);
      }}
    >
      <SheetHeader>
        <div className="min-w-0">
          <SheetTitle>Mindmaps</SheetTitle>
          {/* Height is reserved so the count arriving doesn't shove the list
              down a line on first open. */}
          <SheetDescription className="mt-1 min-h-5">
            {mindmaps ? countLabel(mindmaps.length) : null}
          </SheetDescription>
        </div>
        <SheetCloseButton />
      </SheetHeader>

      <form onSubmit={handleCreate} className="flex gap-2 px-5 pt-4 pb-1">
        <Input
          placeholder="New mindmap"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={createMindmap.isPending}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Create mindmap"
          disabled={createMindmap.isPending || !title.trim()}
        >
          {createMindmap.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Plus />
          )}
        </Button>
      </form>

      <SheetBody className="px-2">
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-graphite" />
          </div>
        ) : isError ? (
          <div className="px-3 py-6 text-center">
            <p className="text-caption-md text-destructive">
              Could not load your mindmaps.
            </p>
            <Button
              variant="link"
              className="mt-1"
              onClick={() => void refetch()}
            >
              <RotateCw /> Try again
            </Button>
          </div>
        ) : mindmaps.length === 0 ? (
          <p className="px-3 py-6 text-center text-caption-md text-graphite">
            No mindmaps yet. Name one above to get started.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {mindmaps.map((mindmap, index) => (
              <MindmapRow
                key={mindmap._id}
                mindmap={mindmap}
                index={index}
                active={mindmap._id === activeMindmapId}
                leaving={mindmap._id === leavingId}
                mode={editing?.id === mindmap._id ? editing.mode : null}
                onModeChange={(mode) =>
                  setEditing(mode ? { id: mindmap._id, mode } : null)
                }
                onSelect={() => onOpenMindmap(mindmap._id)}
                onRename={(newTitle) =>
                  updateMindmap.mutate({ id: mindmap._id, title: newTitle })
                }
                onDelete={() => handleDelete(mindmap._id)}
              />
            ))}
          </ul>
        )}
      </SheetBody>

      <SheetFooter className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-caption-md text-graphite">
          {user.email}
        </p>
        <SignOutButton />
      </SheetFooter>
    </SheetContent>
  );
}

function SignOutButton() {
  const [signingOut, setSigningOut] = useState(false);

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={signingOut}
      onClick={async () => {
        setSigningOut(true);
        await signOut();
        setSigningOut(false);
      }}
    >
      {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
      Sign out
    </Button>
  );
}

function countLabel(count: number) {
  return count === 1 ? "1 mindmap" : `${count} mindmaps`;
}
