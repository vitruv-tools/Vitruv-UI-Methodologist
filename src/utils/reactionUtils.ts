import { FlowNode, FlowEdge } from "../types";
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
  let anyEdgeChange = false;
  let nextReactionNodeIdNumber: number | null = null;
  for (const edge of currentEdges) {
    if (edge.data?.ecore === undefined) {
      continue;
    }

    let reactionNodeId: string = "";
    if (edge.data?.reactionNodeIdNumber !== undefined) {
      reactionNodeId = `reaction-ghost-${edge.data!.reactionNodeIdNumber}`;
    } else {
      nextReactionNodeIdNumber ??= currentEdges
        .filter((edge) => edge.data!.reactionNodeIdNumber !== undefined)
        .map<number>((edge) => edge.data!.reactionNodeIdNumber!)
        .reduce((acc: number, curr: number) => (curr > acc ? curr : acc), -1);
      nextReactionNodeIdNumber++;
      if (edge.data) {
        edge.data.reactionNodeIdNumber = nextReactionNodeIdNumber;
        anyEdgeChange = true;
      }
      reactionNodeId = `reaction-ghost-${nextReactionNodeIdNumber}`;
    }
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
            eObjectId: edge.data.ecore!.eObjectSourceId!
          }
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
  let edgesToReturn = anyEdgeChange ? [...currentEdges] : currentEdges;
  return { currentNodes: nodesToReturn, currentEdges: edgesToReturn };
}

export function enableReactionHandles() {
  setHandlePointerEvents("reaction", "source", "auto");
  setHandlePointerEvents("reaction", "target", "auto");
  setHandleOpacity("reaction", "source", 1);
  setHandleOpacity("reaction", "target", 1);
}

export function disableReactionHandles() {
  setHandlePointerEvents("reaction", "source", "none");
  setHandlePointerEvents("reaction", "target", "none");
  setHandleOpacity("reaction", "source", 0);
  setHandleOpacity("reaction", "target", 0);
}
