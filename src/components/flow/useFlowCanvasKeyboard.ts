import { useEffect } from 'react';
import { Edge, Node } from 'reactflow';

interface KeyboardShortcutOptions {
  readOnly?: boolean;
  nodes: Node[];
  edges: Edge[];
  selectedFileId: string | null;
  umlModalOpen?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  setPendingDelete: (value: { nodeIds: string[]; edgeIds: string[]; fileId: string | null }) => void;
}

function isEditableElement(target: HTMLElement): boolean {
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';
}

function buildDeletePending(
  nodes: Node[],
  edges: Edge[],
  selectedFileId: string | null,
): { nodeIds: string[]; edgeIds: string[]; fileId: string | null } | null {
  const selectedNodes = nodes.filter(n => n.selected);
  const selectedEdges = edges.filter(e => e.selected);
  const selectedEcoreNode = selectedNodes.find(n => n.type === 'ecoreFile');
  const otherNodes = selectedNodes.filter(n => n.type !== 'ecoreFile');

  if (selectedEdges.length > 0) {
    return {
      nodeIds: otherNodes.map(n => n.id),
      edgeIds: selectedEdges.map(e => e.id),
      fileId: null,
    };
  }

  const ecoreTargetId = selectedEcoreNode?.id ?? selectedFileId;
  if (ecoreTargetId) {
    return { nodeIds: otherNodes.map(n => n.id), edgeIds: [], fileId: ecoreTargetId };
  }

  if (otherNodes.length > 0) {
    return { nodeIds: otherNodes.map(n => n.id), edgeIds: [], fileId: null };
  }

  return null;
}

export function useFlowCanvasKeyboardShortcuts(options: KeyboardShortcutOptions): void {
  const {
    readOnly,
    nodes,
    edges,
    selectedFileId,
    umlModalOpen,
    canUndo,
    canRedo,
    undo,
    redo,
    setPendingDelete,
  } = options;

  useEffect(() => {
    const handleDeleteKey = (event: KeyboardEvent): boolean => {
      if (readOnly) return false;
      const pending = buildDeletePending(nodes, edges, selectedFileId);
      if (!pending) return false;
      event.preventDefault();
      setPendingDelete(pending);
      return true;
    };

    const handleUndoRedo = (event: KeyboardEvent): void => {
      if (readOnly) return;
      const key = event.key.toLowerCase();

      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey && canRedo) redo();
        else if (!event.shiftKey && canUndo) undo();
        return;
      }

      if (key === 'y' && canRedo) {
        event.preventDefault();
        redo();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target as HTMLElement)) return;

      const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace';
      if (isDeleteKey && handleDeleteKey(event)) return;

      const hasModifier = event.ctrlKey || event.metaKey;
      if (hasModifier && !umlModalOpen) handleUndoRedo(event);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo, nodes, edges, selectedFileId, setPendingDelete, umlModalOpen, readOnly]);
}
