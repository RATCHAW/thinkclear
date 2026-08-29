import { z } from "zod";

const title = z.string().trim().min(1, "Title is required").max(200);

/** The id every mindmap's root node is created with. */
export const ROOT_NODE_ID = "root";

/**
 * Cap on one topic's note. Notes ride inside the mindmap document, and the
 * list route returns every mindmap in full, so this is really a bound on how
 * heavy that response can get — generous for a note, far short of Mongo's
 * 16 MB document limit even with all 500 topics carrying one.
 */
export const MAX_NOTE_LENGTH = 5000;

/**
 * A mindmap is titles linked together, plus an optional note per topic: nodes
 * carry a title, a canvas position, and markdown prose; edges connect two node
 * ids. Anything richer (colors, node kinds) can be layered on later without
 * reshaping the document.
 *
 * `note` holds **markdown source**, not rendered HTML — it is what the editor
 * serializes, what the assistant reads and writes, and what would survive an
 * export. An absent note and an empty one are the same thing, so writers omit
 * the key rather than storing `""`.
 */
export const mindmapNodeSchema = z.object({
  id: z.string().min(1),
  title,
  x: z.number().finite(),
  y: z.number().finite(),
  note: z.string().max(MAX_NOTE_LENGTH).optional(),
});

export const mindmapEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
});

export const createMindmapSchema = z.object({ title });

/**
 * PATCH semantics: every field is optional, but an empty body is a no-op and
 * almost always a client bug, so it is rejected rather than silently accepted.
 * Nodes and edges travel together as one graph snapshot from the editor.
 */
export const updateMindmapSchema = z
  .object({
    title,
    nodes: z.array(mindmapNodeSchema).max(500),
    edges: z.array(mindmapEdgeSchema).max(1000),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export type MindmapNode = z.infer<typeof mindmapNodeSchema>;
export type MindmapEdge = z.infer<typeof mindmapEdgeSchema>;
export type CreateMindmapInput = z.infer<typeof createMindmapSchema>;
export type UpdateMindmapInput = z.infer<typeof updateMindmapSchema>;
