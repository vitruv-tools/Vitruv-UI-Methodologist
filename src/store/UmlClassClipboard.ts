import { create } from 'zustand';
import type { UMLClass, UMLRelationship } from '../utils/ecoreToUml';

/**
 * Copied classes plus the relationships between them. It is a copy, not a
 * link to the originals, so pasting still works after the source model is
 * changed or closed.
 */
export interface UmlClassSnapshot {
  classes: UMLClass[];
  relationships: UMLRelationship[];
}

export interface UmlClassClipboardState {
  snapshot: UmlClassSnapshot | null;
  /** Ids of the open UML editors, most recently used last. Paste goes to the last one. */
  editorIds: string[];
  setSnapshot: (snapshot: UmlClassSnapshot) => void;
  clearSnapshot: () => void;
  /** Marks an editor as the one the user works in (on open, click or focus). */
  activateEditor: (editorId: string) => void;
  /** Forgets a closed editor; the previously used editor becomes active again. */
  releaseEditor: (editorId: string) => void;
}

/**
 * App-level clipboard for UML classes. Every UML editor (Model library and
 * project) shares it, so classes can also be pasted into another model.
 */
export const useUmlClassClipboardStore = create<UmlClassClipboardState>((set) => ({
  snapshot: null,
  editorIds: [],

  setSnapshot: (snapshot) => set({ snapshot }),

  clearSnapshot: () => set({ snapshot: null }),

  activateEditor: (editorId) =>
    set((state) => (
      state.editorIds.at(-1) === editorId
        ? state
        : { editorIds: [...state.editorIds.filter(id => id !== editorId), editorId] }
    )),

  releaseEditor: (editorId) =>
    set((state) => ({ editorIds: state.editorIds.filter(id => id !== editorId) })),
}));

/** True if the editor is the one the user used last, so it receives Ctrl/Cmd+C and V. */
export function isActiveUmlEditor(editorId: string): boolean {
  return useUmlClassClipboardStore.getState().editorIds.at(-1) === editorId;
}
