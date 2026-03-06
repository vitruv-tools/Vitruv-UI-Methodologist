import { create } from "zustand";

export type ReactionFile = {fromModel: string; toModel: string; id: number};

export type ProjectStore = {
  // Active VSUM id
  activeId: number | null;
  mode: 'workspace' | 'expanded' | 'reactions';
  reactionFiles: Set<ReactionFile>;
  expandedMetaModelNames: Set<string> | null;
  setMode: (mode: ProjectStore['mode']) => void;
  setReactionFiles: (files: ProjectStore['reactionFiles']) => void;
  addReactionFile: (file: ReactionFile) => void;
  setActiveId: (id: number | null) => void;
  setExpandedMetaModelNames: (names: Set<string> | null) => void;
};

export const useProjectStore = create<ProjectStore>((set) => ({
  activeId: null,
  mode: 'workspace',
  reactionFiles: new Set(),
  expandedMetaModelNames: null,
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
    set({ activeId: id, expandedMetaModelNames: null, reactionFiles: new Set(), mode: 'workspace' });
  },
  setExpandedMetaModelNames(names: Set<string> | null) {
    set({ expandedMetaModelNames: names });
  }
}));
