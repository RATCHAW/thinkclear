import { describe, expect, it } from "vitest";
import { chatRequestSchema, MUTATING_CHAT_TOOLS } from "../src/chat";

const message = (over: object = {}) => ({
  id: "m1",
  role: "user",
  parts: [{ type: "text", text: "hi" }],
  ...over,
});

/** A minimal valid body, with one field swapped out per assertion. */
const body = (over: object = {}) =>
  chatRequestSchema.parse({
    conversationId: "conversation-1",
    messages: [message()],
    ...over,
  });

const reject = (over: object) =>
  !chatRequestSchema.safeParse({
    conversationId: "conversation-1",
    messages: [message()],
    ...over,
  }).success;

describe("chatRequestSchema", () => {
  it("accepts a useChat body and passes unknown part fields through", () => {
    const parsed = chatRequestSchema.parse({
      id: "chat-1",
      conversationId: "conversation-1",
      mindmapId: "abc",
      messages: [
        message(),
        message({
          id: "m2",
          role: "assistant",
          parts: [
            {
              type: "tool-add_topics",
              toolCallId: "t1",
              state: "output-available",
              output: { summary: "Added 2 topics" },
            },
          ],
        }),
      ],
    });

    expect(parsed.conversationId).toBe("conversation-1");
    expect(parsed.mindmapId).toBe("abc");
    expect(parsed.messages[1].parts[0]).toMatchObject({ toolCallId: "t1" });
  });

  it("allows the mindmap context to be absent or null", () => {
    expect(body().mindmapId).toBeUndefined();
    expect(body({ mindmapId: null }).mindmapId).toBeNull();
  });

  it("requires a conversation to append the turn to", () => {
    // Every turn is persisted, so there is no such thing as a chat that is not
    // part of the user's history.
    expect(chatRequestSchema.safeParse({ messages: [message()] }).success).toBe(
      false,
    );
    expect(reject({ conversationId: "" })).toBe(true);
  });

  it("rejects an empty message list and unknown roles", () => {
    expect(reject({ messages: [] })).toBe(true);
    expect(reject({ messages: [message({ role: "tool" })] })).toBe(true);
  });

  it("rejects messages without parts", () => {
    expect(
      reject({ messages: [{ id: "m1", role: "user", content: "legacy" }] }),
    ).toBe(true);
  });

  it("names only tools that exist on the server", () => {
    // Guards the web ↔ api contract: the client invalidates its cache when a
    // tool in this list finishes, so a rename here must be a rename there.
    expect(MUTATING_CHAT_TOOLS).toEqual([
      "create_mindmap",
      "rename_mindmap",
      "delete_mindmap",
      "add_topics",
      "rename_topics",
      "move_topics",
      "delete_topics",
      "set_topic_note",
    ]);
  });
});
