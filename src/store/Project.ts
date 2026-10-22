import { create } from 'zustand';

export type ProjectMode = 'workspace' | 'expanded' | 'reactions';

export interface ReactionFile {
  fromModel: string;
  toModel: string;
  id: number;
}

export interface ProjectState {
  activeId: number | null;
  mode: ProjectMode;
  reactionFiles: Set<ReactionFile>;
  expandedMetaModels: Set<number> | null;

  setActiveId: (id: number | null) => void;
  setMode: (mode: ProjectMode) => void;
  setReactionFiles: (files: Set<ReactionFile>) => void;
  addReactionFile: (file: ReactionFile) => void;
  setExpandedMetaModels: (ids: Set<number> | null) => void;
}

/**
 * Global project-level state for the Low Code integration.
 *
 * `setActiveId` resets mode to `'workspace'` and clears reaction file /
 * expanded sets so stale state from a previous project never bleeds through.
 */
export const useProjectStore = create<ProjectState>((set) => ({
  activeId: null,
  mode: 'workspace',
  reactionFiles: new Set<ReactionFile>(),
  expandedMetaModels: null,

  setActiveId: (id) =>
    set({
      activeId: id,
      mode: 'workspace',
      reactionFiles: new Set<ReactionFile>(),
      expandedMetaModels: null,
    }),

  setMode: (mode) => set({ mode }),

  setReactionFiles: (files) => set({ reactionFiles: files }),

  addReactionFile: (file) =>
    set((state) => {
      const next = new Set(state.reactionFiles);
      next.add(file);
      return { reactionFiles: next };
    }),

  setExpandedMetaModels: (ids) => set({ expandedMetaModels: ids }),
}));
