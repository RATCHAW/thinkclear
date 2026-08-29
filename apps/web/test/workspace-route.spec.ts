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
    };

    const url = workspaceRouteUrl(route);
    expect(url).toBe(
      "/mindmaps/mindmap-1?library&assistant=history&chat=conversation-1",
    );
    expect(parseWorkspaceRoute(url)).toEqual(route);
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
    const route = { ...closed, mindmapId: "a/b?c", conversationId: "x&y" };

    expect(parseWorkspaceRoute(workspaceRouteUrl(route))).toEqual(route);
  });
});
