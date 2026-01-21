import type { Connection } from "reactflow";
import type { FlowNode, FlowEdge } from "../../types";
import type { EdgeValidator } from "./EdgeValidator";

export class ReactionEdgeValidator implements EdgeValidator {
  isValidConnection(
    connection: Connection,
    nodes: FlowNode[],
    edges: FlowEdge[],
  ): boolean {
    // pick best handles if not provided
    const findNode = (id?: string | null) => nodes.find((n) => n.id === id);
    const src = findNode(connection.source);
    const tgt = findNode(connection.target);

    if (
      connection.sourceHandle === "reaction" &&
      connection.targetHandle === "reaction"
    ) {
      if (src?.data?.model != tgt?.data?.model) {
        console.log("Valid reaction connection between different models");
        return true;
      }
    }
    console.log("Invalid reaction connection between different models");
    return false;
  }
}
