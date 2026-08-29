import { z } from "zod";

const title = z.string().trim().min(1, "Title is required").max(200);

/** What a conversation is called until it has a first message to name it. */
export const DEFAULT_CONVERSATION_TITLE = "New chat";

/**
 * How many messages a conversation keeps. The chat route replays the stored
 * history to the model on every turn, so this is the same number the request
 * schema caps `messages` at — a conversation that could be stored but not
 * re-sent would break on its next turn instead of at the write that grew it.
 * Older messages fall off the front.
 */
export const MAX_CONVERSATION_MESSAGES = 200;

/**
 * A conversation is created empty and titled up front: the client derives a
 * title from the message it is about to send, so the history list never shows
 * a row the user cannot tell apart. Omitting it is allowed and falls back to
 * `DEFAULT_CONVERSATION_TITLE`.
 */
export const createConversationSchema = z.object({
  title: title.optional(),
});

/** Only the title is editable — messages are written by the chat route. */
export const updateConversationSchema = z.object({ title });

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;

/** Longest auto-derived title, in characters, before it is cut short. */
const TITLE_LENGTH = 48;

/**
 * Names a conversation after the message that started it, the way every chat
 * app does. Kept here rather than on either end because both sides lean on it:
 * the web app titles the conversation it creates, and the API falls back to
 * the same rule for a client that sends none.
 */
export function conversationTitleFromMessage(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (!collapsed) return DEFAULT_CONVERSATION_TITLE;
  if (collapsed.length <= TITLE_LENGTH) return collapsed;

  const cut = collapsed.slice(0, TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  // Break on a word boundary, but only one that is actually near the limit —
  // an unbroken run of characters would otherwise collapse to a stub.
  const kept = lastSpace > TITLE_LENGTH / 2 ? cut.slice(0, lastSpace) : cut;
  return `${kept.trimEnd()}…`;
}
