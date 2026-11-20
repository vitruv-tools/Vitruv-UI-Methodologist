import type { CanvasProjectLoadState } from '../utils/canvasProjectLoadState';
import type { CollaborationState } from './useCanvasCollaboration';

/**
 * What the canvas is given because of collaboration. Without the shared project there is nothing
 * to save changes into, so the canvas can only be looked at; and with it there is no Save and no
 * Undo, because the project saves itself and an undo would restore old snapshots over others' work.
 */
export function canvasCollaborationProps<Save>(collaboration: CollaborationState, isViewOnly: boolean, saveChanges: Save) {
  return {
    readOnly: isViewOnly || collaboration.unavailable,
    collaboration: collaboration.sync ?? undefined,
    disableUndo: collaboration.enabled,
    onSaveChanges: collaboration.enabled ? undefined : saveChanges,
  };
}

/** The canvas shows the project as loading until it shows the shared project too. */
export function shownLoadState(collaboration: CollaborationState, loadState: CanvasProjectLoadState): CanvasProjectLoadState {
  return collaboration.holding && loadState.status === 'ready' ? { status: 'hydrating' } : loadState;
}
