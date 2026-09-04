import type { Edge } from 'reactflow';
import { getProperEObjectIdFromHandle } from './EcoreIdentifiers';
import type { Point } from './umlDiagramGeometry';

/** Matches `EObjectNode` header / attribute row sizes. */
export const EOBJECT_HEADER_HEIGHT = 32;
export const EOBJECT_ATTR_ROW_HEIGHT = 24;
export const EOBJECT_DEFAULT_WIDTH = 200;
export const GHOST_NODE_SIZE = 12;

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
  height?: number;
  attributes?: Array<{ name: string }>;
  isGhost?: boolean;
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

function ghostBoxSize(node: ReactionNodeBounds): { w: number; h: number } {
  return {
    w: node.width > 0 ? node.width : GHOST_NODE_SIZE,
    h: node.height && node.height > 0 ? node.height : GHOST_NODE_SIZE,
  };
}

export function isGhostReactionNode(node: ReactionNodeBounds): boolean {
  if (node.isGhost) return true;
  const { w, h } = ghostBoxSize(node);
  return w <= GHOST_NODE_SIZE + 6 && h <= GHOST_NODE_SIZE + 6;
}

export function ghostCenter(node: ReactionNodeBounds): Point {
  const { w, h } = ghostBoxSize(node);
  return { x: node.x + w / 2, y: node.y + h / 2 };
}

/** Intersection of the line from the ghost center toward `toward` with the ghost circle. */
export function ghostRimPoint(node: ReactionNodeBounds, toward: Point): Point {
  const c = ghostCenter(node);
  const { w, h } = ghostBoxSize(node);
  const radius = Math.min(w, h) / 2;
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return { x: c.x + radius, y: c.y };
  return { x: c.x + (dx / len) * radius, y: c.y + (dy / len) * radius };
}

function rowCenter(row: AxisRect): Point {
  return { x: row.x + row.width / 2, y: row.y + row.height / 2 };
}

function chordAim(node: ReactionNodeBounds, row: AxisRect, isGhost: boolean): Point {
  if (isGhost) return ghostCenter(node);
  return rowCenter(row);
}

function chordEndpoint(
  node: ReactionNodeBounds,
  handle: string | null | undefined,
  role: 'source' | 'target',
  row: AxisRect,
  toward: Point,
  isGhost: boolean,
  isAttr: boolean,
): Point {
  if (isGhost) return ghostCenter(node);
  if (isAttr) return reactionHandleAnchor(node, handle, role);
  const center = rowCenter(row);
  return getBorderPoint(center.x, center.y, row.width, row.height, toward.x, toward.y);
}

function offsetClassChordEnds(
  p1: Point,
  p2: Point,
  srcAttr: boolean,
  tgtAttr: boolean,
  srcGhost: boolean,
  tgtGhost: boolean,
  options: {
    parallelIndex?: number;
    parallelCount?: number;
    separation?: number;
  },
): { p1: Point; p2: Point } {
  if (srcAttr && tgtAttr) return { p1, p2 };
  const offset = applyPerpendicularOffset(
    p1,
    p2,
    options.parallelIndex ?? 0,
    options.parallelCount ?? 1,
    options.separation ?? FINE_REACTION_SEPARATION,
  );
  if (!srcAttr && !srcGhost) p1 = offset.p1;
  if (!tgtAttr && !tgtGhost) p2 = offset.p2;
  return { p1, p2 };
}

function snapGhostChordEnds(
  source: ReactionNodeBounds,
  target: ReactionNodeBounds,
  p1: Point,
  p2: Point,
  srcGhost: boolean,
  tgtGhost: boolean,
): { p1: Point; p2: Point } {
  if (srcGhost) p1 = ghostRimPoint(source, p2);
  if (tgtGhost) p2 = ghostRimPoint(target, p1);
  return { p1, p2 };
}

function finishFineReactionChord(p1: Point, p2: Point): FineReactionChord {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.max(Math.hypot(dx, dy), 0.0001);
  const arrowLen = Math.min(FINE_REACTION_ARROW_LENGTH, Math.max(0, len / 2));
  return {
    p1,
    p2,
    drawP1: p1,
    drawP2: { x: p2.x - (dx / len) * arrowLen, y: p2.y - (dy / len) * arrowLen },
    arrowAngle: Math.atan2(dy, dx) * (180 / Math.PI),
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
  const srcGhost = isGhostReactionNode(options.source);
  const tgtGhost = isGhostReactionNode(options.target);
  const srcRow = reactionRowRect(options.source, options.sourceHandle);
  const tgtRow = reactionRowRect(options.target, options.targetHandle);
  const srcAttr = !srcGhost && isAttributeHandle(options.sourceHandle);
  const tgtAttr = !tgtGhost && isAttributeHandle(options.targetHandle);
  const srcAim = chordAim(options.source, srcRow, srcGhost);
  const tgtAim = chordAim(options.target, tgtRow, tgtGhost);

  const ends = offsetClassChordEnds(
    chordEndpoint(
      options.source, options.sourceHandle, 'source', srcRow, tgtAim, srcGhost, srcAttr,
    ),
    chordEndpoint(
      options.target, options.targetHandle, 'target', tgtRow, srcAim, tgtGhost, tgtAttr,
    ),
    srcAttr,
    tgtAttr,
    srcGhost,
    tgtGhost,
    options,
  );
  const snapped = snapGhostChordEnds(
    options.source, options.target, ends.p1, ends.p2, srcGhost, tgtGhost,
  );
  return finishFineReactionChord(snapped.p1, snapped.p2);
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
