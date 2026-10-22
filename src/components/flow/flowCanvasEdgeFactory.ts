import { Edge, Node } from 'reactflow';
import { calculateReactionHandles } from './flowCanvasHandleUtils';

const REACTION_EDGE_STROKE_WIDTH = 2;

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export interface ReactionEdgeMetaModelIds {
  sourceMetaModelId?: number;
  targetMetaModelId?: number;
  sourceMetaModelSourceId?: number;
  targetMetaModelSourceId?: number;
}

/**
 * Both id flavours for an edge's endpoints. Nodes created before the
 * backend/source id split carry only one of the two, hence the fallbacks.
 */
export function metaModelIdsFromNodes(sourceNode: Node, targetNode: Node): ReactionEdgeMetaModelIds {
  return {
    sourceMetaModelId: asNumber(sourceNode.data?.metaModelId ?? sourceNode.data?.metaModelSourceId),
    targetMetaModelId: asNumber(targetNode.data?.metaModelId ?? targetNode.data?.metaModelSourceId),
    sourceMetaModelSourceId: asNumber(sourceNode.data?.metaModelSourceId ?? sourceNode.data?.metaModelId),
    targetMetaModelSourceId: asNumber(targetNode.data?.metaModelSourceId ?? targetNode.data?.metaModelId),
  };
}

export interface BuildReactionEdgeOptions {
  id: string;
  sourceNode: Node;
  targetNode: Node;
  color: string;
  /** Merged over the derived metamodel ids, so callers can add or override. */
  data?: Record<string, unknown>;
}

/**
 * Single construction point for reaction edges, whichever gesture created them
 * — drag-to-connect, add-reaction mode, a relation loaded from the backend, or
 * the `vitruv.createReactionEdge` event. Handles are derived from the current
 * box positions so the edge enters each box on its facing side.
 */
export function buildReactionEdge(options: BuildReactionEdgeOptions): Edge {
  const { id, sourceNode, targetNode, color, data } = options;
  const handles = calculateReactionHandles(sourceNode, targetNode);

  return {
    id,
    source: sourceNode.id,
    target: targetNode.id,
    type: 'reactions',
    sourceHandle: handles.sourceHandle,
    targetHandle: handles.targetHandle,
    data: {
      ...metaModelIdsFromNodes(sourceNode, targetNode),
      ...data,
    },
    style: { stroke: color, strokeWidth: REACTION_EDGE_STROKE_WIDTH },
  };
}
