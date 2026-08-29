import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react/pure";
import { WorkspacePage } from "@/components/workspace-page";
import { currentUrl, visit } from "./browser-url";
import { createFakeApi, mindmapFixture } from "./fake-api";

const auth = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({
  signOut: auth.signOut,
}));

describe("mindmap workspace journey", () => {
  beforeEach(() => {
    auth.signOut.mockReset();
    auth.signOut.mockResolvedValue({ data: {}, error: null });
    visit("/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("creates, selects, renames, and deletes a mindmap", async () => {
    const api = createFakeApi();
    vi.stubGlobal("fetch", vi.fn(api.fetch));
    const screen = await render(<WorkspacePage user={user} />, {
      wrapper: testProviders(),
    });

    await expect
      .element(screen.getByRole("heading", { name: "No mindmap open" }))
      .toBeVisible();
    await screen.getByRole("button", { name: "Open library" }).click();
    await expect
      .element(
        screen.getByText("No mindmaps yet. Name one above to get started."),
      )
      .toBeVisible();

    await screen.getByPlaceholder("New mindmap").fill("Roadmap");
    await screen.getByRole("button", { name: "Create mindmap" }).click();

    await expect
      .element(screen.getByRole("button", { name: "Roadmap", exact: true }))
      .toBeVisible();
    expect(api.mindmaps()).toHaveLength(1);

    // Creating opens the new mindmap, and opening one is a navigation: the
    // canvas is addressable, and the library that made the choice has closed
    // behind it.
    await expect.poll(currentUrl).toBe(`/mindmaps/${api.mindmaps()[0]?._id}`);

    // Which is why the trigger now reads "Roadmap" rather than "Mindmaps".
    await screen.getByRole("button", { name: "Roadmap", exact: true }).click();
    await expect.element(screen.getByText("1 mindmap")).toBeVisible();
    await screen.getByRole("button", { name: "Rename Roadmap" }).click();
    const title = screen.getByRole("textbox", { name: "Mindmap title" });
    await title.fill("Launch plan");
    await userEvent.keyboard("{Enter}");

    await expect
      .element(screen.getByRole("button", { name: "Launch plan", exact: true }))
      .toBeVisible();
    await expect.poll(() => api.mindmaps()[0]?.title).toBe("Launch plan");

    await screen.getByRole("button", { name: "Delete Launch plan" }).click();
    await screen.getByRole("button", { name: "Delete", exact: true }).click();

    await expect.element(screen.getByText("0 mindmaps")).toBeVisible();
    expect(api.mindmaps()).toEqual([]);
  });

  test("edits a branch and autosaves the graph", async () => {
    const api = createFakeApi({ mindmaps: [mindmapFixture()] });
    vi.stubGlobal("fetch", vi.fn(api.fetch));
    visit("/mindmaps/mindmap-1");
    const screen = await render(<WorkspacePage user={user} />, {
      wrapper: testProviders(),
    });

    await expect.element(screen.getByText("Roadmap").nth(1)).toBeVisible();
    const rootNode =
      screen.container.querySelector<HTMLElement>(".react-flow__node");
    expect(rootNode).not.toBeNull();
    await userEvent.click(rootNode!);
    await screen.getByRole("button", { name: "Add branch" }).click();
    const editor = screen.getByRole("textbox");
    await editor.fill("Testing");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => api.graphPatches.length).toBe(1);
    expect(api.graphPatches[0]?.nodes?.map((node) => node.title)).toEqual([
      "Roadmap",
      "Testing",
    ]);
    expect(api.graphPatches[0]?.edges).toHaveLength(1);
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
