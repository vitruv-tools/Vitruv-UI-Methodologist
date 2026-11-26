import { useEffect } from 'react';
import { Edge, Node } from 'reactflow';
import type { PendingDeleteState } from './flowCanvasTypes';

interface KeyboardShortcutOptions {
  readOnly?: boolean;
  nodes: Node[];
  edges: Edge[];
  /** The selected metamodel boxes; the canvas keeps their selection itself. */
  selectedFileIds: string[];
  umlModalOpen?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  setPendingDelete: (value: PendingDeleteState) => void;
  /** Escape on the canvas, e.g. to clear the selection. Not called while the UML view is open. */
  onEscape?: () => void;
}

function isEditableElement(target: HTMLElement): boolean {
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';
}

export function buildDeletePending(
  nodes: Node[],
  edges: Edge[],
  selectedFileIds: string[],
): PendingDeleteState | null {
  const selectedNodes = nodes.filter(n => n.selected);
  const selectedEdges = edges.filter(e => e.selected);
  const otherNodes = selectedNodes.filter(n => n.type !== 'ecoreFile');

  if (selectedEdges.length > 0) {
    return {
      nodeIds: otherNodes.map(n => n.id),
      edgeIds: selectedEdges.map(e => e.id),
      fileIds: [],
    };
  }

  // All selected boxes, whether the canvas or the flow library marked them.
  const fileIds = Array.from(new Set([
    ...selectedFileIds,
    ...selectedNodes.filter(n => n.type === 'ecoreFile').map(n => n.id),
  ]));
  if (fileIds.length > 0 || otherNodes.length > 0) {
    return { nodeIds: otherNodes.map(n => n.id), edgeIds: [], fileIds };
  }

  return null;
}

export function useFlowCanvasKeyboardShortcuts(options: KeyboardShortcutOptions): void {
  const {
    readOnly,
    nodes,
    edges,
    selectedFileIds,
    umlModalOpen,
    canUndo,
    canRedo,
    undo,
    redo,
    setPendingDelete,
    onEscape,
  } = options;

  useEffect(() => {
    const handleDeleteKey = (event: KeyboardEvent): boolean => {
      if (readOnly) return false;
      const pending = buildDeletePending(nodes, edges, selectedFileIds);
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

      if (event.key === 'Escape') {
        if (!umlModalOpen) onEscape?.();
        return;
      }

      const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace';
      if (isDeleteKey && handleDeleteKey(event)) return;

      const hasModifier = event.ctrlKey || event.metaKey;
      if (hasModifier && !umlModalOpen) handleUndoRedo(event);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo, nodes, edges, selectedFileIds, setPendingDelete, umlModalOpen, readOnly, onEscape]);
}
