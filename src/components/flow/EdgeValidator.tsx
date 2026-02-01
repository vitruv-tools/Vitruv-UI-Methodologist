import type { Connection } from "reactflow";
import { MainContextType } from "../../contexts/MainContext";
import type { FlowEdge, FlowNode } from "../../types";

export interface EdgeValidator {
    isApplicable: (mainContext: MainContextType) => boolean;
    isValidConnection: (connection: Connection, nodes: FlowNode[], edges: FlowEdge[]) => boolean;
}