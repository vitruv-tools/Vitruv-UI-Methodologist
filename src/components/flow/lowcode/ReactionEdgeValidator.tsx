import type { Connection } from "reactflow";
import { MainContextType } from "../../../contexts/MainContext";
import type { FlowNode, FlowEdge } from "../../../types";
import type { EdgeValidator } from "../EdgeValidator";

export class ReactionEdgeValidator implements EdgeValidator {
  isApplicable(mainContext: MainContextType) {
    return mainContext?.mode === "reactions";
  };

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
