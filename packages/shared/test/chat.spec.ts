import { describe, expect, it } from "vitest";
import { chatRequestSchema, MUTATING_CHAT_TOOLS } from "../src/chat";

const message = (over: object = {}) => ({
  id: "m1",
  role: "user",
  parts: [{ type: "text", text: "hi" }],
  ...over,
});

describe("chatRequestSchema", () => {
  it("accepts a useChat body and passes unknown part fields through", () => {
    const parsed = chatRequestSchema.parse({
      id: "chat-1",
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

    expect(parsed.mindmapId).toBe("abc");
    expect(parsed.messages[1].parts[0]).toMatchObject({ toolCallId: "t1" });
  });

  it("allows the mindmap context to be absent or null", () => {
    expect(
      chatRequestSchema.parse({ messages: [message()] }).mindmapId,
    ).toBeUndefined();
    expect(
      chatRequestSchema.parse({ mindmapId: null, messages: [message()] })
        .mindmapId,
    ).toBeNull();
  });

  it("rejects an empty conversation and unknown roles", () => {
    expect(chatRequestSchema.safeParse({ messages: [] }).success).toBe(false);
    expect(
      chatRequestSchema.safeParse({ messages: [message({ role: "tool" })] })
        .success,
    ).toBe(false);
  });

  it("rejects messages without parts", () => {
    expect(
      chatRequestSchema.safeParse({
        messages: [{ id: "m1", role: "user", content: "legacy shape" }],
      }).success,
    ).toBe(false);
  });

  it("names only tools that exist on the server", () => {
    // Guards the web ↔ api contract: the client invalidates its cache when a
    // tool in this list finishes, so a rename here must be a rename there.
    expect(MUTATING_CHAT_TOOLS).toEqual([
      "create_mindmap",
      "rename_mindmap",
      "delete_mindmap",
      "add_topics",
      "rename_topic",
      "move_topic",
      "delete_topics",
    ]);
  });
});
