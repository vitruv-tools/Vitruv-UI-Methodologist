import { create } from "zustand";

/**
 * Represents a persisted reaction file relation between two meta models.
 */
export type ReactionFile = {fromModel: string; toModel: string; id: number};

/**
 * Central project-level UI and context state.
 */
export type ProjectStore = {
  // Active VSUM id
  activeId: number | null;
  mode: 'workspace' | 'expanded' | 'reactions';
  reactionFiles: Set<ReactionFile>;
  expandedMetaModels: Set<number> | null;
  setMode: (mode: ProjectStore['mode']) => void;
  setReactionFiles: (files: ProjectStore['reactionFiles']) => void;
  addReactionFile: (file: ReactionFile) => void;
  setActiveId: (id: number | null) => void;
  setExpandedMetaModels: (ids: Set<number> | null) => void;
};

/**
 * Zustand store containing current project mode, active VSUM, and reaction context.
 */
export const useProjectStore = create<ProjectStore>((set) => ({
  activeId: null,
  mode: 'workspace',
  reactionFiles: new Set(),
  expandedMetaModels: null,
  setMode(mode: ProjectStore['mode']) {
    set({ mode });
  },
  setReactionFiles(files: ProjectStore['reactionFiles']) {
    set({ reactionFiles: files });
  },
  addReactionFile(file: ReactionFile) {
    set((state) => ({ reactionFiles: new Set(state.reactionFiles).add(file) }));
  },
  setActiveId(id: number | null) {
    set({ activeId: id, expandedMetaModels: null, reactionFiles: new Set(), mode: 'workspace' });
  },
  setExpandedMetaModels(ids: Set<number> | null) {
    set({ expandedMetaModels: ids });
  }
}));
