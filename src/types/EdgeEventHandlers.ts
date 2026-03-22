import { FlowNode, FlowEdge } from "./flow";

/**
 * Complete payload for edge click handlers.
 */
export type OnEdgeClickParams = OnEdgeClickParamsExtension & OnEdgeClickParamsDefault;

/**
 * Payload for edge deletion handlers.
 */
export type OnEdgeDeleteParams = { edge: FlowEdge };

/**
 * Additional graph context passed to edge click handlers.
 */
export type OnEdgeClickParamsExtension = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

/**
 * Default click event payload for a selected edge.
 */
export type OnEdgeClickParamsDefault = {
  edge: FlowEdge,
  event: React.MouseEvent,
};