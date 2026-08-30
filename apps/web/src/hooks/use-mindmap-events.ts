import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  isForeignMindmapChange,
  MINDMAP_CHANGED_EVENT,
  type MindmapChangedEvent,
} from "@thinkclear/shared";
import {
  mindmapKeys,
  saveGraphMutationKey,
  type Mindmap,
} from "@/hooks/use-mindmaps";

/**
 * Holds one EventSource on `/api/events` for the whole signed-in session and
 * turns each foreign change into an invalidation of the mindmap list — the
 * same beat the assistant panel plays after a mutating chat tool, which is
 * what makes an MCP client's edit land on the canvas the way an assistant
 * edit already does. The refetched document carries a foreign `updatedAt`,
 * and the canvas' reconcile effect does the rest.
 *
 * Echoes of this client's own saves are filtered by
 * `isForeignMindmapChange`; the in-flight half of that check reads the
 * graph-save mutation state, which is why that mutation carries a key.
 *
 * Reconnection is EventSource's own: it retries dropped connections and gives
 * up on an error response, so an expired session doesn't poll forever.
 */
export function useMindmapEvents() {
  const queryClient = useQueryClient();
  useEffect(() => {
    // Absent in the node test environment; the hook is then simply inert.
    if (typeof EventSource === "undefined") return;
    const source = new EventSource("/api/events");
    source.addEventListener(MINDMAP_CHANGED_EVENT, (event: Event) => {
      const change = JSON.parse(
        (event as MessageEvent<string>).data,
      ) as MindmapChangedEvent;
      const savingThisMindmap =
        queryClient.isMutating({
          mutationKey: saveGraphMutationKey,
          predicate: (mutation) =>
            (mutation.state.variables as { id?: string } | undefined)?.id ===
            change.mindmapId,
        }) > 0;
      const cached = queryClient.getQueryData<Mindmap[]>(mindmapKeys.all);
      if (!isForeignMindmapChange(change, cached, savingThisMindmap)) return;
      void queryClient.invalidateQueries({ queryKey: mindmapKeys.all });
    });
    return () => source.close();
  }, [queryClient]);
}
