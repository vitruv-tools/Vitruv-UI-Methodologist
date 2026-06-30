export interface ConnectionDragState {
  isActive: boolean;
  sourceNodeId: string | null;
  sourceHandle: 'top' | 'bottom' | 'left' | 'right' | null;
  currentPosition: { x: number; y: number } | null;
  sourceTipPosition: { x: number; y: number } | null;
}

export interface CodeEditorState {
  isOpen: boolean;
  edgeId: string | null;
  initialCode: string;
  sourceFileName?: string;
  targetFileName?: string;
  reactionFileId?: number | null;
}
