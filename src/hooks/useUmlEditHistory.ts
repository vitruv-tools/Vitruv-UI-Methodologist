import { useCallback, useRef, useState } from 'react';
import { UMLClass, UMLRelationship } from '../utils/ecoreToUml';

export interface UmlEditSnapshot {
  classes: UMLClass[];
  relationships: UMLRelationship[];
}

function cloneSnapshot(snapshot: UmlEditSnapshot): UmlEditSnapshot {
  return structuredClone(snapshot);
}

const MAX_HISTORY = 50;

export function useUmlEditHistory() {
  const undoStack = useRef<UmlEditSnapshot[]>([]);
  const redoStack = useRef<UmlEditSnapshot[]>([]);
  const [historyTick, setHistoryTick] = useState(0);

  const bump = useCallback(() => setHistoryTick(t => t + 1), []);

  void historyTick;
  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  const clearHistory = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    bump();
  }, [bump]);

  const recordBeforeChange = useCallback((snapshot: UmlEditSnapshot) => {
    undoStack.current.push(cloneSnapshot(snapshot));
    if (undoStack.current.length > MAX_HISTORY) {
      undoStack.current.shift();
    }
    redoStack.current = [];
    bump();
  }, [bump]);

  const undo = useCallback((current: UmlEditSnapshot): UmlEditSnapshot | null => {
    const previous = undoStack.current.pop();
    if (!previous) return null;
    redoStack.current.push(cloneSnapshot(current));
    bump();
    return cloneSnapshot(previous);
  }, [bump]);

  const redo = useCallback((current: UmlEditSnapshot): UmlEditSnapshot | null => {
    const next = redoStack.current.pop();
    if (!next) return null;
    undoStack.current.push(cloneSnapshot(current));
    bump();
    return cloneSnapshot(next);
  }, [bump]);

  return {
    canUndo,
    canRedo,
    recordBeforeChange,
    undo,
    redo,
    clearHistory,
  };
}
