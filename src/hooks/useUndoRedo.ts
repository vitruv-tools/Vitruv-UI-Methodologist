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

function deepClone<T>(obj: T, seen = new WeakMap()): T {
  // Primitives & functions
  if (obj === null || typeof obj !== "object") return obj;

  // Circular reference
  if (seen.has(obj)) return seen.get(obj);

  // Special cases
  if (obj instanceof Date) return new Date(obj) as T;
  if (obj instanceof RegExp) return new RegExp(obj) as T;
  if (obj instanceof Map) {
    const map = new Map();
    seen.set(obj, map);
    obj.forEach((v, k) => {
      map.set(deepClone(k, seen), deepClone(v, seen));
    });
    return map as T;
  }
  if (obj instanceof Set) {
    const set = new Set();
    seen.set(obj, set);
    obj.forEach(v => set.add(deepClone(v, seen)));
    return set as T;
  }

  // Create clone with same prototype
  const clone = Object.create(Object.getPrototypeOf(obj));
  seen.set(obj, clone);

  // Copy all properties (incl. non-enumerable & symbols)
  for (const key of Reflect.ownKeys(obj)) {
    const desc = Object.getOwnPropertyDescriptor(obj, key);
    if (desc == undefined) continue;
    if ("value" in desc) {
      desc.value = deepClone(desc.value, seen);
    }
    Object.defineProperty(clone, key, desc);
  }

  return clone;
}

export function useUndoRedo(initialState: DiagramState) {
  const [currentState, setCurrentState] = useState<DiagramState>(initialState);
  const history = useRef<HistoryEntry[]>([]);
  const currentIndex = useRef<number>(-1);
  const maxHistorySize = 50; // Limit history to prevent memory issues

  const saveState = useCallback((state: DiagramState, description: string) => {
    const newEntry: HistoryEntry = {
      state: deepClone(state),
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
