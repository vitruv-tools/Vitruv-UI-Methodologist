import { Edge, Node } from 'reactflow';
import { NODE_DIMENSIONS } from './flowCanvasConstants';

export interface UmlMergeData {
  mergePointsMap: Map<string, { x: number; y: number; mergeGroupId: string }>;
  firstInGroupMap: Map<string, string>;
  mergeGroupSourceNodesMap: Map<string, string[]>;
}

function hasRelationshipType(data: unknown): data is { relationshipType?: string } {
  return typeof data === 'object' && data !== null && 'relationshipType' in data;
}

/** Centre of mass of the source boxes feeding a merge group. */
export function calculateAverageSourcePosition(
  eligibleEdges: Edge[],
  nodes: Node[],
): { x: number; y: number } {
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  eligibleEdges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (sourceNode) {
      sumX += sourceNode.position.x + NODE_DIMENSIONS.width / 2;
      sumY += sourceNode.position.y + NODE_DIMENSIONS.height / 2;
      count++;
    }
  });

  return count > 0 ? { x: sumX / count, y: sumY / count } : { x: 0, y: 0 };
}

/**
 * Places the merge point directly above/below the superclass centre so the last
 * segment enters the box straight on rather than clipping a corner.
 */
export function calculateMergePoint(
  avgSource: { x: number; y: number },
  targetNode: Node,
): { x: number; y: number } {
  const targetCenterX = targetNode.position.x + NODE_DIMENSIONS.width / 2;
  const targetCenterY = targetNode.position.y + NODE_DIMENSIONS.height / 2;

  return {
    x: targetCenterX,
    y: avgSource.y + (targetCenterY - avgSource.y) * 0.4,
  };
}

/**
 * Computes fan-in merge points for UML inheritance edges sharing a superclass.
 *
 * Merging is deliberately limited to inheritance — several subclasses pointing
 * at one superclass read well as a fan, whereas merging compositions and
 * associations would obscure which class each line belongs to. A subclass that
 * reaches the same superclass more than once is skipped, since its edges would
 * collapse onto each other.
 */
export function computeUmlMergeData(edges: Edge[], nodes: Node[]): UmlMergeData {
  const mergePointsMap: UmlMergeData['mergePointsMap'] = new Map();
  const firstInGroupMap: UmlMergeData['firstInGroupMap'] = new Map();
  const mergeGroupSourceNodesMap: UmlMergeData['mergeGroupSourceNodesMap'] = new Map();

  const umlInheritanceEdges = edges.filter(
    e => e.type === 'uml' && hasRelationshipType(e.data) && e.data.relationshipType === 'inheritance',
  );

  if (umlInheritanceEdges.length === 0) {
    return { mergePointsMap, firstInGroupMap, mergeGroupSourceNodesMap };
  }

  const edgesPerSource = new Map<string, number>();
  umlInheritanceEdges.forEach(edge => {
    edgesPerSource.set(edge.source, (edgesPerSource.get(edge.source) || 0) + 1);
  });

  const edgesByTarget = new Map<string, Edge[]>();
  umlInheritanceEdges.forEach(edge => {
    const existing = edgesByTarget.get(edge.target) || [];
    existing.push(edge);
    edgesByTarget.set(edge.target, existing);
  });

  edgesByTarget.forEach((edgesGroup, targetId) => {
    if (edgesGroup.length < 2) return;

    const eligibleEdges = edgesGroup.filter(edge => (edgesPerSource.get(edge.source) || 0) === 1);
    if (eligibleEdges.length < 2) return;

    eligibleEdges.sort((a, b) => a.source.localeCompare(b.source));

    const targetNode = nodes.find(n => n.id === targetId);
    if (!targetNode) return;

    const avgSourcePos = calculateAverageSourcePosition(eligibleEdges, nodes);
    const mergePoint = calculateMergePoint(avgSourcePos, targetNode);
    const mergeGroupId = `merge-${targetId}`;

    mergeGroupSourceNodesMap.set(mergeGroupId, eligibleEdges.map(e => e.source));
    eligibleEdges.forEach(edge => {
      mergePointsMap.set(edge.id, { ...mergePoint, mergeGroupId });
    });

    firstInGroupMap.set(mergeGroupId, eligibleEdges[0].id);
  });

  return { mergePointsMap, firstInGroupMap, mergeGroupSourceNodesMap };
}
