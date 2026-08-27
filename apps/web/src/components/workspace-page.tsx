import { Button } from "@/components/ui/button";
import { MindmapCanvas } from "@/components/mindmap-canvas";
import { MindmapLibrary } from "@/components/mindmap-library";
import { useActiveMindmap } from "@/hooks/use-mindmaps";
import { useUiStore } from "@/stores/ui-store";

/**
 * The signed-in shell: the canvas is the page, and everything else floats over
 * it. Controls sit in a top strip that is itself click-through, so the canvas
 * keeps every pixel it isn't actually covering.
 */
export function WorkspacePage({
  user,
}: {
  user: { email: string; name: string };
}) {
  const activeMindmap = useActiveMindmap();
  const setLibraryOpen = useUiStore((state) => state.setLibraryOpen);

  return (
    <div className="relative h-svh w-full overflow-hidden">
      <MindmapCanvas />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start p-2">
        <div className="pointer-events-auto">
          <MindmapLibrary user={user} />
        </div>
      </div>

      {!activeMindmap && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
          <div className="pointer-events-auto max-w-sm text-center">
            <h1 className="text-display-sm">No mindmap open</h1>
            <p className="mt-2 text-body-md text-graphite">
              Pick one from your library, or start a new one.
            </p>
            <Button className="mt-6" onClick={() => setLibraryOpen(true)}>
              Open library
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
