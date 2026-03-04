import { Edge } from "reactflow";
import { ActiveVsumDetails, NoActiveVsum, NoVsumDetailsStore } from "../store/VsumDetails";
import { FlowNode, FlowEdge } from "../types";
import { FlowMetaModelRelationData } from "../types/FlowMetaModelRelationData";
import { setHandlePointerEvents, setHandleOpacity } from "./flowUtils";

export function isReactionGhostNode(node: FlowNode): boolean {
  return node.type === "ghost" && node.id.startsWith("reaction-ghost-");
}

export function recalculateNodesOnEdgesForReactions(
  currentNodes: FlowNode[],
  currentEdges: FlowEdge[],
): { currentNodes: FlowNode[]; currentEdges: FlowEdge[] } {
  console.log("🔄 Recalculating nodes on edges for reactions...");
  const newNodes: FlowNode[] = currentNodes.filter(
    (n) => !isReactionGhostNode(n),
  );

  let anyNodeChange = false;
  for (const edge of currentEdges) {
    if (edge.data?.ecore?.eReferenceId === undefined) {
      continue;
    }

    let reactionNodeId: string = edge.data.ecore.eReferenceId!;
    let node = currentNodes.find((n) => n.id === reactionNodeId);
    if (!node) {
      console.log(
        `➕ Adding missing reaction node ${reactionNodeId} for edge ${edge.id}`,
      );
      const newNode: FlowNode = {
        id: reactionNodeId,
        type: "ghost",
        position: { x: edge.data.labelX ?? 0, y: edge.data.labelY ?? 0 }, // Will be calculated later
        data: {
          label: "",
          ecore: {
            model: edge.data.ecore!.fromModel!,
            eObjectId: edge.data.ecore!.eReferenceId!,
            eAttributeIds: [],
            eReferenceIds: [],
            eOperationIds: [],
            eAnnotationIds: [],
            eSuperTypeIds: [],
          },
        },
      };
      newNodes.push(newNode);
      anyNodeChange = true;
    } else {
      const posX = edge.data?.labelX ?? 0;
      const posY = edge.data?.labelY ?? 0;
      if (
        Math.abs(node.position.x - posX) > 0.01 ||
        Math.abs(node.position.y - posY) > 0.01
      ) {
        const updatedNode: FlowNode = Object.assign({}, node, {
          position: { x: posX, y: posY },
        });
        newNodes.push(updatedNode);
        anyNodeChange = true;
      } else {
        newNodes.push(node);
      }
    }
  }

  let nodesToReturn = anyNodeChange ? newNodes : currentNodes;
  return { currentNodes: nodesToReturn, currentEdges: currentEdges };
}

export function addReactionEdgeToVsumDetails(
  edge: Edge<FlowMetaModelRelationData>,
) {
  if (
    edge.data?.sourceMetaModelId == null ||
    edge.data?.targetMetaModelId == null
  ) {
    console.warn(
      `Cannot add Edge ${edge.id} to VSUM details. ${edge.data?.sourceMetaModelId === undefined ? "Missing sourceMetaModelId." : ""} ${edge.data?.targetMetaModelId === undefined ? "Missing targetMetaModelId." : ""}`,
    );
    return;
  }

  try {
    const activeVsumDetails = new ActiveVsumDetails();
    activeVsumDetails.addMetaModelRelation({
      id: null,
      sourceId: edge.data!.sourceMetaModelId!,
      targetId: edge.data!.targetMetaModelId!,
      fineGranularMetaModelRelationSet: [],
    });
    activeVsumDetails.save();
  } catch (error) {
    if (error instanceof NoActiveVsum || error instanceof NoVsumDetailsStore) {
      console.warn(error);
      return;
    }
    throw error;
  }
}

export function enableReactionHandles() {
  enableReactionSourceHandles();
  enableReactionTargetHandles();
}

export function disableReactionHandles() {
  disableReactionSourceHandles();
  disableReactionTargetHandles();
}

export function enableReactionSourceHandles() {
  setHandlePointerEvents("reaction", "source", "auto");
  setHandleOpacity("reaction", "source", 1);
}

export function disableReactionSourceHandles() {
  setHandlePointerEvents("reaction", "source", "none");
  setHandleOpacity("reaction", "source", 0);
}

export function enableReactionTargetHandles() {
  setHandlePointerEvents("reaction", "target", "auto");
  setHandleOpacity("reaction", "target", 1);
}

export function disableReactionTargetHandles() {
  setHandlePointerEvents("reaction", "target", "none");
  setHandleOpacity("reaction", "target", 0);
}
