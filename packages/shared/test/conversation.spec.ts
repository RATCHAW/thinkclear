import { describe, expect, it } from "vitest";
import {
  conversationTitleFromMessage,
  createConversationSchema,
  DEFAULT_CONVERSATION_TITLE,
  MAX_CONVERSATION_MESSAGES,
  updateConversationSchema,
} from "../src/conversation";
import { chatRequestSchema } from "../src/chat";

describe("conversation schemas", () => {
  it("lets a conversation be created untitled", () => {
    expect(createConversationSchema.parse({}).title).toBeUndefined();
    expect(createConversationSchema.parse({ title: "  Ideas  " }).title).toBe(
      "Ideas",
    );
  });

  it("requires a title to rename and rejects a blank one", () => {
    expect(updateConversationSchema.parse({ title: " Ideas " })).toEqual({
      title: "Ideas",
    });
    expect(updateConversationSchema.safeParse({ title: "   " }).success).toBe(
      false,
    );
    expect(updateConversationSchema.safeParse({}).success).toBe(false);
  });

  it("caps stored history at exactly what a turn may replay", () => {
    // The chat route re-sends the stored conversation on every turn, so a
    // conversation that could be written but not sent would break on its next
    // message instead of at the write that grew it.
    const message = (id: number) => ({
      id: `m${id}`,
      role: "user" as const,
      parts: [{ type: "text", text: "hi" }],
    });
    const messages = Array.from({ length: MAX_CONVERSATION_MESSAGES }, (_, i) =>
      message(i),
    );

    expect(
      chatRequestSchema.safeParse({ conversationId: "c1", messages }).success,
    ).toBe(true);
    expect(
      chatRequestSchema.safeParse({
        conversationId: "c1",
        messages: [...messages, message(MAX_CONVERSATION_MESSAGES)],
      }).success,
    ).toBe(false);
  });
});

describe("conversationTitleFromMessage", () => {
  it("uses a short message as the title, with whitespace collapsed", () => {
    expect(conversationTitleFromMessage("  Plan   a  launch\nmindmap ")).toBe(
      "Plan a launch mindmap",
    );
  });

  it("falls back when there is nothing to name it after", () => {
    expect(conversationTitleFromMessage("   \n  ")).toBe(
      DEFAULT_CONVERSATION_TITLE,
    );
  });

  it("cuts a long message on a word boundary", () => {
    const title = conversationTitleFromMessage(
      "Create a mindmap about learning TypeScript from the very beginning",
    );

    expect(title).toBe("Create a mindmap about learning TypeScript from…");
    expect(title.endsWith(" …")).toBe(false);
  });

  it("cuts mid-token rather than collapsing to a stub", () => {
    const title = conversationTitleFromMessage(`a ${"x".repeat(100)}`);

    // The only word boundary sits at index 1, far below the limit — breaking
    // there would title the chat "a…".
    expect(title).toBe(`a ${"x".repeat(46)}…`);
  });
});
