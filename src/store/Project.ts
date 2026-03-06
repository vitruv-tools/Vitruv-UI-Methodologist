import { Project } from "reactflow";
import { create } from "zustand";

export type ReactionFile = {fromModel: string; toModel: string; id: number};

export type ProjectStore = {
  // Active VSUM id
  activeId: number | null;
  mode: 'workspace' | 'expanded' | 'reactions';
  reactionFiles: Set<ReactionFile>;
  setMode: (mode: ProjectStore['mode']) => void;
  setReactionFiles: (files: ProjectStore['reactionFiles']) => void;
  addReactionFile: (file: ReactionFile) => void;
  setActiveId: (id: number | null) => void;
};

export const useProjectStore = create<ProjectStore>((set) => ({
  activeId: null,
  mode: 'workspace',
  reactionFiles: new Set(),
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
    set({ activeId: id });
  }
}));
