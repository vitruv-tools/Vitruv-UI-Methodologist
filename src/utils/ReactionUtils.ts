import { Edge } from "reactflow";
import { ActiveVsumDetails } from "../store/ActiveVsumDetails";
import { NoVsumDetailsStoreError } from "../store/NoVsumDetailsStoreError";
import { NoActiveVsumError } from "../store/NoActiveVsumError";
import { FlowEdge } from "../types";
import { FlowMetaModelRelationData, isFlowMetaModelRelationData } from "../types/FlowMetaModelRelationData";
import { OnEdgeDeleteParams } from "../types/EdgeEventHandlers";
import { isFlowFineGranularMetaModelRelationData } from "../types/FlowFineGranularMetaModelRelationData";

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
      reactionFileStorageId: null,
      fineGranularMetaModelRelationSet: [],
    });
    activeVsumDetails.saveToStore();
  } catch (error) {
    if (error instanceof NoActiveVsumError || error instanceof NoVsumDetailsStoreError) {
      console.warn(error);
      return;
    }
    throw error;
  }
}

export function onEdgeDelete(params: OnEdgeDeleteParams) {
  const edge = params.edge as FlowEdge & { data: FlowMetaModelRelationData };
  const activeVsumDetails = new ActiveVsumDetails();
  activeVsumDetails.removeMetaModelRelation({
    sourceId: edge.data.sourceMetaModelId!,
    targetId: edge.data.targetMetaModelId!,
  });
  activeVsumDetails.saveToStore();
}

export function removeReactionEdgeFromVsumDetails(edge: Edge<unknown> | undefined) {
  const data = edge?.data;
  const activeVsumDetails = new ActiveVsumDetails();
  if (isFlowFineGranularMetaModelRelationData(data)) {
    activeVsumDetails.removeFineGranularMetaModelRelation({ sourceId: data.ecore.eObjectSourceId, targetId: data.ecore.eObjectTargetId });
  } else if (isFlowMetaModelRelationData(data)) {
    activeVsumDetails.removeMetaModelRelation({ sourceId: data.sourceMetaModelId!, targetId: data.targetMetaModelId! });
  }
  else {
    throw new Error(`Tried to add a reaction file id to edge ${edge?.id} that is neither a meta model relation nor a fine granular meta model relation!`);
  }
  activeVsumDetails.saveToStore();
}

export function addReactionFileIdToVsumDetails(edge: Edge<unknown> | undefined, reactionFileId: number) {
  const data = edge?.data;
  const activeVsumDetails = new ActiveVsumDetails();
  if (isFlowFineGranularMetaModelRelationData(data)) {
    const metaModelRelation = activeVsumDetails.getFineGranularMetaModelRelation({ sourceId: data.ecore.eObjectSourceId, targetId: data.ecore.eObjectTargetId });
    if (metaModelRelation == null) {
      console.warn(`Could not find fine granular meta model relation for edge ${edge?.id} to add reaction file id!`);
      return;
    }
    metaModelRelation!.reactionFileStorageId = reactionFileId;
  } else if (isFlowMetaModelRelationData(data)) {
    const metaModelRelation = activeVsumDetails.getMetaModelRelation({ sourceId: data.sourceMetaModelId!, targetId: data.targetMetaModelId! });
    if (metaModelRelation == null) {
      console.warn(`Could not find meta model relation for edge ${edge?.id} to add reaction file id!`);
      return;
    }
    metaModelRelation!.reactionFileStorageId = reactionFileId;
  }
  else {
    throw new Error(`Tried to add a reaction file id to edge ${edge?.id} that is neither a meta model relation nor a fine granular meta model relation!`);
  }
  activeVsumDetails.saveToStore();
}