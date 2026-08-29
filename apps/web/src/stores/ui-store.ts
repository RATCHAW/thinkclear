import { create } from "zustand";

// Client-only state. Anything fetched from the API belongs in React Query,
// not here — this store holds UI choices that have no server counterpart.
//
// `selectedMindmapId` and `activeConversationId` are deliberately not
// reconciled against the server: consumers resolve them against the documents
// they have, so a deleted mindmap's or conversation's id sitting here is inert
// rather than a dangling reference to clean up.
interface UiState {
  selectedMindmapId: string | null;
  selectMindmap: (id: string | null) => void;
  libraryOpen: boolean;
  setLibraryOpen: (open: boolean) => void;
  assistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;
  /** The conversation the assistant is showing. `null` is an unsaved new chat. */
  activeConversationId: string | null;
  selectConversation: (id: string | null) => void;
  /** Whether the assistant panel is showing chat history instead of the chat. */
  historyOpen: boolean;
  setHistoryOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedMindmapId: null,
  selectMindmap: (id) => set({ selectedMindmapId: id }),
  libraryOpen: false,
  setLibraryOpen: (open) => set({ libraryOpen: open }),
  assistantOpen: false,
  // Closing the panel puts history away with it, so reopening always lands on
  // the conversation rather than on whatever list was left showing.
  setAssistantOpen: (open) =>
    set(
      open
        ? { assistantOpen: true }
        : { assistantOpen: false, historyOpen: false },
    ),
  activeConversationId: null,
  selectConversation: (id) =>
    set({ activeConversationId: id, historyOpen: false }),
  historyOpen: false,
  setHistoryOpen: (open) => set({ historyOpen: open }),
}));
