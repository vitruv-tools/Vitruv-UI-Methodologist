import { Connection, Edge, Node } from "reactflow";
import { ActiveVsumDetails } from "../store/ActiveVsumDetails";
import { NoVsumDetailsStoreError } from "../store/NoVsumDetailsStoreError";
import { NoActiveVsumError } from "../store/NoActiveVsumError";
import {
  FlowEcoreEdge,
  FlowNode,
  FlowNodeECoreData,
  UMLNode,
} from "../types";
import {
  OnEdgeClickParams,
  OnEdgeDeleteParams,
} from "../types/EdgeEventHandlers";
import { setHandlePointerEvents, chooseHandlesForPair, setEdgeOpacity, setHandleOpacity } from "./flowUtils";
import { useSelectedEdgeStore } from "../store/SelectedEdge";
import { EditableFineGranularMetaModelRelation } from "../types/EditableVsumDetails";
import { findClassNameFromEcoreIdentifier, findPackageNameFromEcoreIdentifier, getHandleIdForEcoreElement, getNodeNameFromEcoreIdentifier } from "./UMLFromEcoreTS";
import { isFlowFineGranularMetaModelRelationData } from "../types/FlowFineGranularMetaModelRelationData";

export function deleteFineGranularReactionEdge(edge: FlowEcoreEdge) {
  const activeVsumDetails = new ActiveVsumDetails();
  activeVsumDetails.removeFineGranularMetaModelRelation({ sourceId: edge.data!.ecore!.eObjectSourceId, targetId: edge.data!.ecore!.eObjectTargetId });
}

export function getProperEObjectIdFromHandle(
  handleId: string,
  ecore: FlowNodeECoreData,
) {
  const eObjectIds = [
    ecore.eObjectId,
    ecore.eAttributeIds,
    ecore.eReferenceIds,
    ecore.eOperationIds,
    ecore.eAnnotationIds,
    ecore.eSuperTypeIds,
  ].flat();
  eObjectIds.sort((a, b) => b.length - a.length); // Sort by length to ensure we match the longest possible ID first
  for (const eObjectId of eObjectIds) {
    if (handleId.endsWith(eObjectId)) {
      return eObjectId;
    }
  }
  throw new Error(
    `No matching eObjectId found for handleId ${handleId} and ecore ${JSON.stringify(ecore)}`,
  );
}

export function tryInferReactionFiledIdForFineGranularReactionEdge(edge: Edge) {
  if (isFlowFineGranularMetaModelRelationData(edge.data)) {
    const activeVsumDetails = new ActiveVsumDetails();
    const fgmmr = activeVsumDetails.getFineGranularMetaModelRelation({ sourceId: edge.data.ecore.eObjectSourceId, targetId: edge.data.ecore.eObjectTargetId });
    const reactionFileId = fgmmr?.reactionFileStorageId;
    return reactionFileId;
  }
}

export function createExistingFineGranularReactionEdge(nodes: Node[], fgEdge: EditableFineGranularMetaModelRelation): FlowEcoreEdge {
  if (fgEdge.id == null) {
    throw new Error("Existing fine-granular meta model relation must have an id to be converted to an edge");
  }

  const source = findClassNameFromEcoreIdentifier(fgEdge.sourceId)!;
  const target = findClassNameFromEcoreIdentifier(fgEdge.targetId)!;
  const sourceNodeId = getNodeNameFromEcoreIdentifier(source);
  const targetNodeId = getNodeNameFromEcoreIdentifier(target);
  const sourceNode = nodes.find(n => n.id === sourceNodeId);
  const targetNode = nodes.find(n => n.id === targetNodeId);

  if (sourceNode == null || targetNode == null) {
    throw new Error(`Could not find nodes ${sourceNodeId} ${targetNodeId} for fine-granular reaction edge: ${fgEdge.id}`);
  }

  let { sourceHandle, targetHandle }: { sourceHandle: string | undefined; targetHandle: string | undefined; } = calculateOptimalFineGranularReactionHandles(fgEdge.sourceId, fgEdge.targetId, sourceNode, targetNode);

  return {
      id: `${fgEdge.id!}`,
      type: "fine-granular-reaction",
      source: source,
      target: target,
      sourceHandle: sourceHandle,
      targetHandle: targetHandle,
      zIndex: 9999, // Ensure fine-granular reaction edges are always on top
      data: {
        reactionFileId: fgEdge.reactionFileStorageId,
        ecore: {
          fromModel: findPackageNameFromEcoreIdentifier(fgEdge.sourceId)!,
          toModel: findPackageNameFromEcoreIdentifier(fgEdge.targetId)!,
          eObjectSourceId: fgEdge.sourceId,
          eObjectTargetId: fgEdge.targetId,
        },
        relationshipType: "association",
      },
    };
}

export function calculateOptimalFineGranularReactionHandles(sourceId: string, targetId: string, sourceNode: Node<any, string | undefined>, targetNode: Node<any, string | undefined>) {
  const source = findClassNameFromEcoreIdentifier(sourceId)!;
  const target = findClassNameFromEcoreIdentifier(targetId)!;

  const auto = chooseHandlesForPair(sourceNode, targetNode, undefined, undefined, true, false);
  let sourceHandle: string | undefined = auto.s;
  let targetHandle: string | undefined = auto.t;
  if (auto.sourceDirection != null) {
    sourceHandle = getHandleIdForEcoreElement(source, auto.sourceDirection, "source");
  }
  if (auto.targetDirection != null) {
    targetHandle = getHandleIdForEcoreElement(target, auto.targetDirection, "target");
  }
  return { sourceHandle, targetHandle };
}

/**
 * Creates a fine-granular reaction edge between different models
 * Returns the edge if conditions are met, null otherwise
 */
export function createFineGranularReactionEdge(
  params: Connection,
  src: Node<any, string | undefined> | undefined,
  tgt: Node<any, string | undefined> | undefined,
  getId: () => string,
  auto: { readonly s: string | undefined; readonly t: string | undefined },
): FlowEcoreEdge | null {
  if (
    params.sourceHandle?.startsWith("reaction") != true ||
    params.targetHandle?.startsWith("reaction") != true ||
    (src as UMLNode)?.data?.ecore == undefined ||
    (tgt as UMLNode)?.data?.ecore == undefined
  ) {
    return null;
  }

  try {
    const activeVsumDetails = new ActiveVsumDetails();
    let metaModelRelation = activeVsumDetails.getMetaModelRelation({
      sourceId: (src as UMLNode).data.backendMetaModelId!,
      targetId: (tgt as UMLNode).data.backendMetaModelId!,
    });
    if (!metaModelRelation) {
      metaModelRelation = activeVsumDetails.addMetaModelRelation({
        id: null,
        sourceId: (src as UMLNode).data.backendMetaModelId!,
        targetId: (tgt as UMLNode).data.backendMetaModelId!,
        fineGranularMetaModelRelationSet: [],
      });
    }

    // Fine granular ecore ids are encoded in the handle id, we need to extract them to know which EObjects are actually involved
    // E.g. source handle might look like "reaction-left-source-http://vitruv.tools/methodologisttemplate/model2::Entity/name",
    // so we look for a matching EAttribute on the source node
    const fineGranularSourceId = getProperEObjectIdFromHandle(
      params.sourceHandle,
      (src as UMLNode).data.ecore!,
    );
    const fineGranularTargetId = getProperEObjectIdFromHandle(
      params.targetHandle,
      (tgt as UMLNode).data.ecore!,
    );
    metaModelRelation.fineGranularMetaModelRelationSet.push({
      id: null,
      sourceId: fineGranularSourceId,
      targetId: fineGranularTargetId,
    });
    activeVsumDetails.saveToStore();

    return {
      id: `edge-${getId()}`,
      type: "fine-granular-reaction",
      source: params.source!,
      target: params.target!,
      sourceHandle: params.sourceHandle ?? auto.s,
      targetHandle: params.targetHandle ?? auto.t,
      zIndex: 9999, // Ensure fine-granular reaction edges are always on top
      data: {
        ecore: {
          fromModel: (src as UMLNode)!.data!.ecore!.model,
          toModel: (tgt as UMLNode)!.data!.ecore!.model,
          eObjectSourceId: fineGranularSourceId,
          eObjectTargetId: fineGranularTargetId,
        },
        relationshipType: "association",
      },
    };
  } catch (error) {
    if (
      error instanceof NoActiveVsumError ||
      error instanceof NoVsumDetailsStoreError
    ) {
      console.warn(error);
      return null;
    }
    throw error;
  }
}

/**
 * Edgle click handler that is called from the FlowCanvas when a reactions edge is clicked.
 *
 *  @param params The edge click parameters.
 */
export function onEdgeClick(params: OnEdgeClickParams) {
  useSelectedEdgeStore.setState({ selectedEdge: params.edge as FlowEcoreEdge | null });
}

export function onEdgeDelete(params: OnEdgeDeleteParams) {
  const edge = params.edge as FlowEcoreEdge;
  const activeVsumDetails = new ActiveVsumDetails();
  const sourceMetaModelId = activeVsumDetails
    .getIdentifiersToBackendMetaModelIdMap()
    .get(edge.data!.ecore!.fromModel!)!;
  const targetMetaModelId = activeVsumDetails
    .getIdentifiersToBackendMetaModelIdMap()
    .get(edge.data!.ecore!.toModel!)!;
  const metaModelRelation = activeVsumDetails.getMetaModelRelation({
    sourceId: sourceMetaModelId,
    targetId: targetMetaModelId,
  });
  if (metaModelRelation == null) {
    console.warn(
      `No meta model relation found for edge ${edge.id} with source model ${edge.data!.ecore!.fromModel} and target model ${edge.data!.ecore!.toModel}. Cannot delete fine-grained meta model relation.`,
    );
    return;
  }
  const index = metaModelRelation.fineGranularMetaModelRelationSet.findIndex(
    (relation) =>
      relation.sourceId === edge.data!.ecore!.eObjectSourceId &&
      relation.targetId === edge.data!.ecore!.eObjectTargetId,
  );
  if (index == null || index == -1) {
    console.warn(
      `No fine-grained meta model relation found for edge ${edge.id}. Cannot delete.`,
    );
    return;
  }
  metaModelRelation?.fineGranularMetaModelRelationSet?.splice(index, 1);
  activeVsumDetails.saveToStore();

  if (useSelectedEdgeStore.getState().selectedEdge?.id == edge.id) {
    useSelectedEdgeStore.setState({ selectedEdge: null });
  }
}

export function isReactionGhostNode(node: FlowNode): boolean {
  return node.type === "ghost" && node.id.startsWith("reaction-ghost-");
}

export function recalculateNodesOnEdgesForReactions(
  currentNodes: FlowNode[],
  currentEdges: FlowEcoreEdge[],
): { currentNodes: FlowNode[]; currentEdges: FlowEcoreEdge[] } {
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

export function enableReactionHandles() {
  enableReactionSourceHandles();
  enableReactionTargetHandles();
}

export function enableReactionEdges() {
  setEdgeOpacity("reaction", 1);
}

export function disableReactionHandles() {
  disableReactionSourceHandles();
  disableReactionTargetHandles();
}

export function disableReactionEdges() {
  setEdgeOpacity("reaction", 0);
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
