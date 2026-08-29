import { create } from "zustand";

// Client-only state. Anything fetched from the API belongs in React Query,
// not here — this store holds UI choices that have no server counterpart.
//
// `selectedMindmapId` is deliberately not reconciled against the server list:
// consumers resolve it against the mindmaps they have, so a deleted mindmap's
// id sitting here is inert rather than a dangling reference to clean up.
interface UiState {
  selectedMindmapId: string | null;
  selectMindmap: (id: string | null) => void;
  libraryOpen: boolean;
  setLibraryOpen: (open: boolean) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedMindmapId: null,
  selectMindmap: (id) => set({ selectedMindmapId: id }),
  libraryOpen: false,
  setLibraryOpen: (open) => set({ libraryOpen: open }),
  chatOpen: false,
  setChatOpen: (open) => set({ chatOpen: open }),
}));
