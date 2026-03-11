import { ActiveVsumDetails } from "../store/ActiveVsumDetails";
import { FlowEcoreEdge } from "../types";

export function hasLowCodeReactionConfig(edge: FlowEcoreEdge): boolean {
  const activeVsumDetails = new ActiveVsumDetails();
  const identifiersToBackendMetaModelId =
    activeVsumDetails.getIdentifiersToBackendMetaModelIdMap();
  const sourceModelBackendId = identifiersToBackendMetaModelId.get(
    edge.data!.ecore!.fromModel!,
  )!;
  const targetModelBackendId = identifiersToBackendMetaModelId.get(
    edge.data!.ecore!.toModel!,
  )!;
  let metaModelRelation = activeVsumDetails.getMetaModelRelation({
    sourceId: sourceModelBackendId,
    targetId: targetModelBackendId,
  });
  if (!metaModelRelation) {
    return false;
  }
  let fineGranularMetaModelRelation =
    metaModelRelation.fineGranularMetaModelRelationSet?.find(
      (relation) =>
        relation.sourceId === edge.data!.ecore!.eObjectSourceId &&
        relation.targetId === edge.data!.ecore!.eObjectTargetId,
    );
  if (!fineGranularMetaModelRelation) {
    return false;
  }

  return fineGranularMetaModelRelation.lowCodeReactionRequestBase != null;
}


export function temporarilySaveLowCodeReactionConfig(
  fieldValues: Record<string, any>,
  edge: FlowEcoreEdge,
) {
  console.log("💾 Saving reaction configuration to VSUM details");
  const activeVsumDetails = new ActiveVsumDetails();
  const identifiersToBackendMetaModelId =
    activeVsumDetails.getIdentifiersToBackendMetaModelIdMap();
  const sourceModelBackendId = identifiersToBackendMetaModelId.get(
    edge.data!.ecore!.fromModel!,
  )!;
  const targetModelBackendId = identifiersToBackendMetaModelId.get(
    edge.data!.ecore!.toModel!,
  )!;
  let metaModelRelation = activeVsumDetails.getMetaModelRelation({
    sourceId: sourceModelBackendId,
    targetId: targetModelBackendId,
  });
  if (!metaModelRelation) {
    throw new Error(
      `No meta model relation found for source model ID ${sourceModelBackendId} and target model ID ${targetModelBackendId}`,
    ); // This should not happen as the edge should have created a meta model relation on connect if it didn't exist!
  }
  let fineGranularMetaModelRelation =
    metaModelRelation.fineGranularMetaModelRelationSet?.find(
      (relation) =>
        relation.sourceId === edge.data!.ecore!.eObjectSourceId &&
        relation.targetId === edge.data!.ecore!.eObjectTargetId,
    );
  if (!fineGranularMetaModelRelation) {
    throw new Error(
      `No fine-grained meta model relation found for source object ID ${edge.data!.ecore!.eObjectSourceId} and target object ID ${edge.data!.ecore!.eObjectTargetId}`,
    ); // This should not happen as the edge should have created a fine-grained meta model relation on connect if it didn't exist!
  }

  fineGranularMetaModelRelation.lowCodeReactionRequestBase = fieldValues;
  activeVsumDetails.saveToStore();
}
