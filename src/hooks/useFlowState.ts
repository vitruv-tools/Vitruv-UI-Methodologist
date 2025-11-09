import { useCallback, useState, useEffect } from 'react';
import { useNodesState, useEdgesState, Connection, Edge, Node } from 'reactflow';
import { useUndoRedo } from './useUndoRedo';

const STORAGE_KEY = 'flow_diagram_state_v1';

export function useFlowState() {
  const chooseHandlesForPair = useCallback((src?: Node, tgt?: Node, preferredSource?: string | null, preferredTarget?: string | null) => {
    if (!src || !tgt) {
      return { s: preferredSource ?? undefined, t: preferredTarget ?? undefined } as const;
    }
    const dx = (tgt.position?.x ?? 0) - (src.position?.x ?? 0);
    const dy = (tgt.position?.y ?? 0) - (src.position?.y ?? 0);
    if (Math.abs(dx) >= Math.abs(dy)) {
      const s = dx >= 0 ? 'right-source' : 'left-source';
      const t = dx >= 0 ? 'left-target' : 'right-target';
      return { s, t } as const;
    } else {
      const s = dy >= 0 ? 'bottom-source' : 'top-source';
      const t = dy >= 0 ? 'top-target' : 'bottom-target';
      return { s, t } as const;
    }
  }, []);

  const applyParallelEdgeMeta = useCallback((edges: Edge[]) => {
    // group edges by unordered node pair
    const groups = new Map<string, Edge[]>();
    for (const e of edges) {
      const a = e.source;
      const b = e.target;
      const key = a < b ? `${a}__${b}` : `${b}__${a}`;
      const list = groups.get(key) || [];
      list.push(e);
      groups.set(key, list);
    }
    return edges.map((e) => {
      const a = e.source;
      const b = e.target;
      const key = a < b ? `${a}__${b}` : `${b}__${a}`;
      const list = groups.get(key) || [];
      const count = list.length;
      const sorted = [...list].sort((x, y) => x.id.localeCompare(y.id));
      const index = sorted.findIndex((x) => x.id === e.id);
      const data = {
        ...e.data,
        parallelIndex: index,
        parallelCount: count,
      } as any;
      return { ...e, data };
    });
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [idCounter, setIdCounter] = useState(1);
  const [isApplyingState, setIsApplyingState] = useState(false);
  const [lastSavedState, setLastSavedState] = useState<{ nodes: Node[]; edges: Edge[]; idCounter: number }>({ 
    nodes: [], 
    edges: [], 
    idCounter: 1 
  });
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize undo/redo with current state
  const {
    saveState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory
  } = useUndoRedo({
    nodes: [],
    edges: [],
    idCounter: 1
  });

  // NEU: Lade gespeicherten State beim Start
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('Loading saved diagram state:', parsed);
        
        if (parsed.nodes && Array.isArray(parsed.nodes)) {
          setNodes(parsed.nodes);
        }
        if (parsed.edges && Array.isArray(parsed.edges)) {
          setEdges(parsed.edges);
        }
        if (parsed.idCounter) {
          setIdCounter(parsed.idCounter);
        }
        
        setLastSavedState({
          nodes: parsed.nodes || [],
          edges: parsed.edges || [],
          idCounter: parsed.idCounter || 1
        });
      }
    } catch (e) {
      console.warn('Failed to load diagram state from localStorage', e);
    }
    setIsInitialized(true);
  }, [setNodes, setEdges]);

  // NEU: Speichere State bei Änderungen
  useEffect(() => {
    if (!isInitialized) return;
    
    const stateToSave = {
      nodes,
      edges,
      idCounter
    };
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      console.log('Saved diagram state to localStorage');
    } catch (e) {
      console.warn('Failed to save diagram state to localStorage', e);
    }
  }, [nodes, edges, idCounter, isInitialized]);

  useEffect(() => {
    if (isApplyingState) return;
    
    const currentDiagramState = {
      nodes,
      edges,
      idCounter
    };
    
    const hasChanged = 
      lastSavedState.nodes.length !== nodes.length ||
      lastSavedState.edges.length !== edges.length ||
      lastSavedState.idCounter !== idCounter ||
      JSON.stringify(lastSavedState.nodes) !== JSON.stringify(nodes) ||
      JSON.stringify(lastSavedState.edges) !== JSON.stringify(edges);
    
    if (hasChanged && (nodes.length > 0 || edges.length > 0 || idCounter > 1)) {
      let actionDescription = 'Diagram change';
      
      if (lastSavedState.nodes.length !== nodes.length) {
        if (nodes.length > lastSavedState.nodes.length) {
          actionDescription = 'Node added';
        } else {
          actionDescription = 'Node deleted';
        }
      } else if (lastSavedState.edges.length !== edges.length) {
        if (edges.length > lastSavedState.edges.length) {
          actionDescription = 'Connection added';
        } else {
          actionDescription = 'Connection deleted';
        }
      } else if (nodes.length > 0) {
        actionDescription = 'Node modified';
      }
      
      console.log(`Saving state: ${actionDescription}`, {
        nodesBefore: lastSavedState.nodes.length,
        nodesAfter: nodes.length,
        edgesBefore: lastSavedState.edges.length,
        edgesAfter: edges.length
      });
      
      saveState(currentDiagramState, actionDescription);
      setLastSavedState(currentDiagramState);
    }
  }, [nodes, edges, idCounter, saveState, isApplyingState, lastSavedState]);

  const applyState = useCallback((state: { nodes: Node[]; edges: Edge[]; idCounter: number }) => {
    setIsApplyingState(true);
    setNodes(state.nodes);
    setEdges(state.edges);
    setIdCounter(state.idCounter);
    setLastSavedState(state);
    setTimeout(() => setIsApplyingState(false), 100);
  }, [setNodes, setEdges]);

  const getId = useCallback(() => {
    const newId = idCounter.toString();
    setIdCounter(prev => prev + 1);
    return newId;
  }, [idCounter]);

  const onConnect = useCallback(
    (params: Connection) => {
      // pick best handles if not provided
      const findNode = (id?: string | null) => nodes.find(n => n.id === id);
      const src = findNode(params.source);
      const tgt = findNode(params.target);
      const auto = chooseHandlesForPair(src, tgt, params.sourceHandle, params.targetHandle);
      const newEdge: Edge = {
        id: `edge-${getId()}`,
        type: 'uml',
        source: params.source!,
        target: params.target!,
        sourceHandle: params.sourceHandle ?? auto.s,
        targetHandle: params.targetHandle ?? auto.t,
        data: {
          relationshipType: 'association',
          label: 'Association',
        },
      };
      setEdges((eds) => eds.concat(newEdge));
    },
    [getId, setEdges, nodes, chooseHandlesForPair]
  );

  const addNode = useCallback((node: Omit<Node, 'id'>) => {
    const newNode: Node = {
      ...node,
      id: getId(),
    };
    console.log('useFlowState.addNode called with:', node);
    console.log('Created newNode:', newNode);
    setNodes((nds) => {
      const newNodes = nds.concat(newNode);
      console.log('Updated nodes array:', newNodes);
      return newNodes;
    });
    return newNode.id;
  }, [getId, setNodes]);

  const updateNodeLabel = useCallback((id: string, newLabel: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, label: newLabel } }
          : node
      )
    );
  }, [setNodes]);

  const removeNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
  }, [setNodes, setEdges]);

  const addEdge = useCallback((edge: Omit<Edge, 'id'>) => {
    // If handles not provided, choose based on relative positions
    const findNode = (id?: string) => nodes.find(n => n.id === id);
    const src = findNode(edge.source);
    const tgt = findNode(edge.target);
    const auto = chooseHandlesForPair(src, tgt, edge.sourceHandle, edge.targetHandle);
    const newEdge: Edge = {
      ...edge,
      id: `edge-${getId()}`,
      sourceHandle: edge.sourceHandle ?? auto.s,
      targetHandle: edge.targetHandle ?? auto.t,
    };
    console.log('useFlowState.addEdge called with:', edge);
    console.log('Created newEdge:', newEdge);
    setEdges((eds) => {
      const updated = eds.concat(newEdge);
      const withMeta = applyParallelEdgeMeta(updated);
      console.log('Updated edges array (with parallel meta):', withMeta);
      return withMeta;
    });
    return newEdge.id;
  }, [getId, setEdges, nodes, applyParallelEdgeMeta, chooseHandlesForPair]);

  // Keep parallel metadata consistent when edges change via other operations (delete, load, undo/redo)
  useEffect(() => {
    if (!edges || edges.length === 0) return;
    const recomputed = applyParallelEdgeMeta(edges);
    // detect if parallel meta changed to avoid unnecessary re-renders
    const changed = edges.some((e, i) => {
      const prevIndex = (e.data as any)?.parallelIndex;
      const prevCount = (e.data as any)?.parallelCount;
      const nextIndex = (recomputed[i].data as any)?.parallelIndex;
      const nextCount = (recomputed[i].data as any)?.parallelCount;
      return prevIndex !== nextIndex || prevCount !== nextCount;
    });
    if (changed) {
      setEdges(recomputed);
    }
  }, [edges, setEdges, applyParallelEdgeMeta]);

  const removeEdge = useCallback((id: string) => {
    setEdges((eds) => eds.filter((edge) => edge.id !== id));
  }, [setEdges]);

  // NEU: Funktion zum Aktualisieren des Edge-Codes
  const updateEdgeCode = useCallback((edgeId: string, code: string) => {
    setEdges((eds) =>
      eds.map((edge) =>
        edge.id === edgeId
          ? { ...edge, data: { ...edge.data, code } }
          : edge
      )
    );
  }, [setEdges]);

  const clearFlow = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setIdCounter(1);
    clearHistory();
    
    // NEU: Lösche auch den gespeicherten State
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear localStorage', e);
    }
  }, [setNodes, setEdges, clearHistory]);

  const handleUndo = useCallback(() => {
    const previousState = undo();
    if (previousState) {
      applyState(previousState);
    }
  }, [undo, applyState]);

  const handleRedo = useCallback(() => {
    const nextState = redo();
    if (nextState) {
      applyState(nextState);
    }
  }, [redo, applyState]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    addEdge,
    updateNodeLabel,
    removeNode,
    removeEdge,
    clearFlow,
    getId,
    setNodes,
    setEdges,
    undo: handleUndo,
    redo: handleRedo,
    canUndo,
    canRedo,
    updateEdgeCode,
  };
}