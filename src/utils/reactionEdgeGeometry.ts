import type { Edge } from 'reactflow';
import { getProperEObjectIdFromHandle } from './EcoreIdentifiers';
import type { Point } from './umlDiagramGeometry';

/** Matches `EObjectNode` header / attribute row sizes. */
export const EOBJECT_HEADER_HEIGHT = 32;
export const EOBJECT_ATTR_ROW_HEIGHT = 24;
export const EOBJECT_DEFAULT_WIDTH = 200;

export const FINE_REACTION_SEPARATION = 16;
export const FINE_REACTION_ENDPOINT_INSET = 8;
export const FINE_REACTION_ARROW_LENGTH = 10;

export type ReactionHandleKind = 'class' | 'attribute';

export interface ParsedReactionHandle {
  kind: ReactionHandleKind;
  eObjectId: string;
  attributeName?: string;
}

export interface ReactionNodeBounds {
  x: number;
  y: number;
  width: number;
  attributes?: Array<{ name: string }>;
}

export interface AxisRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FineReactionChord {
  p1: Point;
  p2: Point;
  drawP1: Point;
  drawP2: Point;
  arrowAngle: number;
}

/**
 * Border-ray intersection used by the UML editor: the point on the box
 * boundary where the line from the box center toward another point exits.
 */
export function getBorderPoint(
  cx: number,
  cy: number,
  nodeW: number,
  nodeH: number,
  towardX: number,
  towardY: number,
): Point {
  const hw = nodeW / 2;
  const hh = nodeH / 2;
  const dx = towardX - cx;
  const dy = towardY - cy;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx + hw, y: cy };
  const scaleX = Math.abs(dx) > 0.001 ? hw / Math.abs(dx) : Infinity;
  const scaleY = Math.abs(dy) > 0.001 ? hh / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

export function parseReactionHandle(handleId?: string | null): ParsedReactionHandle | null {
  if (!handleId) return null;
  const fq = getProperEObjectIdFromHandle(handleId);
  if (!fq) return null;
  const hashIdx = fq.indexOf('#');
  const afterHash = hashIdx >= 0 ? fq.substring(hashIdx + 1) : fq;
  const dotIdx = afterHash.lastIndexOf('.');
  if (dotIdx < 0) return { kind: 'class', eObjectId: fq };
  const classPart = afterHash.substring(0, dotIdx);
  const attributeName = afterHash.substring(dotIdx + 1);
  const eObjectId = hashIdx >= 0 ? `${fq.substring(0, hashIdx + 1)}${classPart}` : classPart;
  return { kind: 'attribute', eObjectId, attributeName };
}

export function reactionRowRect(
  node: ReactionNodeBounds,
  handleId?: string | null,
): AxisRect {
  const width = node.width > 0 ? node.width : EOBJECT_DEFAULT_WIDTH;
  const parsed = parseReactionHandle(handleId);
  if (parsed?.kind === 'attribute' && parsed.attributeName) {
    const idx = node.attributes?.findIndex(a => a.name === parsed.attributeName) ?? -1;
    if (idx >= 0) {
      return {
        x: node.x,
        y: node.y + EOBJECT_HEADER_HEIGHT + idx * EOBJECT_ATTR_ROW_HEIGHT,
        width,
        height: EOBJECT_ATTR_ROW_HEIGHT,
      };
    }
  }
  return {
    x: node.x,
    y: node.y,
    width,
    height: EOBJECT_HEADER_HEIGHT,
  };
}

export function isAttributeHandle(handleId?: string | null): boolean {
  return parseReactionHandle(handleId)?.kind === 'attribute';
}

/** Center of the left (target) or right (source) reaction handle on a row. */
export function reactionHandleAnchor(
  node: ReactionNodeBounds,
  handleId: string | null | undefined,
  role: 'source' | 'target',
): Point {
  const row = reactionRowRect(node, handleId);
  return {
    x: role === 'source' ? row.x + row.width : row.x,
    y: row.y + row.height / 2,
  };
}

export function applyPerpendicularOffset(
  p1: Point,
  p2: Point,
  parallelIndex: number,
  parallelCount: number,
  separation = FINE_REACTION_SEPARATION,
): { p1: Point; p2: Point } {
  if (parallelCount <= 1) return { p1, p2 };
  const len = Math.max(Math.hypot(p2.x - p1.x, p2.y - p1.y), 0.0001);
  const nx = -(p2.y - p1.y) / len;
  const ny = (p2.x - p1.x) / len;
  const off = (parallelIndex - (parallelCount - 1) / 2) * separation;
  return {
    p1: { x: p1.x + nx * off, y: p1.y + ny * off },
    p2: { x: p2.x + nx * off, y: p2.y + ny * off },
  };
}

export function insetLineEndpoints(
  p1: Point,
  p2: Point,
  inset = FINE_REACTION_ENDPOINT_INSET,
): { p1: Point; p2: Point } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.max(Math.hypot(dx, dy), 0.0001);
  const amount = Math.min(inset, Math.max(0, len / 2 - 8));
  const ux = dx / len;
  const uy = dy / len;
  return {
    p1: { x: p1.x + ux * amount, y: p1.y + uy * amount },
    p2: { x: p2.x - ux * amount, y: p2.y - uy * amount },
  };
}

export function layoutFineReactionChord(options: {
  source: ReactionNodeBounds;
  target: ReactionNodeBounds;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  parallelIndex?: number;
  parallelCount?: number;
  separation?: number;
}): FineReactionChord {
  const srcRow = reactionRowRect(options.source, options.sourceHandle);
  const tgtRow = reactionRowRect(options.target, options.targetHandle);
  const srcCx = srcRow.x + srcRow.width / 2;
  const srcCy = srcRow.y + srcRow.height / 2;
  const tgtCx = tgtRow.x + tgtRow.width / 2;
  const tgtCy = tgtRow.y + tgtRow.height / 2;
  const srcAttr = isAttributeHandle(options.sourceHandle);
  const tgtAttr = isAttributeHandle(options.targetHandle);

  let p1 = srcAttr
    ? reactionHandleAnchor(options.source, options.sourceHandle, 'source')
    : getBorderPoint(srcCx, srcCy, srcRow.width, srcRow.height, tgtCx, tgtCy);
  let p2 = tgtAttr
    ? reactionHandleAnchor(options.target, options.targetHandle, 'target')
    : getBorderPoint(tgtCx, tgtCy, tgtRow.width, tgtRow.height, srcCx, srcCy);

  if (!srcAttr || !tgtAttr) {
    const offset = applyPerpendicularOffset(
      p1,
      p2,
      options.parallelIndex ?? 0,
      options.parallelCount ?? 1,
      options.separation ?? FINE_REACTION_SEPARATION,
    );
    if (!srcAttr) p1 = offset.p1;
    if (!tgtAttr) p2 = offset.p2;
  }

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.max(Math.hypot(dx, dy), 0.0001);
  const ux = dx / len;
  const uy = dy / len;
  const arrowLen = Math.min(FINE_REACTION_ARROW_LENGTH, Math.max(0, len / 2));

  return {
    p1,
    p2,
    drawP1: p1,
    drawP2: { x: p2.x - ux * arrowLen, y: p2.y - uy * arrowLen },
    arrowAngle: Math.atan2(dy, dx) * (180 / Math.PI),
  };
}

export function fineReactionPairKey(edge: Pick<Edge, 'source' | 'target' | 'sourceHandle' | 'targetHandle'>): string {
  return `${edge.source}|${edge.sourceHandle ?? ''}|${edge.target}|${edge.targetHandle ?? ''}`;
}

export function indexFineReactionParallels(
  edges: Edge[],
): Map<string, { index: number; total: number }> {
  const fine = edges.filter(e => e.type === 'fine-granular-reaction');
  const groups = new Map<string, Edge[]>();
  for (const edge of fine) {
    const key = fineReactionPairKey(edge);
    const list = groups.get(key) ?? [];
    list.push(edge);
    groups.set(key, list);
  }
  const result = new Map<string, { index: number; total: number }>();
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
    sorted.forEach((edge, index) => {
      result.set(edge.id, { index, total: sorted.length });
    });
  }
  return result;
}

export function fineReactionPathD(chord: FineReactionChord): string {
  return `M ${chord.drawP1.x} ${chord.drawP1.y} L ${chord.drawP2.x} ${chord.drawP2.y}`;
}
