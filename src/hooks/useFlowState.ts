import { useCallback, useState } from 'react';
import { useNodesState, useEdgesState, addEdge, Connection, Edge, Node } from 'reactflow';

export function useFlowState() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [idCounter, setIdCounter] = useState(1);

  const getId = useCallback(() => {
    const newId = idCounter.toString();
    setIdCounter(prev => prev + 1);
    return newId;
  }, [idCounter]);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
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

  const clearFlow = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setIdCounter(1);
  }, [setNodes, setEdges]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNodeLabel,
    removeNode,
    clearFlow,
    getId,
  };
} 