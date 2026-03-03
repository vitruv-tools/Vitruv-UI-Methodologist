import { Connection, Node } from 'reactflow';
import { FlowEdge, FlowNode } from '../types';

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
    params.sourceHandle?.startsWith("reaction") == true &&
    params.targetHandle?.startsWith("reaction") == true &&
    (src as FlowNode)?.data?.ecore?.model !=
      (tgt as FlowNode)?.data?.ecore?.model &&
    (src as FlowNode)?.data?.ecore != undefined &&
    (tgt as FlowNode)?.data?.ecore != undefined
  ) {
    return {
      id: `edge-${getId()}`,
      type: "fine-granular-reaction",
      source: params.source!,
      target: params.target!,
      sourceHandle: params.sourceHandle ?? auto.s,
      targetHandle: params.targetHandle ?? auto.t,
      data: {
        ecore: {
          fromModel: (src as FlowNode)!.data!.ecore!.model,
          toModel: (tgt as FlowNode)!.data!.ecore!.model,
          eObjectSourceId: (src as FlowNode)!.data!.ecore!.eObjectId,
          eObjectTargetId: (tgt as FlowNode)!.data!.ecore!.eObjectId,
        },
        relationshipType: "association",
      },
    };
  }
  return null;
}
