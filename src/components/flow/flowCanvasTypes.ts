/** Side of an EcoreFileBox a reaction edge attaches to. */
export type HandlePosition = 'top' | 'bottom' | 'left' | 'right';

/** Top-level canvas mode selected via the floating toggle. */
export type CanvasMode = 'modeling' | 'constraints' | 'views';

export interface ConnectionDragState {
  isActive: boolean;
  sourceNodeId: string | null;
  sourceHandle: HandlePosition | null;
  currentPosition: { x: number; y: number } | null;
  sourceTipPosition: { x: number; y: number } | null;
}

/** Elements queued for removal, pending confirmation in the ConfirmDialog. */
export interface PendingDeleteState {
  nodeIds: string[];
  edgeIds: string[];
  fileId: string | null;
}

export interface CodeEditorState {
  isOpen: boolean;
  edgeId: string | null;
  initialCode: string;
  sourceFileName?: string;
  targetFileName?: string;
  reactionFileId?: number | null;
}
