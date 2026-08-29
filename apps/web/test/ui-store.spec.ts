import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "../src/stores/ui-store";

describe("UI store", () => {
  beforeEach(() => {
    useUiStore.setState({
      selectedMindmapId: null,
      libraryOpen: false,
      assistantOpen: false,
      activeConversationId: null,
      historyOpen: false,
    });
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

  it("picking a conversation puts the history list away", () => {
    useUiStore.getState().setHistoryOpen(true);
    useUiStore.getState().selectConversation("conversation-1");

    expect(useUiStore.getState().activeConversationId).toBe("conversation-1");
    expect(useUiStore.getState().historyOpen).toBe(false);
  });

  it("closing the assistant puts history away with it", () => {
    // Otherwise reopening the panel lands on whatever list was left showing
    // rather than on the conversation.
    useUiStore.getState().setAssistantOpen(true);
    useUiStore.getState().setHistoryOpen(true);
    useUiStore.getState().setAssistantOpen(false);

    expect(useUiStore.getState().assistantOpen).toBe(false);
    expect(useUiStore.getState().historyOpen).toBe(false);
  });
});
