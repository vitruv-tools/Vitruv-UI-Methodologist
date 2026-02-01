import { Node, Edge, Connection, OnConnectStartParams } from "reactflow";
import type { MainContextType } from "../contexts/MainContext";
import { FlowData, OnEdgeClickParams, OnEdgeClickParamsExtension } from "../types/flow";
import { onEdgeClick as umlOnEdgeClick } from '../components/flow/UMLRelationship';
import { onEdgeClick as reactionsOnEdgeClick } from '../components/flow/ReactionRelationship';

export const exportFlowData = (nodes: Node[], edges: Edge[]): FlowData => {
  return {
    nodes: nodes.map((node) => ({
      ...node,
      data: (() => {
        const { onLabelChange, ...rest } = node.data || {};
        return { label: rest.label || "", ...rest };
      })(),
    })),
    edges: edges.map((edge) => ({
      ...edge,
    })),
  };
};

export const importFlowData = (
  flowData: FlowData,
): { nodes: Node[]; edges: Edge[] } => {
  return {
    nodes: flowData.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onLabelChange: undefined,
      },
    })),
    edges: flowData.edges,
  };
};

export const validateFlowData = (flowData: FlowData): boolean => {
  if (!flowData.nodes || !Array.isArray(flowData.nodes)) return false;
  if (!flowData.edges || !Array.isArray(flowData.edges)) return false;

  const validNodes = flowData.nodes.every(
    (node) =>
      node.id && node.type && node.position && node.data?.label !== undefined,
  );

  if (!validNodes) return false;

  const nodeIds = new Set(flowData.nodes.map((node) => node.id));
  const validEdges = flowData.edges.every(
    (edge) =>
      edge.id &&
      edge.source &&
      edge.target &&
      nodeIds.has(edge.source) &&
      nodeIds.has(edge.target),
  );

  return validEdges;
};

export const generateFlowId = (): string => {
  const array = new Uint32Array(2);
  crypto.getRandomValues(array);
  const randomPart = Array.from(array)
    .map((n) => n.toString(36))
    .join("");
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

const STORAGE_KEY = "vitruv.documents";
const STORAGE_DATA_KEY = "vitruv.document.data.";

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
  const idx = all.findIndex((m) => m.id === meta.id);
  if (idx >= 0) all[idx] = meta;
  else all.unshift(meta);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
};

export const removeDocumentMeta = (id: string) => {
  const all = listDocuments().filter((m) => m.id !== id);
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

export function setHandlePointerEvents(
  category: "reaction" | "vsum",
  type: "source" | "target",
  pointerEvents: React.CSSProperties["pointerEvents"],
) {
  document.documentElement.style.setProperty(
    `--${category}-handle-pointer-events-${type}`,
    pointerEvents ?? null,
  );
}

export function setHandleOpacity(
  category: "reaction" | "vsum",
  type: "source" | "target",
  opacity: number,
) {
  let opacityStr: string;
  if (opacity > 1) opacityStr = "1";
  else if (opacity < 0) opacityStr = "0";
  else opacityStr = opacity.toString();
  document.documentElement.style.setProperty(
    `--${category}-handle-opacity-${type}`,
    opacityStr,
  );
}

export function enableVsumHandles() {
  setHandlePointerEvents("vsum", "source", "auto");
  setHandlePointerEvents("vsum", "target", "auto");
  setHandleOpacity("vsum", "source", 1);
  setHandleOpacity("vsum", "target", 1);
}

export function disableVsumHandles() {
  setHandlePointerEvents("vsum", "source", "none");
  setHandlePointerEvents("vsum", "target", "none");
  setHandleOpacity("vsum", "source", 0);
  setHandleOpacity("vsum", "target", 0);
}

export function isValidConnection(
  mainContext: MainContextType,
  edgeValidators: any[],
  nodes: Node[],
  edges: Edge[],
  params: Connection,
): boolean {
  edgeValidators = edgeValidators.filter(validator => validator.isApplicable(mainContext));
  // TODO(Reinbold): This should be false, but there isnt an edge validator for normal connections yet
  if (edgeValidators.length === 0) {
    console.log("No edge validators applicable, allowing connection by default");
    return true;
  }
  return edgeValidators.some(validator => validator.isValidConnection(params, nodes, edges));
}

export function onConnect(onConnectFS: (connection: Connection) => void, connection: Connection): void {
  onConnectFS(connection);
}

export function onConnectStart(
  mainContext: MainContextType,
  setCurrentConnectionStartParams: (params: OnConnectStartParams) => void,
  event: unknown,
  params: OnConnectStartParams,
): void {
  // This is only needed due to our outdated React Flow version lacking proper onConnectEnd parameters
  setCurrentConnectionStartParams(params);
  if (mainContext?.mode === "reactions") {
    setHandlePointerEvents("reaction", "source", "none");
    setHandlePointerEvents("reaction", "target", "auto");
    setHandleOpacity("reaction", "source", 0);
    setHandleOpacity("reaction", "target", 1);
  }
}

export function onConnectEnd(mainContext: MainContextType, event: MouseEvent | TouchEvent): void {
  if (mainContext?.mode === "reactions") {
    setHandlePointerEvents("reaction", "source", "auto");
    setHandlePointerEvents("reaction", "target", "none");
    setHandleOpacity("reaction", "source", 1);
    setHandleOpacity("reaction", "target", 0);
  }
}

export function onReconnect(oldEdge: Edge, newConnection: Connection): void {
  // Unused
}

export function onReconnectEnd(event: MouseEvent | TouchEvent, edge: Edge, handleType: "source" | "target"): void {
  // Unused
}

export function onEdgesDelete(edges: Edge[]): void {
  // Unused
}

export function onEdgeClick(params: OnEdgeClickParamsExtension, event: React.MouseEvent, edge: Edge) {
  const fullParams: OnEdgeClickParams = { ...params, edge: edge, event: event };
  const handler = eventHandlers.onEdgeClick[edge.type as keyof typeof eventHandlers.onEdgeClick];
  if (handler) {
    handler(fullParams);
  }
}

export const eventHandlers = {
  onEdgeClick: {
    uml: umlOnEdgeClick,
    reactions: reactionsOnEdgeClick
  }
}