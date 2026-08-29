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

  test("writes a topic note as markdown and saves it with the graph", async () => {
    const api = createFakeApi({ mindmaps: [mindmapFixture()] });
    vi.stubGlobal("fetch", vi.fn(api.fetch));
    visit("/mindmaps/mindmap-1");
    const screen = await render(<WorkspacePage user={user} />, {
      wrapper: testProviders(),
    });

    await expect.element(screen.getByText("Roadmap").nth(1)).toBeVisible();
    const rootNode =
      screen.container.querySelector<HTMLElement>(".react-flow__node");
    await userEvent.click(rootNode!);
    await screen.getByRole("button", { name: "Add note" }).click();

    // Opening a note is a navigation, so it is linkable and Back closes it.
    await expect.poll(currentUrl).toBe("/mindmaps/mindmap-1?note=root");

    const note = screen.getByRole("textbox", { name: "Note" });
    await expect.element(note).toBeVisible();
    await note.fill("Ship the **API** first.");

    // The source is the document: what is typed is stored verbatim, with no
    // serializer in between that could normalize it. Two debounces to clear —
    // the note into the topic, then the graph onto the wire.
    await expect
      .poll(() => api.graphPatches.at(-1)?.nodes?.[0]?.note, { timeout: 5000 })
      .toBe("Ship the **API** first.");

    // And the topic now says it carries one.
    await expect.element(screen.getByText("Has a note")).toBeInTheDocument();

    // Emptying the note removes it rather than storing "", which is what keeps
    // "has a note" a single truthy check — on the pill here, on the node in
    // Mongo, and in the (note) marker the assistant reads.
    await note.fill("");
    await expect
      .poll(() => api.mindmaps()[0]?.nodes[0], { timeout: 5000 })
      .not.toHaveProperty("note");
    expect(screen.getByText("Has a note").query()).toBe(null);
  });

  test("opens a note straight from a link, over a canvas it does not displace", async () => {
    const api = createFakeApi({ mindmaps: [notedMindmap()] });
    vi.stubGlobal("fetch", vi.fn(api.fetch));
    visit("/mindmaps/mindmap-1?note=root");
    const screen = await render(<WorkspacePage user={user} />, {
      wrapper: testProviders(),
    });

    // A link to a note opens it ready to write, on its source.
    const window_ = screen.getByRole("dialog", { name: "Note on Roadmap" });
    await expect
      .element(window_.getByRole("textbox", { name: "Note" }))
      .toHaveValue("# Ship it");

    // The window floats over the canvas rather than taking a side of it, so
    // unlike the panel it replaced it costs the assistant nothing.
    await expect
      .element(screen.getByRole("button", { name: "Assistant" }))
      .toBeVisible();

    await screen.getByRole("button", { name: "Close note on Roadmap" }).click();
    await expect.poll(currentUrl).toBe("/mindmaps/mindmap-1");
  });

  test("stacks a window per note, and raises whichever is pressed", async () => {
    const api = createFakeApi({ mindmaps: [twoNotedMindmap()] });
    vi.stubGlobal("fetch", vi.fn(api.fetch));
    visit("/mindmaps/mindmap-1?note=root,backend");
    const screen = await render(<WorkspacePage user={user} />, {
      wrapper: testProviders(),
    });

    // Opening a second note does not take the first one's place: both windows
    // are up, and the second cascades clear of the first so the title bar
    // underneath stays visible and grabbable.
    const first = screen.getByRole("dialog", { name: "Note on Roadmap" });
    const second = screen.getByRole("dialog", { name: "Note on Backend" });
    await expect.element(first).toBeVisible();
    await expect.element(second).toBeVisible();

    const box = async (locator: typeof first) => {
      const element = (await locator.element()) as HTMLElement;
      const { x, y } = element.getBoundingClientRect();
      return { x, y, z: Number(element.style.zIndex) };
    };
    const [a, b] = [await box(first), await box(second)];
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBeGreaterThan(a.y);
    // Route order is stacking order, so the one opened last is in front.
    expect(b.z).toBeGreaterThan(a.z);

    // Pressing the buried one brings it forward. The press lands on the strip
    // the cascade left uncovered — which is the whole reason to cascade, and
    // is why this is the corner rather than the middle, where the window in
    // front would swallow it.
    await first.click({ position: { x: 10, y: 10 } });
    await expect.poll(async () => (await box(first)).z > (await box(second)).z);
    expect(currentUrl()).toBe("/mindmaps/mindmap-1?note=backend,root");

    // Closing one leaves the other exactly where it was.
    await screen.getByRole("button", { name: "Close note on Roadmap" }).click();
    await expect.poll(currentUrl).toBe("/mindmaps/mindmap-1?note=backend");
    await expect.element(second).toBeVisible();
  });

  test("previews a note on hover and opens the window from it", async () => {
    const api = createFakeApi({ mindmaps: [notedMindmap()] });
    vi.stubGlobal("fetch", vi.fn(api.fetch));
    visit("/mindmaps/mindmap-1");
    const screen = await render(<WorkspacePage user={user} />, {
      wrapper: testProviders(),
    });

    await expect.element(screen.getByText("Roadmap").nth(1)).toBeVisible();
    const rootNode =
      screen.container.querySelector<HTMLElement>(".react-flow__node");

    // Nothing is open yet — the preview is a consequence of hovering, not of
    // the topic merely having a note.
    expect(screen.getByRole("heading", { name: "Ship it" }).query()).toBe(null);

    await userEvent.hover(rootNode!);
    await expect
      .element(screen.getByRole("heading", { name: "Ship it", level: 1 }))
      .toBeVisible();
    // Reading a note costs no navigation; only editing one does.
    expect(currentUrl()).toBe("/mindmaps/mindmap-1");

    await screen.getByRole("button", { name: "Edit" }).click();
    await expect.poll(currentUrl).toBe("/mindmaps/mindmap-1?note=root");
    await expect
      .element(screen.getByRole("dialog", { name: "Note on Roadmap" }))
      .toBeVisible();
  });

  test("switches the note window between raw markdown and its rendering", async () => {
    const api = createFakeApi({ mindmaps: [notedMindmap()] });
    vi.stubGlobal("fetch", vi.fn(api.fetch));
    visit("/mindmaps/mindmap-1?note=root");
    const screen = await render(<WorkspacePage user={user} />, {
      wrapper: testProviders(),
    });

    // A note is opened in order to be written, so Edit is where it lands —
    // showing the markdown source itself, hashes and all.
    const window_ = screen.getByRole("dialog", { name: "Note on Roadmap" });
    const source = window_.getByRole("textbox", { name: "Note" });
    await expect.element(source).toHaveValue("# Ship it");

    // Preview renders the *live draft*, not the saved note, so it never waits
    // on a debounce and the two tabs cannot disagree.
    await source.fill("# Ship it\n\nAnd then **iterate**.");
    await window_.getByRole("button", { name: "preview" }).click();
    await expect
      .element(window_.getByRole("heading", { name: "Ship it", level: 1 }))
      .toBeVisible();
    await expect.element(window_.getByText("iterate")).toBeVisible();
    expect(window_.getByRole("textbox", { name: "Note" }).query()).toBe(null);

    // And back, with the source intact.
    await window_.getByRole("button", { name: "edit" }).click();
    await expect
      .element(window_.getByRole("textbox", { name: "Note" }))
      .toHaveValue("# Ship it\n\nAnd then **iterate**.");
  });
});

/** Two topics that both carry notes, for the multi-window journeys. */
function twoNotedMindmap() {
  return mindmapFixture({
    nodes: [
      { id: "root", title: "Roadmap", x: 0, y: 0, note: "# Ship it" },
      { id: "backend", title: "Backend", x: 0, y: 104, note: "# Queues" },
    ],
    edges: [{ id: "e1", source: "root", target: "backend" }],
  });
}

/** A mindmap whose root already carries a note, for the read-side journeys. */
function notedMindmap() {
  return mindmapFixture({
    nodes: [{ id: "root", title: "Roadmap", x: 0, y: 0, note: "# Ship it" }],
  });
}

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
