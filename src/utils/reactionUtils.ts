import { Edge } from "reactflow";
import { ActiveVsumDetails } from "../store/ActiveVsumDetails";
import { NoVsumDetailsStoreError } from "../store/NoVsumDetailsStoreError";
import { NoActiveVsumError } from "../store/NoActiveVsumError";
import { FlowEdge } from "../types";
import { FlowMetaModelRelationData } from "../types/FlowMetaModelRelationData";
import { OnEdgeDeleteParams } from "../types/EdgeEventHandlers";

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
