import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "../src/stores/ui-store";

describe("UI store", () => {
  beforeEach(() => {
    useUiStore.setState({ selectedMindmapId: null, libraryOpen: false });
  });

  it("selects and clears the active mindmap", () => {
    useUiStore.getState().selectMindmap("mindmap-1");
    expect(useUiStore.getState().selectedMindmapId).toBe("mindmap-1");

    useUiStore.getState().selectMindmap(null);
    expect(useUiStore.getState().selectedMindmapId).toBeNull();
  });

  it("opens and closes the library", () => {
    useUiStore.getState().setLibraryOpen(true);
    expect(useUiStore.getState().libraryOpen).toBe(true);

    useUiStore.getState().setLibraryOpen(false);
    expect(useUiStore.getState().libraryOpen).toBe(false);
  });
});
