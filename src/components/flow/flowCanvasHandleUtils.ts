import { Edge, Node } from 'reactflow';

/**
 * UML handles keep their `-source` / `-target` suffix; reaction handles use the
 * bare side name. Both are derived from the same directional calculation.
 */
export interface OptimalHandles {
  sourceHandle: string;
  targetHandle: string;
}

/** Strips the `-source` / `-target` suffix so ReactFlow accepts the handle id. */
export function cleanHandleId(handle: string): string {
  return handle.replace('-source', '').replace('-target', '');
}

/**
 * Picks the pair of handles that face each other, based on which axis dominates
 * the offset between the two nodes.
 */
export function calculateOptimalHandles(sourceNode: Node, targetNode: Node): OptimalHandles {
  const dx = targetNode.position.x - sourceNode.position.x;
  const dy = targetNode.position.y - sourceNode.position.y;

  if (Math.abs(dy) > Math.abs(dx)) {
    return dy > 0
      ? { sourceHandle: 'bottom-source', targetHandle: 'top-target' }
      : { sourceHandle: 'top-source', targetHandle: 'bottom-target' };
  }

  return dx > 0
    ? { sourceHandle: 'right-source', targetHandle: 'left-target' }
    : { sourceHandle: 'left-source', targetHandle: 'right-target' };
}

/** Optimal handles for a reaction edge, with the suffixes already stripped. */
export function calculateReactionHandles(sourceNode: Node, targetNode: Node): OptimalHandles {
  const handles = calculateOptimalHandles(sourceNode, targetNode);
  return {
    sourceHandle: cleanHandleId(handles.sourceHandle),
    targetHandle: cleanHandleId(handles.targetHandle),
  };
}

/**
 * Re-points a single edge at the handles that now face each other. Returns the
 * edge untouched when it is not a reaction/UML edge, when either endpoint is
 * missing, or when the handles are already correct — so callers can map over
 * every edge and rely on reference equality to detect "nothing changed".
 */
export function updateEdgeHandles(edge: Edge, currentNodes: Node[]): Edge {
  if (edge.type !== 'reactions' && edge.type !== 'uml') return edge;

  const sourceNode = currentNodes.find(n => n.id === edge.source);
  const targetNode = currentNodes.find(n => n.id === edge.target);
  if (!sourceNode || !targetNode) return edge;

  const handles = calculateOptimalHandles(sourceNode, targetNode);
  const newSourceHandle = edge.type === 'uml' ? handles.sourceHandle : cleanHandleId(handles.sourceHandle);
  const newTargetHandle = edge.type === 'uml' ? handles.targetHandle : cleanHandleId(handles.targetHandle);

  if (edge.sourceHandle === newSourceHandle && edge.targetHandle === newTargetHandle) {
    return edge;
  }

  return {
    ...edge,
    sourceHandle: newSourceHandle,
    targetHandle: newTargetHandle,
    // Clear the custom control point — the path has to be recalculated.
    data: {
      ...edge.data,
      customControlPoint: undefined,
    },
  };
}

/**
 * Re-points every reaction edge after an auto-layout moved the boxes. Unlike
 * {@link updateEdgeHandles} this always rewrites the handles and clears the
 * control point, because every position changed.
 */
export function optimizeEdgeHandles(targetNodes: Node[], allEdges: Edge[]): Edge[] {
  return allEdges.map(edge => {
    if (edge.type !== 'reactions') return edge;

    const sourceNode = targetNodes.find(n => n.id === edge.source);
    const targetNode = targetNodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return edge;

    const handles = calculateReactionHandles(sourceNode, targetNode);

    return {
      ...edge,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      data: {
        ...edge.data,
        customControlPoint: undefined,
      },
    };
  });
}
