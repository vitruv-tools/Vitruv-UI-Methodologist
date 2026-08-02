import { Node } from 'reactflow';

export const UML_LAYOUT_KEY_PREFIX = 'vitruv.uml.positions.v2';
export const UML_PACKAGE_LAYOUT_KEY = '__package__';
export const UML_VIEWPORT_KEY = '__viewport__';

export interface UmlViewport {
  x: number;
  y: number;
  scale: number;
}

/** Stable id segment for a UML class (matches ecoreToUml / layout map keys). */
export function sanitizeUmlClassId(className: string): string {
  return className.replace(/\W/g, '_');
}

export function umlClassNodeId(className: string): string {
  return `uml-class-${sanitizeUmlClassId(className)}`;
}

export function umlPackageNodeId(packageName: string): string {
  return `uml-pkg-${sanitizeUmlClassId(packageName)}`;
}

export function umlLayoutStorageKey(scopeId: string, fileName: string): string {
  const safeScope = sanitizeStorageSegment(scopeId || 'default', 'default');
  const safeFile = sanitizeStorageSegment(fileName, 'diagram');
  return `${UML_LAYOUT_KEY_PREFIX}.${safeScope}.${safeFile}`;
}

export type UmlClassPosition = { x: number; y: number };
export type UmlLayoutEntry = UmlClassPosition | UmlViewport;
export type UmlPositionMap = Record<string, UmlLayoutEntry>;

const SAFE_LAYOUT_KEY = /^[a-zA-Z0-9_.-]{1,128}$/;
const SAFE_STORAGE_SEGMENT = /^[a-zA-Z0-9_.-]{1,200}$/;

function sanitizeStorageSegment(value: string, fallback: string): string {
  const trimmed = value.trim().slice(0, 200);
  return SAFE_STORAGE_SEGMENT.test(trimmed) ? trimmed : fallback;
}

function isFiniteCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** Strip unexpected keys/values before persisting layout to localStorage. */
export function sanitizeUmlPositionMap(positions: UmlPositionMap): UmlPositionMap {
  const clean: UmlPositionMap = {};
  for (const [key, val] of Object.entries(positions)) {
    if (key === UML_VIEWPORT_KEY) {
      const vp = val as unknown as UmlViewport;
      if (isFiniteCoord(vp?.x) && isFiniteCoord(vp?.y) && isFiniteCoord(vp?.scale)) {
        clean[UML_VIEWPORT_KEY] = { x: vp.x, y: vp.y, scale: vp.scale };
      }
      continue;
    }
    if (!SAFE_LAYOUT_KEY.test(key)) continue;
    if (!val || !isFiniteCoord(val.x) || !isFiniteCoord(val.y)) continue;
    if ('scale' in val && isFiniteCoord(val.scale)) continue;
    clean[key] = { x: val.x, y: val.y };
  }
  return clean;
}

export function flowNodeLayoutKey(node: Node): string | null {
  if (node.type !== 'editable') return null;
  const data = node.data as { className?: string; label?: string; toolName?: string } | undefined;
  if (data?.toolName === 'package') return UML_PACKAGE_LAYOUT_KEY;
  const className = data?.className ?? data?.label;
  if (className) return sanitizeUmlClassId(className);
  return node.id;
}

export function positionsFromFlowNodes(nodes: Node[]): UmlPositionMap {
  const posMap: UmlPositionMap = {};
  nodes.forEach(n => {
    const key = flowNodeLayoutKey(n);
    if (key) posMap[key] = { x: n.position.x, y: n.position.y };
  });
  return posMap;
}

export function positionsFromUmlClasses(
  classes: Array<{ id: string; x: number; y: number }>,
): UmlPositionMap {
  const posMap: UmlPositionMap = {};
  classes.forEach(c => {
    posMap[c.id] = { x: c.x, y: c.y };
  });
  return posMap;
}

function readRawPositionMap(scopeId: string, fileName: string): UmlPositionMap | null {
  try {
    const raw = localStorage.getItem(umlLayoutStorageKey(scopeId, fileName));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UmlPositionMap;
    if (!parsed || typeof parsed !== 'object') return null;
    return sanitizeUmlPositionMap(parsed);
  } catch {
    return null;
  }
}

function hasClassLayoutKeys(map: UmlPositionMap): boolean {
  return Object.keys(map).some(k => k !== UML_VIEWPORT_KEY);
}

export function loadUmlViewport(scopeId: string, fileName: string): UmlViewport | null {
  const map = readRawPositionMap(scopeId, fileName);
  if (!map) return null;
  const vp = map[UML_VIEWPORT_KEY] as UmlViewport | undefined;
  if (!vp || typeof vp.x !== 'number' || typeof vp.y !== 'number' || typeof vp.scale !== 'number') {
    return null;
  }
  return vp;
}

export function buildUmlLayoutPayload(
  classes: Array<{ id: string; x: number; y: number }>,
  viewport?: UmlViewport | null,
): UmlPositionMap {
  const payload = positionsFromUmlClasses(classes);
  if (viewport) payload[UML_VIEWPORT_KEY] = viewport;
  return payload;
}

export function saveUmlLayout(scopeId: string, fileName: string, positions: UmlPositionMap): void {
  const sanitized = sanitizeUmlPositionMap(positions);
  if (!fileName || !hasClassLayoutKeys(sanitized)) return;
  try {
    localStorage.setItem(
      umlLayoutStorageKey(scopeId, fileName),
      JSON.stringify(sanitized),
    );
  } catch {
    /* quota / private browsing */
  }
}

export function hasSavedUmlLayout(scopeId: string, fileName: string): boolean {
  const map = readRawPositionMap(scopeId, fileName);
  return map !== null && hasClassLayoutKeys(map);
}

export function loadUmlLayout(scopeId: string, fileName: string): UmlPositionMap | null {
  return readRawPositionMap(scopeId, fileName);
}

export function applyLayoutToFlowNodes<T extends Node>(scopeId: string, fileName: string, nodes: T[]): T[] {
  const posMap = loadUmlLayout(scopeId, fileName);
  if (!posMap) return nodes;
  return nodes.map(n => {
    const key = flowNodeLayoutKey(n);
    const byKey = key ? posMap[key] : undefined;
    const byId = posMap[n.id];
    const saved = byKey ?? byId;
    return saved ? { ...n, position: { x: saved.x, y: saved.y } } : n;
  });
}

export function applyLayoutToUmlClasses<T extends { id: string; name?: string; x: number; y: number }>(
  scopeId: string,
  fileName: string,
  classes: T[],
): T[] {
  const posMap = loadUmlLayout(scopeId, fileName);
  if (!posMap) return classes;
  return classes.map(c => {
    const saved = posMap[c.id]
      ?? (c.name ? posMap[sanitizeUmlClassId(c.name)] : undefined);
    return saved ? { ...c, x: saved.x, y: saved.y } : c;
  });
}
