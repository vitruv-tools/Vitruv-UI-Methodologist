import { create } from "zustand";
import { FlowEcoreEdge } from "../types";

export type SelectedEdgeStore = {
    selectedEdge: FlowEcoreEdge | null;
    setSelectedEdge: (edge: FlowEcoreEdge | null) => void;
};

export const useSelectedEdgeStore = create<SelectedEdgeStore>((set) => ({
    selectedEdge: null,
    setSelectedEdge: (selectedEdge: FlowEcoreEdge | null) => set({ selectedEdge }),
}));