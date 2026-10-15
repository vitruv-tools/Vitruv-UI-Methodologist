import type { Node } from 'reactflow';

export const VSUM_LAYOUT_KEY_PREFIX = 'vitruv.vsum.layout.v1';

export interface VsumCoord {
  x: number;
  y: number;
}

/** Stable identity aliases → canvas coordinates for ecoreFile boxes. */
export type VsumLayoutMap = Record<string, VsumCoord>;

export type VsumLayoutProjectId = number | string | null | undefined;

export interface VsumLayoutIdentity {
  nodeId?: string;
  metaModelId?: number;
  metaModelSourceId?: number;
  nsUri?: string;
  fileName?: string;
}

const SAFE_STORAGE_SEGMENT = /^[a-zA-Z0-9_.-]{1,200}$/;

function sanitizeStorageSegment(value: string, fallback: string): string {
  const trimmed = value.trim().slice(0, 200);
  return SAFE_STORAGE_SEGMENT.test(trimmed) ? trimmed : fallback;
}

function isFiniteCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function isSafeLayoutKey(key: string): boolean {
  return Boolean(key) && key.length <= 512;
}

function coordFromUnknown(value: unknown): VsumCoord | null {
  if (!value || typeof value !== 'object') return null;
  const pos = value as { x?: unknown; y?: unknown };
  if (!isFiniteCoord(pos.x) || !isFiniteCoord(pos.y)) return null;
  return { x: pos.x, y: pos.y };
}

export function vsumLayoutStorageKey(projectId: VsumLayoutProjectId): string {
  const segment = sanitizeStorageSegment(String(projectId ?? 'default'), 'default');
  return `${VSUM_LAYOUT_KEY_PREFIX}.${segment}`;
}

function pushUniqueKey(keys: string[], key: string): void {
  if (!isSafeLayoutKey(key) || keys.includes(key)) return;
  keys.push(key);
}

/** Aliases so a box can be found after reload even if node ids change. */
export function vsumLayoutKeys(identity: VsumLayoutIdentity): string[] {
  const keys: string[] = [];
  if (typeof identity.metaModelId === 'number' && Number.isFinite(identity.metaModelId)) {
    pushUniqueKey(keys, `mm:${identity.metaModelId}`);
  }
  if (
    typeof identity.metaModelSourceId === 'number'
    && Number.isFinite(identity.metaModelSourceId)
  ) {
    pushUniqueKey(keys, `mm:${identity.metaModelSourceId}`);
  }
  if (identity.nsUri) pushUniqueKey(keys, `ns:${identity.nsUri}`);
  if (identity.fileName) pushUniqueKey(keys, `file:${identity.fileName}`);
  if (identity.nodeId) pushUniqueKey(keys, `id:${identity.nodeId}`);
  return keys;
}

export function vsumLayoutIdentityFromNode(node: Node): VsumLayoutIdentity {
  return {
    nodeId: node.id,
    metaModelId: typeof node.data?.metaModelId === 'number' ? node.data.metaModelId : undefined,
    metaModelSourceId: typeof node.data?.metaModelSourceId === 'number'
      ? node.data.metaModelSourceId
      : undefined,
    nsUri: typeof node.data?.nsUri === 'string' && node.data.nsUri ? node.data.nsUri : undefined,
    fileName: typeof node.data?.fileName === 'string' && node.data.fileName
      ? node.data.fileName
      : undefined,
  };
}

export function sanitizeVsumLayoutMap(raw: unknown): VsumLayoutMap {
  const record = asRecord(raw);
  if (!record) return {};
  const clean: VsumLayoutMap = {};
  for (const [key, value] of Object.entries(record)) {
    if (!isSafeLayoutKey(key)) continue;
    const coord = coordFromUnknown(value);
    if (!coord) continue;
    clean[key] = coord;
  }
  return clean;
}

function aliasUseCount(nodes: Node[], read: (node: Node) => string | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    if (node.type !== 'ecoreFile') continue;
    const value = read(node);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export function captureVsumLayout(nodes: Node[]): VsumLayoutMap {
  const map: VsumLayoutMap = {};
  const nsCounts = aliasUseCount(nodes, node => {
    const nsUri = node.data?.nsUri;
    return typeof nsUri === 'string' && nsUri ? nsUri : undefined;
  });
  const fileCounts = aliasUseCount(nodes, node => {
    const fileName = node.data?.fileName;
    return typeof fileName === 'string' && fileName ? fileName : undefined;
  });
  for (const node of nodes) {
    if (node.type !== 'ecoreFile') continue;
    const coord: VsumCoord = { x: node.position.x, y: node.position.y };
    if (!isFiniteCoord(coord.x) || !isFiniteCoord(coord.y)) continue;
    for (const key of vsumLayoutKeys(vsumLayoutIdentityFromNode(node))) {
      if (key.startsWith('ns:') && (nsCounts.get(key.slice(3)) ?? 0) > 1) continue;
      if (key.startsWith('file:') && (fileCounts.get(key.slice(5)) ?? 0) > 1) continue;
      map[key] = coord;
    }
  }
  return map;
}

export function lookupVsumLayoutPosition(
  layout: VsumLayoutMap,
  identity: VsumLayoutIdentity,
): VsumCoord | undefined {
  for (const key of vsumLayoutKeys(identity)) {
    const saved = layout[key];
    if (saved) return saved;
  }
  return undefined;
}

export function loadVsumLayout(projectId: VsumLayoutProjectId): VsumLayoutMap {
  try {
    const raw = localStorage.getItem(vsumLayoutStorageKey(projectId));
    if (!raw) return {};
    return sanitizeVsumLayoutMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveVsumLayout(
  projectId: VsumLayoutProjectId,
  layout: VsumLayoutMap,
): void {
  const sanitized = sanitizeVsumLayoutMap(layout);
  if (Object.keys(sanitized).length === 0) return;
  try {
    localStorage.setItem(vsumLayoutStorageKey(projectId), JSON.stringify(sanitized));
  } catch {
    /* quota / private browsing */
  }
}

export function persistVsumLayoutFromNodes(
  projectId: VsumLayoutProjectId,
  nodes: Node[],
): void {
  const captured = captureVsumLayout(nodes);
  if (Object.keys(captured).length === 0) return;
  saveVsumLayout(projectId, { ...loadVsumLayout(projectId), ...captured });
}

/** Merge one box into the saved map without dropping other models. */
export function upsertVsumLayoutPosition(
  projectId: VsumLayoutProjectId,
  identity: VsumLayoutIdentity,
  position: VsumCoord,
): void {
  if (!isFiniteCoord(position.x) || !isFiniteCoord(position.y)) return;
  const keys = vsumLayoutKeys(identity);
  if (keys.length === 0) return;
  const next = { ...loadVsumLayout(projectId) };
  for (const key of keys) next[key] = { x: position.x, y: position.y };
  saveVsumLayout(projectId, next);
}

export function loadVsumLayoutPosition(
  projectId: VsumLayoutProjectId,
  identity: VsumLayoutIdentity,
): VsumCoord | undefined {
  return lookupVsumLayoutPosition(loadVsumLayout(projectId), identity);
}
