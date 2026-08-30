/**
 * The web ↔ api contract for `GET /api/events`, the SSE stream that tells a
 * signed-in browser one of its mindmaps changed on the server — an assistant
 * turn, an MCP client, another tab. The event is deliberately tiny: the
 * client's whole reaction is to refetch, so the canvas' `updatedAt`
 * reconciliation stays the single place server edits merge into local state,
 * and the stream never becomes a second write path into the graph.
 */
export const MINDMAP_CHANGED_EVENT = "mindmap";

export type MindmapChangedEvent = {
  mindmapId: string;
  /** The write's `updatedAt`, or null when the mindmap was deleted. */
  updatedAt: string | null;
};

/**
 * Whether a change announced on the stream is news — a write this client
 * didn't make — as opposed to the echo of its own. The distinction matters
 * because refetching on an echo is worse than wasted: the refetch can land
 * before the save's own response has advanced the canvas' `syncedAt`, at
 * which point the canvas reads its own write as someone else's and reseeds,
 * eating whatever was typed since the flush.
 *
 * Two checks close that loop. A save in flight for this mindmap means the
 * event is (or is about to be superseded by) the client's own write — the
 * save's response is the authoritative document either way. And a cached
 * copy already carrying the event's `updatedAt` means the write has been
 * absorbed, which is how the echo looks once the save has settled.
 */
export function isForeignMindmapChange(
  change: MindmapChangedEvent,
  cached: readonly { _id: string; updatedAt: string }[] | undefined,
  savingThisMindmap: boolean,
): boolean {
  if (savingThisMindmap) return false;
  const known = cached?.find((mindmap) => mindmap._id === change.mindmapId);
  if (change.updatedAt === null) return known !== undefined;
  return !known || known.updatedAt !== change.updatedAt;
}
