import { Node, Edge, Connection, OnConnectStartParams } from "reactflow";
import { FlowData, FlowEdge } from "../types/flow";
import {
  OnEdgeClickParams,
  OnEdgeClickParamsExtension,
  OnEdgeDeleteParams,
} from "../types/EdgeEventHandlers";
import { onEdgeClick as umlOnEdgeClick } from "./UMLUtils";
import { onEdgeDelete as reactionsOnEdgeDelete } from "./ReactionUtils";
import {
  onEdgeClick as fineGranularReactionOnEdgeClick,
  onEdgeDelete as fineGranularReactionOnEdgeDelete,
  disableReactionSourceHandles,
  enableReactionSourceHandles,
  enableReactionTargetHandles,
} from "./FineGranularReactionUtils";
import { useProjectStore } from "../store/Project";

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

/**
 * Updates the CSS pointer-events value for a handle category and direction.
 *
 * @param category Handle group to update.
 * @param type Handle direction to update.
 * @param pointerEvents CSS pointer-events value to apply.
 */
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

/**
 * Updates the CSS opacity value for a handle category and direction.
 *
 * The value is clamped to the inclusive range [0, 1] before being written to
 * the root document element.
 *
 * @param category Handle group to update.
 * @param type Handle direction to update.
 * @param opacity Desired opacity value.
 */
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

/**
 * Updates the CSS opacity value for reaction edges.
 *
 * The value is clamped to the inclusive range [0, 1] before being written to
 * the root document element.
 *
 * @param category Edge category to update.
 * @param opacity Desired opacity value.
 */
export function setEdgeOpacity(
  category: "reaction",
  opacity: number,
) {
  let opacityStr: string;
  if (opacity > 1) opacityStr = "1";
  else if (opacity < 0) opacityStr = "0";
  else opacityStr = opacity.toString();
  document.documentElement.style.setProperty(
    `--${category}-edge-opacity`,
    opacityStr,
  );
}

/**
 * Enables both VSUM handles by restoring pointer events and full opacity.
 */
export function enableVsumHandles() {
  setHandlePointerEvents("vsum", "source", "auto");
  setHandlePointerEvents("vsum", "target", "auto");
  setHandleOpacity("vsum", "source", 1);
  setHandleOpacity("vsum", "target", 1);
}

/**
 * Disables both VSUM handles by removing pointer events and hiding them.
 */
export function disableVsumHandles() {
  setHandlePointerEvents("vsum", "source", "none");
  setHandlePointerEvents("vsum", "target", "none");
  setHandleOpacity("vsum", "source", 0);
  setHandleOpacity("vsum", "target", 0);
}

/**
 * Determines whether a connection is valid for the currently applicable edge validators.
 *
 * If no validators apply, the connection is allowed by default.
 *
 * @param edgeValidators All available edge validators.
 * @param nodes Current flow nodes.
 * @param edges Current flow edges.
 * @param params Connection attempt to validate.
 * @returns True when at least one applicable validator accepts the connection.
 */
export function isValidConnection(
  edgeValidators: any[],
  nodes: Node[],
  edges: Edge[],
  params: Connection,
): boolean {
  edgeValidators = edgeValidators.filter((validator) =>
    validator.isApplicable(),
  );
  // TODO(Reinbold): This should be false, but there isnt an edge validator for normal connections yet
  if (edgeValidators.length === 0) {
    console.log(
      "No edge validators applicable, allowing connection by default",
    );
    return true;
  }
  return edgeValidators.some((validator) =>
    validator.isValidConnection(params, nodes, edges),
  );
}

/**
 * Delegates a successful connection event to the provided handler.
 *
 * @param onConnectFS Connection handler to invoke.
 * @param connection Established connection.
 */
export function onConnect(
  onConnectFS: (connection: Connection) => void,
  connection: Connection,
): void {
  onConnectFS(connection);
}

/**
 * Handles connection start events and updates reaction handle availability when needed.
 *
 * @param event Native connect-start event.
 * @param params React Flow connect-start parameters.
 */
export function onConnectStart(
  event: unknown,
  params: OnConnectStartParams,
): void {
  if (useProjectStore.getState().mode === "reactions") {
    disableReactionSourceHandles();
    enableReactionTargetHandles();
  }
}

/**
 * Restores reaction handle availability after a connection interaction ends.
 *
 * @param event Native connect-end event.
 */
export function onConnectEnd(event: MouseEvent | TouchEvent): void {
  if (useProjectStore.getState().mode === "reactions") {
    enableReactionSourceHandles();
    enableReactionTargetHandles();
  }
}

/**
 * Placeholder for reconnect handling.
 *
 * @param oldEdge Edge being reconnected.
 * @param newConnection Replacement connection.
 */
export function onReconnect(oldEdge: Edge, newConnection: Connection): void {
  // Unused
}

/**
 * Placeholder for reconnect-end handling.
 *
 * @param event Native reconnect-end event.
 * @param edge Edge that was being reconnected.
 * @param handleType Handle side involved in the reconnect.
 */
export function onReconnectEnd(
  event: MouseEvent | TouchEvent,
  edge: Edge,
  handleType: "source" | "target",
): void {
  // Unused
}

/**
 * Dispatches delete events to the edge-type-specific handler.
 *
 * @param edges Edges that were removed.
 */
export function onEdgesDelete(edges: FlowEdge[]): void {
  for (const edge of edges) {
    const fullParams: OnEdgeDeleteParams = { edge: edge };
    const handler =
      eventHandlers.onEdgesDelete[
        edge.type as keyof typeof eventHandlers.onEdgesDelete
      ];
    if (handler) {
      handler(fullParams);
    }
  }
}

/**
 * Dispatches edge click events to the edge-type-specific handler.
 *
 * @param params Additional click parameters.
 * @param event React click event.
 * @param edge Clicked edge.
 */
export function onEdgeClick(
  params: OnEdgeClickParamsExtension,
  event: React.MouseEvent,
  edge: Edge,
) {
  const fullParams: OnEdgeClickParams = { ...params, edge: edge, event: event };
  const handler =
    eventHandlers.onEdgeClick[
      edge.type as keyof typeof eventHandlers.onEdgeClick
    ];
  if (handler) {
    handler(fullParams);
  }
}

/**
 * Type-specific event handlers for edge click and delete interactions.
 */
export const eventHandlers = {
  onEdgeClick: {
    uml: umlOnEdgeClick,
    "fine-granular-reaction": fineGranularReactionOnEdgeClick,
  },
  onEdgesDelete: {
    reactions: reactionsOnEdgeDelete,
    "fine-granular-reaction": fineGranularReactionOnEdgeDelete,
  },
};

/**
 * Resolves the backend metamodel identifier from either of the supported source fields.
 *
 * @param metaModelId Primary metamodel identifier.
 * @param metaModelSourceId Fallback metamodel identifier.
 * @returns The first numeric identifier found, or undefined when neither is numeric.
 */
export function getBackendMetaModelId(
  metaModelId?: any,
  metaModelSourceId?: any,
): number | undefined {
  if (metaModelId !== undefined && typeof metaModelId === "number") {
    return metaModelId;
  }
  if (
    metaModelSourceId !== undefined &&
    typeof metaModelSourceId === "number"
  ) {
    return metaModelSourceId;
  }
  return undefined;
}

/**
 * Chooses the best source and target handle pair for two nodes based on their relative position.
 *
 * @param src Source node.
 * @param tgt Target node.
 * @param preferredSource Preferred source handle if no nodes are available.
 * @param preferredTarget Preferred target handle if no nodes are available.
 * @param supportLeftRight Whether horizontal handle selection is allowed.
 * @param supportTopBottom Whether vertical handle selection is allowed.
 * @returns The selected source and target handle names plus their directions when available.
 */
export function chooseHandlesForPair(
  src?: Node,
  tgt?: Node,
  preferredSource?: string | null,
  preferredTarget?: string | null,
  supportLeftRight: boolean = true,
  supportTopBottom: boolean = true,
) {
  if (!src || !tgt) {
    return {
      s: preferredSource ?? undefined,
      t: preferredTarget ?? undefined,
    } as const;
  }
  const dx = (tgt.position?.x ?? 0) - (src.position?.x ?? 0);
  const dy = (tgt.position?.y ?? 0) - (src.position?.y ?? 0);
  if (Math.abs(dx) >= Math.abs(dy) && supportLeftRight) {
    const s = dx >= 0 ? "right-source" : "left-source";
    const sourceDirection = dx >= 0 ? "right" : "left";
    const t = dx >= 0 ? "left-target" : "right-target";
    const targetDirection = dx >= 0 ? "left" : "right";
    return { s, t, sourceDirection, targetDirection } as const;
  } else if (supportTopBottom) {
    const s = dy >= 0 ? "bottom-source" : "top-source";
    const sourceDirection = dy >= 0 ? "bottom" : "top";
    const t = dy >= 0 ? "top-target" : "bottom-target";
    const targetDirection = dy >= 0 ? "top" : "bottom";
    return { s, t, sourceDirection, targetDirection } as const;
  }
  return { s: undefined, t: undefined, sourceDirection: undefined, targetDirection: undefined };
}