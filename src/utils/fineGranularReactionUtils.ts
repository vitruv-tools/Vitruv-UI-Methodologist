import { Connection, Node } from 'reactflow';
import { ActiveVsumDetails, NoActiveVsum, NoVsumDetailsStore } from '../store/VsumDetails';
import { FlowEdge, FlowNodeECoreData, UMLNode } from '../types';

export function getProperEObjectIdFromHandle(handleId: string, ecore: FlowNodeECoreData) {
  const eObjectIds = [ecore.eObjectId, ecore.eAttributeIds, ecore.eReferenceIds, ecore.eOperationIds, ecore.eAnnotationIds, ecore.eSuperTypeIds].flat();
  eObjectIds.sort((a, b) => b.length - a.length); // Sort by length to ensure we match the longest possible ID first
  for (const eObjectId of eObjectIds) {
    if (handleId.endsWith(eObjectId)) {
      return eObjectId;
    }
  }
  throw new Error(`No matching eObjectId found for handleId ${handleId} and ecore ${JSON.stringify(ecore)}`);
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
): FlowEdge | null {
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
    const fineGranularSourceId = getProperEObjectIdFromHandle(params.sourceHandle, (src as UMLNode).data.ecore!);
    const fineGranularTargetId = getProperEObjectIdFromHandle(params.targetHandle, (tgt as UMLNode).data.ecore!);
    metaModelRelation.fineGranularMetaModelRelationSet.push({
      sourceId: fineGranularSourceId,
      targetId: fineGranularTargetId,
    });
    activeVsumDetails.save();

    return {
      id: `edge-${getId()}`,
      type: "fine-granular-reaction",
      source: params.source!,
      target: params.target!,
      sourceHandle: params.sourceHandle ?? auto.s,
      targetHandle: params.targetHandle ?? auto.t,
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
    if (error instanceof NoActiveVsum || error instanceof NoVsumDetailsStore) {
      console.warn(error);
      return null;
    }
    throw error;
  }
}
