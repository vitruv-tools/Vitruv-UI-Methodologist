import { Edge, Node } from 'reactflow';
import { HandlePosition } from './flowCanvasTypes';
import { EdgeDistributionSlot } from './flowCanvasRenderUtils';

const HANDLE_POSITIONS: HandlePosition[] = ['top', 'bottom', 'left', 'right'];

export type NodeEdgeDistribution = Map<HandlePosition, EdgeDistributionSlot[]>;
export type EdgeDistributionMap = Map<string, NodeEdgeDistribution>;

/** Groups the reaction edges touching a node by the handle they attach to. */
export function collectNodeSideEdges(node: Node, allEdges: Edge[]): Map<HandlePosition, string[]> {
  const sideMap = new Map<HandlePosition, string[]>();
  HANDLE_POSITIONS.forEach(pos => sideMap.set(pos, []));

  allEdges.forEach(edge => {
    if (edge.type !== 'reactions') return;

    if (edge.source === node.id && edge.sourceHandle) {
      const handle = edge.sourceHandle as HandlePosition;
      if (!sideMap.get(handle)?.includes(edge.id)) {
        sideMap.get(handle)?.push(edge.id);
      }
    }

    if (edge.target === node.id && edge.targetHandle) {
      const handle = edge.targetHandle as HandlePosition;
      if (!sideMap.get(handle)?.includes(edge.id)) {
        sideMap.get(handle)?.push(edge.id);
      }
    }
  });

  return sideMap;
}

/**
 * Orders edges on a handle by the id of the node at their far end, so the fan
 * of parallel edges keeps a stable order across renders.
 */
export function createEdgeSortComparator(nodeId: string, allEdges: Edge[]) {
  return (a: string, b: string): number => {
    const edgeA = allEdges.find(e => e.id === a);
    const edgeB = allEdges.find(e => e.id === b);
    if (!edgeA || !edgeB) return 0;

    const otherNodeA = edgeA.source === nodeId ? edgeA.target : edgeA.source;
    const otherNodeB = edgeB.source === nodeId ? edgeB.target : edgeB.source;

    return otherNodeA.localeCompare(otherNodeB);
  };
}

/** Assigns each edge on a handle its slot (index of total) for fan-out spacing. */
export function buildNodeDistribution(
  nodeId: string,
  sideMap: Map<HandlePosition, string[]>,
  allEdges: Edge[],
): NodeEdgeDistribution {
  const nodeDistribution: NodeEdgeDistribution = new Map();
  const comparator = createEdgeSortComparator(nodeId, allEdges);

  sideMap.forEach((edgeIds, position) => {
    const sortedEdgeIds = [...edgeIds].sort(comparator);
    const total = sortedEdgeIds.length;
    nodeDistribution.set(
      position,
      sortedEdgeIds.map((edgeId, index) => ({ edgeId, index, total })),
    );
  });

  return nodeDistribution;
}

/**
 * Builds the per-node, per-handle slot metadata that ReactionRelationship uses
 * to spread parallel edges along a box side. Only ecoreFile nodes participate.
 */
export function buildEdgeDistributionMap(nodes: Node[], edges: Edge[]): EdgeDistributionMap {
  const map: EdgeDistributionMap = new Map();

  nodes.forEach(node => {
    if (node.type !== 'ecoreFile') return;
    const sideMap = collectNodeSideEdges(node, edges);
    map.set(node.id, buildNodeDistribution(node.id, sideMap, edges));
  });

  return map;
}
