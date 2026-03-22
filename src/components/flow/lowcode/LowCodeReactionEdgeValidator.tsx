import type { Connection } from "reactflow";
import { useProjectStore } from "../../../store/Project";
import type { FlowNode, FlowEdge } from "../../../types";
import type { EdgeValidator } from "../EdgeValidator";

/**
 * Validates whether a connection can be created between reaction handles in low-code mode.
 */
export class LowCodeReactionEdgeValidator implements EdgeValidator {
  /**
   * Indicates whether this validator should run for the current editor mode.
   * @returns {boolean} True when the project mode is set to reactions.
   */
  isApplicable() {
    return useProjectStore.getState().mode === "reactions";
  };

  /**
   * Validates a reaction connection between two nodes based on selected handles and models.
   * @param {Connection} connection - The connection candidate created by React Flow.
   * @param {FlowNode[]} nodes - The current nodes available in the diagram.
   * @param {FlowEdge[]} edges - The current edges available in the diagram.
   * @returns {boolean} True when both handles are reaction handles and nodes belong to different models.
   */
  isValidConnection(
    connection: Connection,
    nodes: FlowNode[],
    edges: FlowEdge[],
  ): boolean {
    if (
      connection.sourceHandle?.startsWith("reaction") &&
      connection.targetHandle?.startsWith("reaction")
    ) {
      // pick best handles if not provided
      const findNode = (id?: string | null) => nodes.find((n) => n.id === id);
      const src = findNode(connection.source);
      const tgt = findNode(connection.target);
      if (!src || !tgt) {
        return false;
      }

      if (src.data.ecore?.model != tgt.data.ecore?.model) {
        console.log(`Valid reaction connection between different models src ${src.data.ecore?.model} and target ${tgt.data.ecore?.model}`);
        return true;
      }
    }
    console.log("Invalid reaction connection between different models");
    return false;
  }
}
