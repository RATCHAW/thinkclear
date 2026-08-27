import { z } from "zod";

export const createMindmapSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
});

export type CreateMindmapInput = z.infer<typeof createMindmapSchema>;
