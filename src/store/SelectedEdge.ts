import { create } from 'zustand';
import type { FlowEcoreEdge } from '../types/flow';

export interface SelectedEdgeState {
  selectedEdge: FlowEcoreEdge | null;
  setSelectedEdge: (edge: FlowEcoreEdge | null) => void;
  clearSelectedEdge: () => void;
}

/**
 * Tracks the currently selected fine-granular reaction edge.
 *
 * Used by FlowCanvas (on edge click) and consumed by
 * the LowCodeReactionEditor panel to display/edit the
 * selected relation's form data.
 */
export const useSelectedEdgeStore = create<SelectedEdgeState>((set) => ({
  selectedEdge: null,
  setSelectedEdge: (edge) => set({ selectedEdge: edge }),
  clearSelectedEdge: () => set({ selectedEdge: null }),
}));
