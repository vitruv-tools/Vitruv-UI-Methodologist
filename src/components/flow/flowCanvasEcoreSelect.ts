import { Edge, Node } from 'reactflow';
import { CanvasMode } from './flowCanvasTypes';
import { buildReactionEdge } from './flowCanvasEdgeFactory';

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

/** Edge created by picking a source and then a target in add-reaction mode. */
export function buildReactionEdgeFromNodes(
  sourceNode: Node,
  targetNode: Node,
  color: string,
): Edge {
  return buildReactionEdge({
    id: `edge-reaction-${Date.now()}`,
    sourceNode,
    targetNode,
    color,
    data: {
      code: '',
      backendRelationId: null,
      reactionFileId: null,
    },
  });
}
