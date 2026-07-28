import { Node } from 'reactflow';
import { ECORE_FILE_BOX_SIZE, NODE_DIMENSIONS } from './flowCanvasConstants';

/**
 * The id the *canvas* keys metamodels by. Falls back to the backend id when a
 * node predates the source/backend id split.
 */
export function getMetaModelSourceId(nodes: Node[], nodeId?: string | null): number | undefined {
  if (!nodeId) return undefined;
  const node = nodes.find(n => n.id === nodeId);
  const value = node?.data?.metaModelSourceId ?? node?.data?.metaModelId;
  return typeof value === 'number' ? value : undefined;
}

/** The id the *backend* keys metamodels by — the same fallback in reverse. */
export function getBackendMetaModelId(nodes: Node[], nodeId?: string | null): number | undefined {
  if (!nodeId) return undefined;
  const node = nodes.find(n => n.id === nodeId);
  const value = node?.data?.metaModelId ?? node?.data?.metaModelSourceId;
  return typeof value === 'number' ? value : undefined;
}

/** Finds the ecoreFile node carrying either flavour of the given metamodel id. */
export function findNodeByMetaModelId(nodes: Node[], metaModelId: number): Node | undefined {
  return nodes.find(
    n => n.type === 'ecoreFile'
      && (n.data?.metaModelId === metaModelId || n.data?.metaModelSourceId === metaModelId),
  );
}

/** Whether a flow-space point falls within a node's footprint. */
export function isPositionInsideNode(position: { x: number; y: number }, node: Node): boolean {
  const { width, height } = node.type === 'ecoreFile' ? ECORE_FILE_BOX_SIZE : NODE_DIMENSIONS;
  return (
    position.x >= node.position.x
    && position.x <= node.position.x + width
    && position.y >= node.position.y
    && position.y <= node.position.y + height
  );
}

/** Snap radius, in flow units, for dropping a connection near (not on) a box. */
export const ECORE_DROP_SNAP_DISTANCE = 80;

/**
 * Resolves which ecoreFile box a dropped connection belongs to: a direct hit
 * wins, otherwise the nearest box within {@link ECORE_DROP_SNAP_DISTANCE}.
 */
export function findEcoreTargetAtPosition(
  nodes: Node[],
  flowPosition: { x: number; y: number },
  sourceNodeId: string,
): Node | null {
  const candidates = nodes.filter(n => n.type === 'ecoreFile' && n.id !== sourceNodeId);

  const hit = candidates.find(n => isPositionInsideNode(flowPosition, n));
  if (hit) return hit;

  let closest: Node | null = null;
  let minDist = Infinity;
  for (const n of candidates) {
    const cx = n.position.x + ECORE_FILE_BOX_SIZE.width / 2;
    const cy = n.position.y + ECORE_FILE_BOX_SIZE.height / 2;
    const dist = Math.hypot(flowPosition.x - cx, flowPosition.y - cy);
    if (dist < minDist && dist <= ECORE_DROP_SNAP_DISTANCE) {
      minDist = dist;
      closest = n;
    }
  }
  return closest;
}
