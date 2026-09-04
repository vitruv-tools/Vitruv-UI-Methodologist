import type { Edge, Node } from 'reactflow';
import { computeBoundingBoxRect } from './expandMetaModel';
import { metaModelDisplayColor } from './metaModelColors';
import { ECORE_FILE_BOX_SIZE } from '../components/flow/flowCanvasConstants';

export type CanvasMinimapItem = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  kind: 'ecoreFile' | 'boundingBox' | 'eobject';
};

const EOBJECT_W = 200;
const EOBJECT_HEADER = 32;
const EOBJECT_ATTR_H = 24;

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

function eobjectHeight(node: Node): number {
  const attrs = Array.isArray(node.data?.attributes) ? node.data.attributes.length : 0;
  return EOBJECT_HEADER + attrs * EOBJECT_ATTR_H + 4;
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
      items.push({
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        width: EOBJECT_W,
        height: eobjectHeight(node),
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
      const match = bboxNodes.find(b =>
        (ns !== '' && (b.id === `bbox-${ns}` || b.data?.nsUri === ns))
        || (label !== '' && stripEcoreExt(String(b.data?.label ?? '')) === label),
      );
      const item = match ? byId.get(match.id) : undefined;
      if (item) index.set(node.id, item);
    }
  }

  return index;
}

export function minimapEdgeSegments(
  edges: Edge[],
  items: CanvasMinimapItem[],
  endpointIndex: Map<string, CanvasMinimapItem>,
): Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> {
  const segments: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = [];
  for (const edge of edges) {
    const src = endpointIndex.get(edge.source) ?? items.find(i => i.id === edge.source);
    const tgt = endpointIndex.get(edge.target) ?? items.find(i => i.id === edge.target);
    if (!src || !tgt || src.id === tgt.id) continue;
    segments.push({
      id: edge.id,
      x1: src.x + src.width / 2,
      y1: src.y + src.height / 2,
      x2: tgt.x + tgt.width / 2,
      y2: tgt.y + tgt.height / 2,
    });
  }
  return segments;
}
