import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react/pure";
import { WorkspacePage } from "@/components/workspace-page";
import { useUiStore } from "@/stores/ui-store";
import { conversationFixture, createFakeApi } from "./fake-api";

vi.mock("@/lib/auth-client", () => ({ signOut: vi.fn() }));

describe("assistant journey", () => {
  beforeEach(() => {
    useUiStore.setState({
      selectedMindmapId: null,
      libraryOpen: false,
      assistantOpen: false,
      activeConversationId: null,
      historyOpen: false,
    });
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
    // Deleting the open chat drops the panel back to a fresh one.
    await expect.poll(() => api.conversations()).toEqual([]);
    expect(useUiStore.getState().activeConversationId).toBeNull();
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
