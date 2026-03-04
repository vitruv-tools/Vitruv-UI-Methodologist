import { create } from "zustand";
import { ProjectStore } from "../types/ProjectStore";

export const projectStore = create<ProjectStore>((_) => ({
  activeId: null,
}));
