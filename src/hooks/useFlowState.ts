import { useCallback, useState, useEffect } from 'react';
import { useNodesState, useEdgesState, Connection, Edge, Node, NodeChange } from 'reactflow';
import { DiagramState, useUndoRedo } from './useUndoRedo';
import { createFineGranularReactionEdge } from '../utils/FineGranularReactionUtils';
import { ActiveVsumDetails } from '../store/ActiveVsumDetails';
import { EditableVsumDetails } from '../types/EditableVsumDetails';
import { NoVsumDetailsStoreError } from '../store/NoVsumDetailsStoreError';
import { chooseHandlesForPair as utilChooseHandlesForPair } from '../utils';

interface UseFlowStateProps {
  userId?: string;
  projectId?: string;
}

export function useFlowState(props?: UseFlowStateProps) {
  const { userId, projectId } = props || {};
  
  const chooseHandlesForPair = useCallback(utilChooseHandlesForPair, []);

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
  const [isDraggingNode, setIsDraggingNode] = useState(false);

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
    idCounter: 1,
    vsumDetails: null,
  });

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
    if (isApplyingState) return;
    if (isDraggingNode) return;
    
    let vsumDetails: EditableVsumDetails | null = null;
    try {
      const activeVsumDetails = new ActiveVsumDetails();
      vsumDetails = activeVsumDetails.get();
    } catch (error) {
      if (!(error instanceof NoVsumDetailsStoreError)) {
        // VSUM Details might not have been loaded yet, but thats not an issue.
        throw error; // re-throw if it's a different error
      } 
    }
    const currentDiagramState = {
      nodes,
      edges,
      idCounter,
      vsumDetails
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
  }, [nodes, edges, idCounter, saveState, isApplyingState, lastSavedState, isDraggingNode]);

  const applyState = useCallback((state: DiagramState) => {
    if (state.vsumDetails != null) {
      const activeVsumDetails = new ActiveVsumDetails();
      activeVsumDetails.overwrite(state.vsumDetails);
      activeVsumDetails.saveToStore();
    }
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
      
      //TODO(Reinbold): This doesn't create a workspace snapshot :(
      const fineGranularEdge = createFineGranularReactionEdge(params, src, tgt, getId, auto);
      if (fineGranularEdge) {
        setEdges((eds) => eds.concat(fineGranularEdge));
        return;
      } else if (
        params.sourceHandle?.startsWith("reaction") !== true &&
        params.targetHandle?.startsWith("reaction") !== true
      ) {
        const newEdge: Edge = {
          id: `edge-${getId()}`,
          type: "uml",
          source: params.source!,
          target: params.target!,
          sourceHandle: params.sourceHandle ?? auto.s,
          targetHandle: params.targetHandle ?? auto.t,
          data: {
            relationshipType: "association",
            label: "Association",
          },
        };
        setEdges((eds) => eds.concat(newEdge));
      }
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

  const onNodesChangeHandler = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);

    const finishedDragging = changes.some((change: any) => 
        change.type === 'position' && change.dragging === false
    );
    const startedDragging = changes.some((change: any) => 
        change.type === 'position' && change.dragging === true
    );
    if (finishedDragging) {
      setIsDraggingNode(false);
    }
    else if (startedDragging) {
      setIsDraggingNode(true);
    }
  }, [onNodesChange]);

  return {
    nodes,
    edges,
    onNodesChange: onNodesChangeHandler,
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
