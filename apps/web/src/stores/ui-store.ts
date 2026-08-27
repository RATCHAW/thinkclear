import { create } from "zustand";

// Client-only state. Anything fetched from the API belongs in React Query,
// not here — this store holds UI choices that have no server counterpart.
interface UiState {
  selectedMindmapId: string | null;
  selectMindmap: (id: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedMindmapId: null,
  selectMindmap: (id) => set({ selectedMindmapId: id }),
}));
