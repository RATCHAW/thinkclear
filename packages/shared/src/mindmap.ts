import { z } from "zod";

const title = z.string().trim().min(1, "Title is required").max(200);

/** The id every mindmap's root node is created with. */
export const ROOT_NODE_ID = "root";

/**
 * A mindmap is deliberately just titles linked together: nodes carry a title
 * and a canvas position, edges connect two node ids. Anything richer (colors,
 * notes, node kinds) can be layered on later without reshaping the document.
 */
export const mindmapNodeSchema = z.object({
  id: z.string().min(1),
  title,
  x: z.number().finite(),
  y: z.number().finite(),
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
