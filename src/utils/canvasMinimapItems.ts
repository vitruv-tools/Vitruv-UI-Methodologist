import type { Edge, Node } from 'reactflow';
import { computeBoundingBoxRect } from './expandMetaModel';
import { metaModelDisplayColor } from './metaModelColors';
import { ECORE_FILE_BOX_SIZE } from '../components/flow/flowCanvasConstants';
import { nodeWorldRect, routeAllReactionEdges } from '../components/flow/flowCanvasAStarRouter';

export type CanvasMinimapItem = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  kind: 'ecoreFile' | 'boundingBox' | 'eobject';
};

function nodeHidden(node: Node): boolean {
  return node.hidden === true;
}

function numericSize(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function bboxSize(node: Node): { width: number; height: number } {
  const style = node.style ?? {};
  const width = numericSize(node.width)
    ?? numericSize(style.width)
    ?? numericSize(node.data?.width)
    ?? 350;
  const height = numericSize(node.height)
    ?? numericSize(style.height)
    ?? numericSize(node.data?.height)
    ?? 250;
  return { width, height };
}

function liveBoundingBoxRect(
  bbox: Node,
  children: Node[],
): { x: number; y: number; width: number; height: number } {
  const fitted = computeBoundingBoxRect(children);
  if (fitted) return fitted;
  const { width, height } = bboxSize(bbox);
  return { x: bbox.position.x, y: bbox.position.y, width, height };
}

function stripEcoreExt(name: string): string {
  return name.replace(/\.ecore$/i, '').toLowerCase();
}

/**
 * Items drawn on the main canvas minimap.
 * In Reactions mode bounding boxes + EObject nodes replace hidden ecoreFile cards.
 */
export function collectCanvasMinimapItems(nodes: Node[]): CanvasMinimapItem[] {
  const bboxes = nodes.filter(n => n.type === 'boundingBox' && !nodeHidden(n));
  if (bboxes.length > 0) {
    const eobjects = nodes.filter(n => n.type === 'eobject' && !nodeHidden(n));
    const items: CanvasMinimapItem[] = bboxes.map(node => {
      const children = eobjects.filter(n => n.data?.group === node.id);
      const rect = liveBoundingBoxRect(node, children);
      return {
        id: node.id,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: node.data?.color || metaModelDisplayColor(node.data?.domain, node.data?.label),
        kind: 'boundingBox',
      };
    });
    for (const node of nodes) {
      if (node.type !== 'eobject' || nodeHidden(node)) continue;
      const rect = nodeWorldRect(node);
      if (!rect) continue;
      items.push({
        id: node.id,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: node.data?.color
          || items.find(i => i.id === node.data?.group)?.color
          || metaModelDisplayColor(undefined, node.data?.label),
        kind: 'eobject',
      });
    }
    return items;
  }

  return nodes
    .filter(n => n.type === 'ecoreFile' && !nodeHidden(n))
    .map(node => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      width: ECORE_FILE_BOX_SIZE.width,
      height: ECORE_FILE_BOX_SIZE.height,
      color: metaModelDisplayColor(node.data?.domain, node.data?.fileName),
      kind: 'ecoreFile' as const,
    }));
}

/**
 * Map a React Flow node id (ecoreFile, boundingBox, or eobject) to the
 * minimap item that should represent it. Fine-granular edges attach to
 * EObject nodes; coarse reaction edges attach to ecoreFile nodes.
 */
export function buildMinimapEndpointIndex(
  nodes: Node[],
  items: CanvasMinimapItem[],
): Map<string, CanvasMinimapItem> {
  const byId = new Map(items.map(item => [item.id, item]));
  const index = new Map<string, CanvasMinimapItem>();

  for (const item of items) index.set(item.id, item);

  const bboxNodes = nodes.filter(n => n.type === 'boundingBox');

  for (const node of nodes) {
    if (node.type === 'ecoreFile') {
      const ns = typeof node.data?.nsUri === 'string' ? node.data.nsUri : '';
      const label = stripEcoreExt(String(node.data?.fileName ?? ''));
      const owned = bboxNodes.find(b =>
        b.data?.ownerNodeId === node.id || b.id === `bbox-${node.id}`,
      );
      const legacy = bboxNodes.find(b =>
        !b.data?.ownerNodeId
        && (
          (ns !== '' && (b.id === `bbox-${ns}` || b.data?.nsUri === ns))
          || (label !== '' && stripEcoreExt(String(b.data?.label ?? '')) === label)
        ),
      );
      const match = owned ?? legacy;
      const item = match ? byId.get(match.id) : undefined;
      if (item) index.set(node.id, item);
    }
  }

  return index;
}

export type MinimapEdgePath = {
  id: string;
  points: Array<{ x: number; y: number }>;
};

function edgeEndpointsVisible(nodes: Node[], edge: Edge): boolean {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const source = byId.get(edge.source);
  const target = byId.get(edge.target);
  return Boolean(source && target && !nodeHidden(source) && !nodeHidden(target));
}

function stampedWaypoints(edge: Edge): Array<{ x: number; y: number }> | null {
  const points = edge.data?.routeWaypoints;
  return Array.isArray(points) && points.length > 1 ? points : null;
}

/**
 * Draw the exact canvas polylines. When FlowCanvas already computed routes,
 * those points are used verbatim — the minimap must not run a second A*.
 */
export function minimapEdgeSegments(
  nodes: Node[],
  edges: Edge[],
  items: CanvasMinimapItem[],
  endpointIndex: Map<string, CanvasMinimapItem>,
  canvasRoutes?: Map<string, { points: Array<{ x: number; y: number }> }>,
): MinimapEdgePath[] {
  const paths: MinimapEdgePath[] = [];
  const routed = new Set<string>();
  const visible = edges.filter(edge => edgeEndpointsVisible(nodes, edge));

  for (const edge of visible) {
    const stamped = stampedWaypoints(edge);
    if (!stamped) continue;
    paths.push({ id: edge.id, points: stamped });
    routed.add(edge.id);
  }

  const routes = canvasRoutes ?? routeAllReactionEdges(nodes, visible);
  for (const edge of visible) {
    if (routed.has(edge.id)) continue;
    const route = routes.get(edge.id);
    if (!route || route.points.length < 2) continue;
    paths.push({ id: edge.id, points: route.points });
    routed.add(edge.id);
  }

  for (const edge of visible) {
    if (routed.has(edge.id)) continue;
    if (edge.type === 'reactions' || edge.type === 'fine-granular-reaction') continue;
    const src = endpointIndex.get(edge.source) ?? items.find(i => i.id === edge.source);
    const tgt = endpointIndex.get(edge.target) ?? items.find(i => i.id === edge.target);
    if (!src || !tgt || src.id === tgt.id) continue;
    paths.push({
      id: edge.id,
      points: [
        { x: src.x + src.width / 2, y: src.y + src.height / 2 },
        { x: tgt.x + tgt.width / 2, y: tgt.y + tgt.height / 2 },
      ],
    });
  }
  return paths;
}
