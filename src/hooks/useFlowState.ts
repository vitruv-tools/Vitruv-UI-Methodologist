import { useCallback, useState, useEffect, useRef } from 'react';
import { useNodesState, useEdgesState, Connection, Edge, Node } from 'reactflow';
import { useUndoRedo } from './useUndoRedo';

interface UseFlowStateProps {
  userId?: string;
  projectId?: string;
}

type DiagramState = { nodes: Node[]; edges: Edge[]; idCounter: number };

function hasDiagramStateChanged(lastSaved: DiagramState, current: DiagramState): boolean {
  return (
    lastSaved.nodes.length !== current.nodes.length ||
    lastSaved.edges.length !== current.edges.length ||
    lastSaved.idCounter !== current.idCounter ||
    JSON.stringify(lastSaved.nodes) !== JSON.stringify(current.nodes) ||
    JSON.stringify(lastSaved.edges) !== JSON.stringify(current.edges)
  );
}

function hasTrackableDiagramContent(nodes: Node[], edges: Edge[], idCounter: number): boolean {
  return nodes.length > 0 || edges.length > 0 || idCounter > 1;
}

function getDiagramActionDescription(lastSaved: DiagramState, current: DiagramState): string {
  if (lastSaved.nodes.length !== current.nodes.length) {
    return current.nodes.length > lastSaved.nodes.length ? 'Node added' : 'Node deleted';
  }
  if (lastSaved.edges.length !== current.edges.length) {
    return current.edges.length > lastSaved.edges.length ? 'Connection added' : 'Connection deleted';
  }
  if (current.nodes.length > 0) {
    return 'Node modified';
  }
  return 'Diagram change';
}

export function useFlowState(props?: UseFlowStateProps) {
  const { userId, projectId } = props || {};

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
      };
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

  // Initialize undo/redo with current state
  const {
    saveState,
    seedHistory,
    historyIsEmpty,
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

  const pauseHistoryRef = useRef(false);

  // Reset state when user/project changes
  useEffect(() => {
    console.log('User/Project changed, resetting state:', { userId, projectId });
    setNodes([]);
    setEdges([]);
    setIdCounter(1);
    setLastSavedState({
      nodes: [],
      edges: [],
      idCounter: 1
    });
    clearHistory();
  }, [userId, projectId, setNodes, setEdges, clearHistory]);

  useEffect(() => {
    if (isApplyingState || pauseHistoryRef.current) return;

    const currentDiagramState = { nodes, edges, idCounter };
    if (!hasDiagramStateChanged(lastSavedState, currentDiagramState)) return;
    if (!hasTrackableDiagramContent(nodes, edges, idCounter)) return;

    const actionDescription = getDiagramActionDescription(lastSavedState, currentDiagramState);

    console.log(`Saving state: ${actionDescription}`, {
      nodesBefore: lastSavedState.nodes.length,
      nodesAfter: nodes.length,
      edgesBefore: lastSavedState.edges.length,
      edgesAfter: edges.length
    });

    if (historyIsEmpty()) {
      seedHistory(lastSavedState, 'Initial state');
    }

    saveState(currentDiagramState, actionDescription);
    setLastSavedState(currentDiagramState);
  }, [nodes, edges, idCounter, saveState, seedHistory, historyIsEmpty, isApplyingState, lastSavedState]);

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

  const normalizeHandleId = (handle?: string | null): string | undefined => {
    if (!handle) return undefined;
    return handle.replace(/-source$/, '').replace(/-target$/, '');
  };

  const addEdge = useCallback((edge: Edge | Omit<Edge, 'id'>) => {
    // If handles not provided, choose based on relative positions
    const findNode = (id?: string) => nodes.find(n => n.id === id);
    const src = findNode(edge.source);
    const tgt = findNode(edge.target);
    const auto = chooseHandlesForPair(src, tgt, edge.sourceHandle, edge.targetHandle);
    const explicitId = 'id' in edge && typeof edge.id === 'string' ? edge.id : undefined;
    const newEdge: Edge = {
      ...edge,
      id: explicitId ?? `edge-${getId()}`,
      sourceHandle: normalizeHandleId(edge.sourceHandle) ?? normalizeHandleId(auto.s) ?? 'right',
      targetHandle: normalizeHandleId(edge.targetHandle) ?? normalizeHandleId(auto.t) ?? 'left',
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
      const prevIndex = e.data?.parallelIndex;
      const prevCount = e.data?.parallelCount;
      const nextIndex = recomputed[i].data?.parallelIndex;
      const nextCount = recomputed[i].data?.parallelCount;
      return prevIndex !== nextIndex || prevCount !== nextCount;
    });
    if (changed) {
      setEdges(recomputed);
    }
  }, [edges, setEdges, applyParallelEdgeMeta]);

  const removeEdge = useCallback((id: string) => {
    setEdges((eds) => eds.filter((edge) => edge.id !== id));
  }, [setEdges]);

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

  const setHistoryPaused = useCallback((paused: boolean) => {
    pauseHistoryRef.current = paused;
  }, []);

  const establishBaseline = useCallback((state?: { nodes: Node[]; edges: Edge[]; idCounter?: number }) => {
    const baseline = {
      nodes: state?.nodes ?? nodes,
      edges: state?.edges ?? edges,
      idCounter: state?.idCounter ?? idCounter,
    };
    seedHistory(baseline, 'Baseline');
    setLastSavedState(baseline);
  }, [nodes, edges, idCounter, seedHistory]);

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
    setHistoryPaused,
    establishBaseline,
  };
}