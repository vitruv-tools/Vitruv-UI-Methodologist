import { Node, Edge } from 'reactflow';
import { FlowData } from '../types/flow';

export const exportFlowData = (nodes: Node[], edges: Edge[]): FlowData => {
  return {
    nodes: nodes.map(node => ({
      ...node,
      data: (() => {
        const { onLabelChange, ...rest } = node.data || {};
        return { label: rest.label || '', ...rest };
      })()
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
        onLabelChange: undefined,
      }
    })),
    edges: flowData.edges,
  };
};

export const validateFlowData = (flowData: FlowData): boolean => {
  if (!flowData.nodes || !Array.isArray(flowData.nodes)) return false;
  if (!flowData.edges || !Array.isArray(flowData.edges)) return false;
  
  const validNodes = flowData.nodes.every(node => 
    node.id && 
    node.type && 
    node.position && 
    node.data?.label !== undefined
  );
  
  if (!validNodes) return false;
  
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

export interface StoredDocumentMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceFileName?: string;
  uploadId?: string;
}

const STORAGE_KEY = 'vitruv.documents';
const STORAGE_DATA_KEY = 'vitruv.document.data.';

export const listDocuments = (): StoredDocumentMeta[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredDocumentMeta[];
  } catch {
    return [];
  }
};

export const saveDocumentMeta = (meta: StoredDocumentMeta) => {
  const all = listDocuments();
  const idx = all.findIndex(m => m.id === meta.id);
  if (idx >= 0) all[idx] = meta; else all.unshift(meta);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
};

export const removeDocumentMeta = (id: string) => {
  const all = listDocuments().filter(m => m.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  localStorage.removeItem(STORAGE_DATA_KEY + id);
};

export const loadDocumentData = (id: string): FlowData | null => {
  const raw = localStorage.getItem(STORAGE_DATA_KEY + id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FlowData;
  } catch {
    return null;
  }
};

export const saveDocumentData = (id: string, data: FlowData) => {
  localStorage.setItem(STORAGE_DATA_KEY + id, JSON.stringify(data));
};