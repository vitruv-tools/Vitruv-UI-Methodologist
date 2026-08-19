import type { Edge, Node } from 'reactflow';
import { ghostPositionChanges } from './FineGranularReactionUtils';

export const REACTION_LAYOUT_KEY_PREFIX = 'vitruv.reactions.layout.v1';

export interface ReactionCoord {
  x: number;
  y: number;
}

export interface ReactionBboxLayout extends ReactionCoord {
  width?: number;
  height?: number;
}

export interface ReactionModelLayout {
  bbox: ReactionBboxLayout;
  classes: Record<string, ReactionCoord>;
}

/** nsURI → saved bounding box + class positions */
export type ReactionLayoutMap = Record<string, ReactionModelLayout>;

export interface ReactionExpandLayoutTarget {
  boundingBox: Node;
  eObjectNodes: Node[];
  ghostNodes?: Node[];
  umlEdges?: Edge[];
  modelNsUri: string;
}

const SAFE_STORAGE_SEGMENT = /^[a-zA-Z0-9_.-]{1,200}$/;

function sanitizeStorageSegment(value: string, fallback: string): string {
  const trimmed = value.trim().slice(0, 200);
  return SAFE_STORAGE_SEGMENT.test(trimmed) ? trimmed : fallback;
}

function isFiniteCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export function reactionLayoutStorageKey(projectId: number | string | null | undefined): string {
  const segment = sanitizeStorageSegment(String(projectId ?? 'default'), 'default');
  return `${REACTION_LAYOUT_KEY_PREFIX}.${segment}`;
}

function bboxNsUri(node: Node): string | null {
  if (node.type !== 'boundingBox') return null;
  if (typeof node.data?.nsUri === 'string' && node.data.nsUri) return node.data.nsUri;
  if (node.id.startsWith('bbox-')) return node.id.slice('bbox-'.length);
  return null;
}

function classEObjectId(node: Node): string | null {
  if (node.type !== 'eobject') return null;
  const id = node.data?.ecore?.eObjectId;
  return typeof id === 'string' && id ? id : null;
}

function nodeBoxSize(node: Node): { width?: number; height?: number } {
  const style = (node.style ?? {}) as { width?: number; height?: number };
  const width = typeof node.width === 'number' && node.width > 0
    ? node.width
    : (typeof style.width === 'number' ? style.width : node.data?.width);
  const height = typeof node.height === 'number' && node.height > 0
    ? node.height
    : (typeof style.height === 'number' ? style.height : node.data?.height);
  return {
    width: isFiniteCoord(width) ? width : undefined,
    height: isFiniteCoord(height) ? height : undefined,
  };
}

export function sanitizeReactionLayoutMap(raw: unknown): ReactionLayoutMap {
  if (!raw || typeof raw !== 'object') return {};
  const clean: ReactionLayoutMap = {};
  for (const [nsUri, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!nsUri || typeof nsUri !== 'string' || nsUri.length > 512) continue;
    if (!value || typeof value !== 'object') continue;
    const entry = value as Partial<ReactionModelLayout>;
    const rawBbox = entry.bbox;
    if (!rawBbox || !isFiniteCoord(rawBbox.x) || !isFiniteCoord(rawBbox.y)) continue;
    const bbox: ReactionBboxLayout = { x: rawBbox.x, y: rawBbox.y };
    if (isFiniteCoord(rawBbox.width)) bbox.width = rawBbox.width;
    if (isFiniteCoord(rawBbox.height)) bbox.height = rawBbox.height;
    const classes: Record<string, ReactionCoord> = {};
    if (entry.classes && typeof entry.classes === 'object') {
      for (const [classId, pos] of Object.entries(entry.classes)) {
        if (!classId || classId.length > 512) continue;
        if (!pos || !isFiniteCoord(pos.x) || !isFiniteCoord(pos.y)) continue;
        classes[classId] = { x: pos.x, y: pos.y };
      }
    }
    clean[nsUri] = { bbox, classes };
  }
  return clean;
}

export function captureReactionLayout(nodes: Node[]): ReactionLayoutMap {
  const map: ReactionLayoutMap = {};
  for (const node of nodes) {
    const nsUri = bboxNsUri(node);
    if (!nsUri) continue;
    const size = nodeBoxSize(node);
    map[nsUri] = {
      bbox: {
        x: node.position.x,
        y: node.position.y,
        ...size,
      },
      classes: {},
    };
  }
  for (const node of nodes) {
    const classId = classEObjectId(node);
    const group = typeof node.data?.group === 'string' ? node.data.group : '';
    const nsUri = group.startsWith('bbox-') ? group.slice('bbox-'.length) : null;
    if (!classId || !nsUri || !map[nsUri]) continue;
    map[nsUri].classes[classId] = { x: node.position.x, y: node.position.y };
  }
  return map;
}

function recomputeGhosts(target: ReactionExpandLayoutTarget): void {
  const ghosts = target.ghostNodes ?? [];
  const edges = target.umlEdges ?? [];
  if (ghosts.length === 0 || edges.length === 0) return;
  const combined = [...target.eObjectNodes, ...ghosts];
  for (const change of ghostPositionChanges(combined, edges)) {
    const ghost = ghosts.find(n => n.id === change.id);
    if (ghost) ghost.position = change.position;
  }
}

export function applyReactionLayout(
  target: ReactionExpandLayoutTarget,
  layout: ReactionModelLayout | undefined,
): boolean {
  if (!layout) return false;
  const origin = { ...target.boundingBox.position };
  target.boundingBox.position = { x: layout.bbox.x, y: layout.bbox.y };
  if (isFiniteCoord(layout.bbox.width) && isFiniteCoord(layout.bbox.height)) {
    target.boundingBox.style = {
      ...(target.boundingBox.style ?? {}),
      width: layout.bbox.width,
      height: layout.bbox.height,
    };
    target.boundingBox.data = {
      ...target.boundingBox.data,
      width: layout.bbox.width,
      height: layout.bbox.height,
    };
  }
  for (const node of target.eObjectNodes) {
    const classId = classEObjectId(node);
    const saved = classId ? layout.classes[classId] : undefined;
    if (saved) {
      node.position = { x: saved.x, y: saved.y };
    } else {
      node.position = {
        x: node.position.x - origin.x + layout.bbox.x,
        y: node.position.y - origin.y + layout.bbox.y,
      };
    }
  }
  recomputeGhosts(target);
  return true;
}

export function loadReactionLayout(
  projectId: number | string | null | undefined,
): ReactionLayoutMap {
  try {
    const raw = localStorage.getItem(reactionLayoutStorageKey(projectId));
    if (!raw) return {};
    return sanitizeReactionLayoutMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveReactionLayout(
  projectId: number | string | null | undefined,
  layout: ReactionLayoutMap,
): void {
  const sanitized = sanitizeReactionLayoutMap(layout);
  if (Object.keys(sanitized).length === 0) return;
  try {
    localStorage.setItem(reactionLayoutStorageKey(projectId), JSON.stringify(sanitized));
  } catch {
    /* quota / private browsing */
  }
}

export function persistReactionLayoutFromNodes(
  projectId: number | string | null | undefined,
  nodes: Node[],
): void {
  saveReactionLayout(projectId, captureReactionLayout(nodes));
}
