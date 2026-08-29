import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react/pure";
import { WorkspacePage } from "@/components/workspace-page";
import { currentUrl, visit } from "./browser-url";
import { conversationFixture, createFakeApi } from "./fake-api";

vi.mock("@/lib/auth-client", () => ({ signOut: vi.fn() }));

describe("assistant journey", () => {
  beforeEach(() => {
    visit("/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("starts a chat with no mindmap open and files it in history", async () => {
    const api = createFakeApi({ reply: "Created “Testing”." });
    vi.stubGlobal("fetch", vi.fn(api.fetch));
    const screen = await render(<WorkspacePage user={user} />, {
      wrapper: testProviders(),
    });

    // The assistant is app chrome: it is reachable with nothing on the canvas.
    await screen.getByRole("button", { name: "Assistant" }).click();
    await expect
      .element(screen.getByText("Manage your mindmaps by talking"))
      .toBeVisible();

    await screen
      .getByPlaceholder("Ask for a mindmap, or about the ones you have…")
      .fill("create a mindmap about testing");
    await screen.getByRole("button", { name: "Submit" }).click();

    await expect.element(screen.getByText("Created “Testing”.")).toBeVisible();

    // The conversation was created before the turn was sent, titled after the
    // message, and the turn was addressed to it.
    await expect.poll(() => api.conversations().length).toBe(1);
    const [conversation] = api.conversations();
    expect(conversation.title).toBe("create a mindmap about testing");
    expect(api.chatRequests).toHaveLength(1);
    expect(api.chatRequests[0]).toMatchObject({
      conversationId: conversation._id,
      mindmapId: null,
    });

    // …and it is now in history, named after the message that started it.
    await screen.getByRole("button", { name: "Chat history" }).click();
    await expect
      .element(
        screen.getByRole("button", {
          name: "Open create a mindmap about testing",
        }),
      )
      .toBeVisible();

    // Which chat you are in, and which surface is showing it, is all in the
    // URL — this session can be linked to and reopened exactly as it stands.
    expect(currentUrl()).toBe(`/?assistant=history&chat=${conversation._id}`);
  });

  test("reopens, renames, and deletes a stored chat", async () => {
    const api = createFakeApi({ conversations: [conversationFixture()] });
    vi.stubGlobal("fetch", vi.fn(api.fetch));
    const screen = await render(<WorkspacePage user={user} />, {
      wrapper: testProviders(),
    });

    await screen.getByRole("button", { name: "Assistant" }).click();
    await screen.getByRole("button", { name: "Chat history" }).click();
    await screen.getByRole("button", { name: "Open Earlier chat" }).click();

    // Reopening a chat replays what the server stored, not an empty panel.
    await expect.element(screen.getByText("what do I have?")).toBeVisible();
    await expect.element(screen.getByText("One mindmap.")).toBeVisible();

    await screen.getByRole("button", { name: "Chat history" }).click();
    await screen.getByRole("button", { name: "Rename Earlier chat" }).click();
    const title = screen.getByRole("textbox", { name: "Chat title" });
    await title.fill("Inventory");
    await userEvent.keyboard("{Enter}");

    await expect
      .element(screen.getByRole("button", { name: "Open Inventory" }))
      .toBeVisible();
    await expect.poll(() => api.conversations()[0]?.title).toBe("Inventory");

    await screen.getByRole("button", { name: "Delete Inventory" }).click();
    await screen.getByRole("button", { name: "Delete", exact: true }).click();

    await expect
      .element(screen.getByText("No chats yet.", { exact: false }))
      .toBeVisible();
    // Deleting the open chat drops the panel back to a fresh one — no chat in
    // the URL, and nothing left pointing at the conversation that is gone.
    await expect.poll(() => api.conversations()).toEqual([]);
    await expect.poll(currentUrl).toBe("/?assistant");
  });

  // `MUTATING_CHAT_TOOLS` is the web ↔ api contract: the server's tools write
  // straight to Mongo, and a finished call named there is how the rest of the
  // app hears about it.
  test("picks up a mindmap the assistant created mid-answer", async () => {
    const api = createFakeApi({
      reply: "Done — it is on your canvas.",
      tool: { name: "create_mindmap", title: "Learning TypeScript" },
    });
    vi.stubGlobal("fetch", vi.fn(api.fetch));
    const screen = await render(<WorkspacePage user={user} />, {
      wrapper: testProviders(),
    });

    await screen.getByRole("button", { name: "Assistant" }).click();
    await screen
      .getByPlaceholder("Ask for a mindmap, or about the ones you have…")
      .fill("create a mindmap about learning TypeScript");
    await screen.getByRole("button", { name: "Submit" }).click();

    // The tool call reports itself in the transcript…
    await expect
      .element(screen.getByText("Created “Learning TypeScript”"))
      .toBeVisible();

    // …and the map it made is now the one on the canvas, without the user
    // having gone anywhere near the library. The chat it came out of stays
    // open beside it — nothing about opening a mindmap dismisses the panel.
    const [created] = api.mindmaps();
    const [conversation] = api.conversations();
    await expect
      .poll(currentUrl)
      .toBe(`/mindmaps/${created?._id}?assistant&chat=${conversation?._id}`);
    await expect
      .element(
        screen.getByRole("button", {
          name: "Learning TypeScript",
          exact: true,
        }),
      )
      .toBeVisible();
  });
});

const user = { email: "ada@example.com", name: "Ada" };

function testProviders() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return function TestProviders({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}
