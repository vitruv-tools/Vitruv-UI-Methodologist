import { Node, Edge } from 'reactflow';
import { FlowData } from '../types/flow';

export const exportFlowData = (nodes: Node[], edges: Edge[]): FlowData => {
  return {
    nodes: nodes.map(node => ({
      ...node,
      data: {
        label: node.data?.label || '',
      }
    })),
    edges: edges.map(edge => ({
      ...edge,
    }))
  };
};

export const importFlowData = (flowData: FlowData): { nodes: Node[], edges: Edge[] } => {
  return {
    nodes: flowData.nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onLabelChange: undefined, // This will be set by the component
      }
    })),
    edges: flowData.edges,
  };
};

export const validateFlowData = (flowData: FlowData): boolean => {
  if (!flowData.nodes || !Array.isArray(flowData.nodes)) return false;
  if (!flowData.edges || !Array.isArray(flowData.edges)) return false;
  
  // Check if all nodes have required properties
  const validNodes = flowData.nodes.every(node => 
    node.id && 
    node.type && 
    node.position && 
    node.data?.label !== undefined
  );
  
  if (!validNodes) return false;
  
  // Check if all edges reference valid nodes
  const nodeIds = new Set(flowData.nodes.map(node => node.id));
  const validEdges = flowData.edges.every(edge => 
    edge.id && 
    edge.source && 
    edge.target && 
    nodeIds.has(edge.source) && 
    nodeIds.has(edge.target)
  );
  
  return validEdges;
};

export const generateFlowId = (): string => {
  const array = new Uint32Array(2);
  crypto.getRandomValues(array);
  const randomPart = Array.from(array)
      .map((n) => n.toString(36))
      .join('');
  return `flow_${Date.now()}_${randomPart}`;
};