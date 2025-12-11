import { useCallback, useRef, useState } from 'react';
import { Node, Edge } from 'reactflow';

interface DiagramState {
  nodes: Node[];
  edges: Edge[];
  idCounter: number;
}

interface HistoryEntry {
  state: DiagramState;
  timestamp: number;
  description: string;
}

// Deep clone that strips out non-serializable values (functions, Maps, Sets, etc.)
// This is necessary because node.data may contain callback functions which structuredClone cannot handle
function cloneStateForHistory(state: DiagramState): DiagramState {
  const stripNonSerializable = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'function') return undefined;
    if (obj instanceof Map || obj instanceof Set) return undefined;
    if (Array.isArray(obj)) {
      return obj.map(stripNonSerializable);
    }
    if (typeof obj === 'object') {
      const result: any = {};
      for (const key of Object.keys(obj)) {
        const value = stripNonSerializable(obj[key]);
        if (value !== undefined) {
          result[key] = value;
        }
      }
      return result;
    }
    return obj;
  };

  const cleanState = stripNonSerializable(state);
  return structuredClone(cleanState);
}

export function useUndoRedo(initialState: DiagramState) {
  const [currentState, setCurrentState] = useState<DiagramState>(initialState);
  const history = useRef<HistoryEntry[]>([]);
  const currentIndex = useRef<number>(-1);
  const maxHistorySize = 50; // Limit history to prevent memory issues

  const saveState = useCallback((state: DiagramState, description: string) => {
    const newEntry: HistoryEntry = {
      state: cloneStateForHistory(state),
      timestamp: Date.now(),
      description
    };

    // Remove any future history if we're not at the end
    if (currentIndex.current < history.current.length - 1) {
      history.current = history.current.slice(0, currentIndex.current + 1);
    }

    // Add new entry
    history.current.push(newEntry);
    currentIndex.current = history.current.length - 1;

    // Limit history size
    if (history.current.length > maxHistorySize) {
      history.current = history.current.slice(-maxHistorySize);
      currentIndex.current = history.current.length - 1;
    }

    console.log(`Saved state: ${description}`, {
      historyLength: history.current.length,
      currentIndex: currentIndex.current,
      nodesCount: state.nodes.length,
      edgesCount: state.edges.length
    });

    setCurrentState(state);
  }, []);

  const canUndo = currentIndex.current > 0;
  const canRedo = currentIndex.current < history.current.length - 1;

  const undo = useCallback(() => {
    if (!canUndo) return null;

    currentIndex.current--;
    const previousState = history.current[currentIndex.current].state;
    
    console.log(`Undo performed:`, {
      newIndex: currentIndex.current,
      historyLength: history.current.length,
      nodesCount: previousState.nodes.length,
      edgesCount: previousState.edges.length,
      description: history.current[currentIndex.current]?.description
    });
    
    setCurrentState(previousState);
    return previousState;
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return null;

    currentIndex.current++;
    const nextState = history.current[currentIndex.current].state;
    setCurrentState(nextState);
    return nextState;
  }, [canRedo]);

  const getCurrentState = useCallback(() => currentState, [currentState]);

  const clearHistory = useCallback(() => {
    history.current = [];
    currentIndex.current = -1;
  }, []);

  const getHistoryInfo = useCallback(() => ({
    canUndo,
    canRedo,
    historyLength: history.current.length,
    currentIndex: currentIndex.current,
    lastAction: currentIndex.current >= 0 ? history.current[currentIndex.current]?.description : null
  }), [canUndo, canRedo]);

  return {
    currentState,
    saveState,
    undo,
    redo,
    canUndo,
    canRedo,
    getCurrentState,
    clearHistory,
    getHistoryInfo
  };
}
