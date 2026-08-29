import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistantPanel } from "@/components/assistant-panel";
import { MindmapCanvas } from "@/components/mindmap-canvas";
import { MindmapLibrary } from "@/components/mindmap-library";
import { useActiveMindmap } from "@/hooks/use-mindmaps";
import {
  setAssistantOpen,
  setLibraryOpen,
  useWorkspaceRoute,
} from "@/hooks/use-workspace-route";

/**
 * The signed-in shell: the canvas is the page, and everything else floats over
 * it. Controls sit in a top strip that is itself click-through, so the canvas
 * keeps every pixel it isn't actually covering.
 *
 * Both floating surfaces are app-level rather than canvas-level — the library
 * on the left owns every mindmap, and the assistant on the right can act on
 * every mindmap — so they stay reachable whether or not a map is open.
 */
export function WorkspacePage({
  user,
}: {
  user: { email: string; name: string };
}) {
  const activeMindmap = useActiveMindmap();
  const { assistantOpen } = useWorkspaceRoute();

  return (
    <div className="relative h-svh w-full overflow-hidden">
      <MindmapCanvas />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-2">
        <div className="pointer-events-auto">
          <MindmapLibrary user={user} />
        </div>
        {/* Same nav-control treatment as the library trigger on the left. */}
        {!assistantOpen && (
          <button
            type="button"
            onClick={() => setAssistantOpen(true)}
            className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-md border border-hairline bg-paper px-4 outline-none transition-[color,background-color,border-color,transform] duration-[160ms] ease-out-strong hover:bg-cloud active:scale-[0.97] active:bg-fog focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Sparkles className="size-4 shrink-0 text-primary" />
            <span className="text-body-md">Assistant</span>
          </button>
        )}
      </div>

      {/* Mounted regardless of `assistantOpen` so the conversation survives
          closing and reopening the panel. */}
      <AssistantPanel />

      {!activeMindmap && (
        <div className="animate-fade-in pointer-events-none absolute inset-0 flex items-center justify-center p-4">
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
