import { create } from "zustand";
import { FlowEcoreEdge } from "../types";

/**
 * Store shape for the currently selected Ecore edge in the UI.
 */
export type SelectedEdgeStore = {
    selectedEdge: FlowEcoreEdge | null;
    setSelectedEdge: (edge: FlowEcoreEdge | null) => void;
};

/**
 * Zustand store that tracks the currently selected edge.
 */
export const useSelectedEdgeStore = create<SelectedEdgeStore>((set) => ({
    selectedEdge: null,
    setSelectedEdge: (selectedEdge: FlowEcoreEdge | null) => set({ selectedEdge }),
}));