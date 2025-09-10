import { useCallback, useState, useEffect } from 'react';
import { useNodesState, useEdgesState, Connection, Edge, Node } from 'reactflow';
import { useUndoRedo } from './useUndoRedo';

export function useFlowState() {
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
      const newEdge: Edge = {
        id: `edge-${getId()}`,
        type: 'uml',
        source: params.source!,
        target: params.target!,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        data: {
          relationshipType: 'association',
          label: 'Association',
        },
      };
      setEdges((eds) => eds.concat(newEdge));
    },
    [getId, setEdges]
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
    const newEdge: Edge = {
      ...edge,
      id: `edge-${getId()}`,
    };
    console.log('useFlowState.addEdge called with:', edge);
    console.log('Created newEdge:', newEdge);
    setEdges((eds) => {
      const newEdges = eds.concat(newEdge);
      console.log('Updated edges array:', newEdges);
      return newEdges;
    });
    return newEdge.id;
  }, [getId, setEdges]);

  const removeEdge = useCallback((id: string) => {
    setEdges((eds) => eds.filter((edge) => edge.id !== id));
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
  };
} 