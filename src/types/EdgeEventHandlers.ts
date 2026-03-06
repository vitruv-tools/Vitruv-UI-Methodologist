import { FlowNode, FlowEdge, FlowEcoreEdge } from "./flow";

export type OnEdgeClickParams = OnEdgeClickParamsExtension & OnEdgeClickParamsDefault;

export type OnEdgeDeleteParams = { edge: FlowEdge };

export type OnEdgeClickParamsExtension = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export type OnEdgeClickParamsDefault = {
  edge: FlowEdge,
  event: React.MouseEvent,
};