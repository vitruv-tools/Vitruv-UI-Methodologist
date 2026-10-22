import { Edge, Node } from 'reactflow';
import { NODE_DIMENSIONS } from './flowCanvasConstants';
import { Point } from './flowCanvasAutoLayout';

/** Midpoint between the two boxes — the control point an edge uses by default. */
export function calculateDefaultControlPoint(edge: Edge, nodes: Node[]): Point {
  const src = nodes.find(n => n.id === edge.source);
  const tgt = nodes.find(n => n.id === edge.target);
  if (!src || !tgt) return { x: 0, y: 0 };

  return {
    x: (src.position.x + tgt.position.x + NODE_DIMENSIONS.width) / 2,
    y: (src.position.y + tgt.position.y + NODE_DIMENSIONS.height) / 2,
  };
}

/**
 * Orders edges along the axis the handle runs on — horizontally for top/bottom
 * handles, vertically for left/right — using the dragged edge's provisional
 * control point so it slots in where the user dropped it.
 */
export function createEdgeReorderComparator(
  targetEdgeId: string,
  controlPoint: Point,
  handle: string,
  nodes: Node[],
) {
  return (a: Edge, b: Edge): number => {
    const aPos = a.id === targetEdgeId ? controlPoint : (a.data?.customControlPoint || calculateDefaultControlPoint(a, nodes));
    const bPos = b.id === targetEdgeId ? controlPoint : (b.data?.customControlPoint || calculateDefaultControlPoint(b, nodes));
    return (handle === 'top' || handle === 'bottom') ? aPos.x - bPos.x : aPos.y - bPos.y;
  };
}

/** Writes the new slot index/count onto every edge that took part in a reorder. */
export function applyEdgeReorderData(
  prevEdges: Edge[],
  reorderedSourceEdges: Edge[],
  reorderedTargetEdges: Edge[],
): Edge[] {
  const sourceIndexById = new Map(reorderedSourceEdges.map((re, index) => [re.id, index] as const));
  const targetIndexById = new Map(reorderedTargetEdges.map((re, index) => [re.id, index] as const));

  return prevEdges.map(e => {
    const sourceIndex = sourceIndexById.get(e.id);
    const targetIndex = targetIndexById.get(e.id);
    const inSource = sourceIndex !== undefined;
    const inTarget = targetIndex !== undefined;

    if (!inSource && !inTarget) return e;

    return {
      ...e,
      data: {
        ...e.data,
        sourceParallelIndex: inSource ? sourceIndex : e.data?.sourceParallelIndex,
        sourceParallelCount: inSource ? reorderedSourceEdges.length : e.data?.sourceParallelCount,
        targetParallelIndex: inTarget ? targetIndex : e.data?.targetParallelIndex,
        targetParallelCount: inTarget ? reorderedTargetEdges.length : e.data?.targetParallelCount,
      },
    };
  });
}

/**
 * Recomputes the slot order of every reaction edge sharing a handle with the
 * dragged one. Returns `prevEdges` untouched when the edge is not a reaction
 * edge or either endpoint is missing.
 */
export function computeParallelEdgeReorder(
  prevEdges: Edge[],
  options: { edgeId: string; controlPoint: Point; nodes: Node[] },
): Edge[] {
  const { edgeId, controlPoint, nodes } = options;

  const edge = prevEdges.find(e => e.id === edgeId);
  if (edge?.type !== 'reactions') return prevEdges;

  const hasBothEndpoints = nodes.some(n => n.id === edge.source)
    && nodes.some(n => n.id === edge.target);
  if (!hasBothEndpoints) return prevEdges;

  const sameSourceEdges = prevEdges.filter(
    e => e.type === 'reactions' && e.source === edge.source && e.sourceHandle === edge.sourceHandle,
  );
  const sameTargetEdges = prevEdges.filter(
    e => e.type === 'reactions' && e.target === edge.target && e.targetHandle === edge.targetHandle,
  );

  const sourceComparator = createEdgeReorderComparator(edgeId, controlPoint, edge.sourceHandle!, nodes);
  const targetComparator = createEdgeReorderComparator(edgeId, controlPoint, edge.targetHandle!, nodes);

  const reorderedSourceEdges = sameSourceEdges.length > 1 ? [...sameSourceEdges].sort(sourceComparator) : sameSourceEdges;
  const reorderedTargetEdges = sameTargetEdges.length > 1 ? [...sameTargetEdges].sort(targetComparator) : sameTargetEdges;

  return applyEdgeReorderData(prevEdges, reorderedSourceEdges, reorderedTargetEdges);
}
