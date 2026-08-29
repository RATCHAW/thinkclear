import { z } from "zod";

/**
 * The body `useChat` posts to `POST /api/chat`. The AI SDK owns the full
 * `UIMessage` shape (parts, tool states, metadata) and it evolves with the
 * library, so validating it structurally here would just re-state the SDK's
 * types and drift. This schema checks only what the server actually relies on
 * — a bounded list of role-tagged part-carrying messages and an optional
 * mindmap id for context — and `loose` passes the rest through untouched for
 * the SDK's own `validateUIMessages` to interpret.
 */
export const chatRequestSchema = z.object({
  id: z.string().optional(),
  /** The mindmap open in the canvas, if any — context for the system prompt. */
  mindmapId: z.string().nullish(),
  messages: z
    .array(
      z.looseObject({
        id: z.string(),
        role: z.enum(["system", "user", "assistant"]),
        parts: z.array(z.looseObject({ type: z.string() })),
      }),
    )
    .min(1)
    .max(200),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;

/**
 * Tool names the chat model can call that write to the database. The web app
 * watches streamed tool results for these names to know when to refetch — a
 * name here and a tool in `MindmapToolsService` must stay in sync.
 */
export const MUTATING_CHAT_TOOLS = [
  "create_mindmap",
  "rename_mindmap",
  "delete_mindmap",
  "add_topics",
  "rename_topic",
  "move_topic",
  "delete_topics",
] as const;

export type MutatingChatTool = (typeof MUTATING_CHAT_TOOLS)[number];
