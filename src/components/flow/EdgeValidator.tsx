import type { Connection } from "reactflow";
import type { FlowEdge, FlowNode } from "../../types";

/**
 * Contract for validating whether a React Flow edge connection is allowed.
 */
export interface EdgeValidator {
    /**
     * Indicates whether the validator should be considered for the current editor state.
     * @returns {boolean} True when this validator is active.
     */
    isApplicable: () => boolean;

    /**
     * Evaluates whether a proposed connection is valid.
     * @param {Connection} connection - The proposed source/target connection.
     * @param {FlowNode[]} nodes - The current diagram nodes.
     * @param {FlowEdge[]} edges - The current diagram edges.
     * @returns {boolean} True when the connection satisfies validator rules.
     */
    isValidConnection: (connection: Connection, nodes: FlowNode[], edges: FlowEdge[]) => boolean;
}