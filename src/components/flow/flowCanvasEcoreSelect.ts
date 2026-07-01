import { Edge, Node } from 'reactflow';

type CanvasMode = 'modeling' | 'constraints' | 'views';

export type EcoreSelectAction =
  | { kind: 'handled' }
  | { kind: 'set-reaction-source' }
  | { kind: 'clear-reaction-source' }
  | { kind: 'create-reaction-edge'; sourceId: string; targetNode: Node }
  | { kind: 'toggle-constraint-filter'; nodeId: string }
  | { kind: 'select'; nodeId: string; fileName: string };

interface ResolveEcoreSelectParams {
  ecoreNode: Node;
  fileName: string;
  addReactionMode?: boolean;
  readOnly?: boolean;
  reactionSourceId: string | null;
  activeCanvasMode: CanvasMode;
  constraintFilterNodeId?: string | null;
}

export function resolveEcoreFileSelectAction(params: ResolveEcoreSelectParams): EcoreSelectAction {
  const {
    ecoreNode,
    fileName,
    addReactionMode,
    readOnly,
    reactionSourceId,
    activeCanvasMode,
  } = params;

  if (addReactionMode) {
    if (readOnly) return { kind: 'handled' };
    if (!reactionSourceId) return { kind: 'set-reaction-source' };
    if (reactionSourceId === ecoreNode.id) return { kind: 'clear-reaction-source' };
    return { kind: 'create-reaction-edge', sourceId: reactionSourceId, targetNode: ecoreNode };
  }

  if (activeCanvasMode === 'constraints') {
    return { kind: 'toggle-constraint-filter', nodeId: ecoreNode.id };
  }

  return { kind: 'select', nodeId: ecoreNode.id, fileName };
}

export function buildReactionEdgeFromNodes(
  sourceNode: Node,
  targetNode: Node,
  color: string,
  calculateOptimalHandles: (source: Node, target: Node) => { sourceHandle: string; targetHandle: string },
): Edge {
  const handles = calculateOptimalHandles(sourceNode, targetNode);
  const cleanSrc = handles.sourceHandle.replace('-source', '').replace('-target', '');
  const cleanTgt = handles.targetHandle.replace('-target', '').replace('-source', '');

  return {
    id: `edge-reaction-${Date.now()}`,
    source: sourceNode.id,
    target: targetNode.id,
    type: 'reactions',
    sourceHandle: cleanSrc,
    targetHandle: cleanTgt,
    data: {
      code: '',
      backendRelationId: null,
      reactionFileId: null,
      sourceMetaModelId: sourceNode.data?.metaModelId ?? sourceNode.data?.metaModelSourceId,
      targetMetaModelId: targetNode.data?.metaModelId ?? targetNode.data?.metaModelSourceId,
      sourceMetaModelSourceId: sourceNode.data?.metaModelSourceId ?? sourceNode.data?.metaModelId,
      targetMetaModelSourceId: targetNode.data?.metaModelSourceId ?? targetNode.data?.metaModelId,
    },
    style: { stroke: color, strokeWidth: 2 },
  };
}
