import { z } from "zod";
import { MAX_CONVERSATION_MESSAGES } from "./conversation";

/**
 * The body `useChat` posts to `POST /api/chat`. The AI SDK owns the full
 * `UIMessage` shape (parts, tool states, metadata) and it evolves with the
 * library, so validating it structurally here would just re-state the SDK's
 * types and drift. This schema checks only what the server actually relies on
 * — a conversation to append to, a bounded list of role-tagged part-carrying
 * messages, and an optional mindmap id for context — and `loose` passes the
 * rest through untouched for the SDK's own `validateUIMessages` to interpret.
 *
 * `conversationId` is required, not optional: every turn is persisted, so
 * there is no such thing as a chat that is not part of the user's history.
 * The client creates the conversation before it sends the first message.
 */
export const chatRequestSchema = z.object({
  id: z.string().optional(),
  /** The conversation this turn is appended to. Must belong to the caller. */
  conversationId: z.string().min(1),
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
    .max(MAX_CONVERSATION_MESSAGES),
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
  "rename_topics",
  "move_topics",
  "delete_topics",
  "set_topic_note",
] as const;

export type MutatingChatTool = (typeof MUTATING_CHAT_TOOLS)[number];
