import { Node, Edge } from 'reactflow';

export interface FlowNode extends Node {
  data: {
    label: string;
    onLabelChange?: (id: string, label: string) => void;
  };
}

export type FlowEdge = Edge & {
  // Add any custom edge properties here
};

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export type NodeType = 'sequence' | 'object';

export interface DragItem {
  type: NodeType;
  label: string;
} 