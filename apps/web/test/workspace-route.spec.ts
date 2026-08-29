import { describe, expect, it } from "vitest";
import {
  parseWorkspaceRoute,
  workspaceRouteUrl,
  type WorkspaceRoute,
} from "../src/lib/workspace-route";

const closed: WorkspaceRoute = {
  mindmapId: null,
  conversationId: null,
  libraryOpen: false,
  assistantOpen: false,
  historyOpen: false,
  noteNodeIds: [],
};

describe("workspace route grammar", () => {
  it("addresses the open mindmap by path", () => {
    expect(workspaceRouteUrl({ ...closed, mindmapId: "mindmap-1" })).toBe(
      "/mindmaps/mindmap-1",
    );
    expect(parseWorkspaceRoute("/mindmaps/mindmap-1").mindmapId).toBe(
      "mindmap-1",
    );
  });

  it("keeps the open chat whether or not the panel is showing", () => {
    const url = workspaceRouteUrl({
      ...closed,
      conversationId: "conversation-1",
    });

    expect(url).toBe("/?chat=conversation-1");
    expect(parseWorkspaceRoute(url)).toMatchObject({
      conversationId: "conversation-1",
      assistantOpen: false,
    });
  });

  it("writes the floating surfaces as bare flags", () => {
    expect(workspaceRouteUrl({ ...closed, libraryOpen: true })).toBe(
      "/?library",
    );
    expect(workspaceRouteUrl({ ...closed, assistantOpen: true })).toBe(
      "/?assistant",
    );
    expect(
      workspaceRouteUrl({ ...closed, assistantOpen: true, historyOpen: true }),
    ).toBe("/?assistant=history");
  });

  it("round-trips a fully open workspace", () => {
    const route: WorkspaceRoute = {
      mindmapId: "mindmap-1",
      conversationId: "conversation-1",
      libraryOpen: true,
      assistantOpen: true,
      historyOpen: true,
      noteNodeIds: ["root"],
    };

    const url = workspaceRouteUrl(route);
    expect(url).toBe(
      "/mindmaps/mindmap-1?library&assistant=history&note=root&chat=conversation-1",
    );
    expect(parseWorkspaceRoute(url)).toEqual(route);
  });

  it("addresses every open note, front-most last", () => {
    const route: WorkspaceRoute = {
      ...closed,
      mindmapId: "mindmap-1",
      noteNodeIds: ["root", "backend", "db"],
    };

    // Comma-separated because these URLs are meant to be read: the list says
    // "three notes, db in front" at a glance.
    const url = workspaceRouteUrl(route);
    expect(url).toBe("/mindmaps/mindmap-1?note=root,backend,db");
    expect(parseWorkspaceRoute(url)).toEqual(route);
  });

  it("collapses a topic asked for twice into one window", () => {
    expect(
      parseWorkspaceRoute("/mindmaps/mindmap-1?note=root,backend,root")
        .noteNodeIds,
    ).toEqual(["root", "backend"]);
  });

  it("cannot say that a note is open with no mindmap under it", () => {
    // A note id names a topic of the open map, so the grammar refuses to
    // write one without the map — which is what makes closing the canvas
    // close every note without anything having to remember to.
    const url = workspaceRouteUrl({ ...closed, noteNodeIds: ["root"] });

    expect(url).toBe("/");
    expect(parseWorkspaceRoute("/?note=root").noteNodeIds).toEqual([]);
  });

  it("lets notes and the assistant be open together", () => {
    // A note is a window over the canvas rather than a second panel beside it,
    // so nothing has to close to make room for it.
    expect(
      parseWorkspaceRoute("/mindmaps/mindmap-1?assistant&note=root,backend"),
    ).toMatchObject({ assistantOpen: true, noteNodeIds: ["root", "backend"] });
  });

  it("cannot say that history is showing over a closed assistant", () => {
    // The invariant the old store enforced in an action — closing the panel
    // puts history away with it — is enforced here by the grammar, so no
    // navigation can land on a panel that reopens onto the history list.
    const url = workspaceRouteUrl({ ...closed, historyOpen: true });

    expect(url).toBe("/");
    expect(parseWorkspaceRoute(url).historyOpen).toBe(false);
  });

  it("reads an unknown path and stray parameters as nothing open", () => {
    expect(parseWorkspaceRoute("/somewhere/else?chat=&sort=recent")).toEqual(
      closed,
    );
  });

  it("survives ids that need escaping", () => {
    const route = {
      ...closed,
      mindmapId: "a/b?c",
      conversationId: "x&y",
      // Escaped before joining, so the comma inside a topic id can't split it
      // into two windows on the way back.
      noteNodeIds: ["one,two", "three"],
    };

    expect(parseWorkspaceRoute(workspaceRouteUrl(route))).toEqual(route);
  });
});
