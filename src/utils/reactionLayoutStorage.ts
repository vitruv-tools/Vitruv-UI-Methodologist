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

export type ReactionLayoutProjectId = number | string | null | undefined;

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

export function reactionLayoutStorageKey(projectId: ReactionLayoutProjectId): string {
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

function fallbackSize(nodeValue: unknown, styleValue: unknown, dataValue: unknown): unknown {
  if (typeof nodeValue === 'number' && nodeValue > 0) return nodeValue;
  if (typeof styleValue === 'number') return styleValue;
  return dataValue;
}

function finiteSize(value: unknown): number | undefined {
  if (isFiniteCoord(value)) return value;
  return undefined;
}

function nodeBoxSize(node: Node): { width?: number; height?: number } {
  const style = (node.style ?? {}) as { width?: number; height?: number };
  return {
    width: finiteSize(fallbackSize(node.width, style.width, node.data?.width)),
    height: finiteSize(fallbackSize(node.height, style.height, node.data?.height)),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function isSafeLayoutKey(key: string): boolean {
  return Boolean(key) && key.length <= 512;
}

function coordFromUnknown(value: unknown): ReactionCoord | null {
  if (!value || typeof value !== 'object') return null;
  const pos = value as { x?: unknown; y?: unknown };
  if (!isFiniteCoord(pos.x) || !isFiniteCoord(pos.y)) return null;
  return { x: pos.x, y: pos.y };
}

function sanitizeBbox(rawBbox: unknown): ReactionBboxLayout | null {
  const coord = coordFromUnknown(rawBbox);
  if (!coord) return null;
  const box = rawBbox as { width?: unknown; height?: unknown };
  const bbox: ReactionBboxLayout = { ...coord };
  if (isFiniteCoord(box.width)) bbox.width = box.width;
  if (isFiniteCoord(box.height)) bbox.height = box.height;
  return bbox;
}

function sanitizeClasses(raw: unknown): Record<string, ReactionCoord> {
  const record = asRecord(raw);
  if (!record) return {};
  const classes: Record<string, ReactionCoord> = {};
  for (const [classId, pos] of Object.entries(record)) {
    if (!isSafeLayoutKey(classId)) continue;
    const coord = coordFromUnknown(pos);
    if (!coord) continue;
    classes[classId] = coord;
  }
  return classes;
}

function sanitizeModelLayout(value: unknown): ReactionModelLayout | null {
  const entry = asRecord(value);
  if (!entry) return null;
  const bbox = sanitizeBbox(entry.bbox);
  if (!bbox) return null;
  return { bbox, classes: sanitizeClasses(entry.classes) };
}

export function sanitizeReactionLayoutMap(raw: unknown): ReactionLayoutMap {
  const record = asRecord(raw);
  if (!record) return {};
  const clean: ReactionLayoutMap = {};
  for (const [nsUri, value] of Object.entries(record)) {
    if (!isSafeLayoutKey(nsUri)) continue;
    const layout = sanitizeModelLayout(value);
    if (!layout) continue;
    clean[nsUri] = layout;
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
      ...target.boundingBox.style,
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
  projectId: ReactionLayoutProjectId,
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
  projectId: ReactionLayoutProjectId,
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
  projectId: ReactionLayoutProjectId,
  nodes: Node[],
): void {
  saveReactionLayout(projectId, captureReactionLayout(nodes));
}
