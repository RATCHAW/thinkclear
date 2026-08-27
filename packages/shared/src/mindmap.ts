import { z } from "zod";

const title = z.string().trim().min(1, "Title is required").max(200);

export const createMindmapSchema = z.object({ title });

/**
 * PATCH semantics: every field is optional, but an empty body is a no-op and
 * almost always a client bug, so it is rejected rather than silently accepted.
 */
export const updateMindmapSchema = z
  .object({ title })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export type CreateMindmapInput = z.infer<typeof createMindmapSchema>;
export type UpdateMindmapInput = z.infer<typeof updateMindmapSchema>;
