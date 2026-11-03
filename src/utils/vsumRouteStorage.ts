import type { Edge, Node } from 'reactflow';
import {
  asSavedRoute,
  type SavedRoute,
} from '../components/flow/flowCanvasAStarRouter';
import {
  vsumLayoutIdentityFromNode,
  vsumLayoutKeys,
  type VsumLayoutProjectId,
} from './vsumLayoutStorage';

export const VSUM_ROUTE_KEY_PREFIX = 'vitruv.vsum.routes.v1';

/** Stable link identity → saved path, so a reopened V-SUMM draws the links as they were left. */
export type VsumRouteMap = Record<string, SavedRoute>;

const SAFE_STORAGE_SEGMENT = /^[a-zA-Z0-9_.-]{1,200}$/;

export function vsumRouteStorageKey(projectId: VsumLayoutProjectId): string {
  const raw = String(projectId ?? 'default').trim().slice(0, 200);
  const segment = SAFE_STORAGE_SEGMENT.test(raw) ? raw : 'default';
  return `${VSUM_ROUTE_KEY_PREFIX}.${segment}`;
}

function roundPoint(p: { x: number; y: number }) {
  return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
}

export function sanitizeVsumRouteMap(raw: unknown): VsumRouteMap {
  if (!raw || typeof raw !== 'object') return {};
  const clean: VsumRouteMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || key.length > 1024) continue;
    const route = asSavedRoute(value);
    if (!route) continue;
    clean[key] = {
      sourceHandle: route.sourceHandle,
      targetHandle: route.targetHandle,
      points: route.points.map(roundPoint),
    };
  }
  return clean;
}

export function loadVsumRoutes(projectId: VsumLayoutProjectId): VsumRouteMap {
  try {
    const raw = localStorage.getItem(vsumRouteStorageKey(projectId));
    return raw ? sanitizeVsumRouteMap(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function saveVsumRoutes(projectId: VsumLayoutProjectId, routes: VsumRouteMap): void {
  const sanitized = sanitizeVsumRouteMap(routes);
  try {
    localStorage.setItem(vsumRouteStorageKey(projectId), JSON.stringify(sanitized));
  } catch {
    /* quota / private browsing */
  }
}

/**
 * Identity of every coarse link, independent of its (timestamped) edge id:
 * the endpoints' meta model ids, with `#n` told apart when a pair has several.
 */
export function vsumRouteKeys(nodes: Node[], edges: Edge[]): Map<string, string> {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const keyOf = (id: string): string => {
    const node = byId.get(id);
    return (node ? vsumLayoutKeys(vsumLayoutIdentityFromNode(node))[0] : undefined) ?? `id:${id}`;
  };
  const seen = new Map<string, number>();
  const result = new Map<string, string>();
  const sorted = edges
    .filter(e => e.type === 'reactions')
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const edge of sorted) {
    const base = `${keyOf(edge.source)}>${keyOf(edge.target)}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    result.set(edge.id, count === 0 ? base : `${base}#${count}`);
  }
  return result;
}

/** The routes currently held by the edges, ready to be stored. */
export function collectVsumRoutes(nodes: Node[], edges: Edge[]): VsumRouteMap {
  const keys = vsumRouteKeys(nodes, edges);
  const routes: VsumRouteMap = {};
  for (const edge of edges) {
    const key = keys.get(edge.id);
    const route = key ? asSavedRoute(edge.data?.savedRoute) : null;
    if (key && route) routes[key] = route;
  }
  return routes;
}
