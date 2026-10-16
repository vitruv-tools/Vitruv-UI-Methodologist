import type { Edge, Node } from 'reactflow';

/**
 * Common parameter shapes for edge event handler callbacks.
 */

export interface OnEdgeClickParams {
  edge: Edge;
  nodes: Node[];
  edges: Edge[];
  event: React.MouseEvent;
}

export interface OnEdgeDeleteParams {
  edge: Edge;
}

export interface OnEdgeDoubleClickParams {
  edge: Edge;
  nodes: Node[];
  edges: Edge[];
  event: React.MouseEvent;
}
