import type { Connection } from "reactflow";
import type { FlowEdge, FlowNode } from "../../types";

export interface EdgeValidator {
    isApplicable: () => boolean;
    isValidConnection: (connection: Connection, nodes: FlowNode[], edges: FlowEdge[]) => boolean;
}