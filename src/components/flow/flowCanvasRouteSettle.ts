import type { Edge, Node } from 'reactflow';
import {
  asSavedRoute,
  isSavedRouteValid,
  nodeWorldRect,
  routeAllReactionEdges,
  endsAreOrthogonal,
  hasCrampedEnds,
  tidyRoute,
  type Rect,
  type SavedRoute,
} from './flowCanvasAStarRouter';
import { vsumRouteKeys, type VsumRouteMap } from '../../utils/vsumRouteStorage';

function rectsOf(nodes: Node[]): Map<string, Rect> {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const rects = new Map<string, Rect>();
  for (const node of nodes) {
    const rect = nodeWorldRect(node, byId);
    if (rect) rects.set(node.id, rect);
  }
  return rects;
}

/** Cleans up hooks/jogs in a route saved before the router learned to avoid them. */
function tidiedRoute(route: SavedRoute): SavedRoute {
  const points = tidyRoute(route.points);
  const unchanged = points.length === route.points.length
    && points.every((p, i) => p.x === route.points[i].x && p.y === route.points[i].y);
  if (unchanged || !endsAreOrthogonal(points, route.sourceHandle, route.targetHandle)) return route;
  return { ...route, points };
}

function withRoute(edge: Edge, route: SavedRoute): Edge {
  return {
    ...edge,
    sourceHandle: route.sourceHandle,
    targetHandle: route.targetHandle,
    data: { ...edge.data, savedRoute: route },
  };
}

/**
 * Gives every coarse link a stored path. A link keeps the path it has (or the
 * one from local storage) for as long as it still meets its boxes; only links
 * without a usable path — new ones, or ones whose box moved — are routed.
 * Returns the same array when nothing needed to change.
 */
export function settleReactionRoutes(
  nodes: Node[],
  edges: Edge[],
  stored: VsumRouteMap,
): Edge[] {
  const rects = rectsOf(nodes);
  const keys = vsumRouteKeys(nodes, edges);
  let changed = false;

  const attached = edges.map(edge => {
    if (edge.type !== 'reactions') return edge;
    const source = rects.get(edge.source);
    const target = rects.get(edge.target);
    if (!source || !target) return edge;
    const current = asSavedRoute(edge.data?.savedRoute);
    if (isSavedRouteValid(current, source, target)) {
      const tidied = tidiedRoute(current);
      if (tidied === current) return edge;
      changed = true;
      return withRoute(edge, tidied);
    }
    const key = keys.get(edge.id);
    const fromStorage = key ? asSavedRoute(stored[key]) : null;
    if (!isSavedRouteValid(fromStorage, source, target) || hasCrampedEnds(fromStorage)) return edge;
    changed = true;
    return withRoute(edge, tidiedRoute(fromStorage));
  });

  const routes = routeAllReactionEdges(nodes, attached);
  const settled = attached.map(edge => {
    if (edge.type !== 'reactions') return edge;
    const source = rects.get(edge.source);
    const target = rects.get(edge.target);
    if (!source || !target) return edge;
    if (isSavedRouteValid(asSavedRoute(edge.data?.savedRoute), source, target)) return edge;
    const route = routes.get(edge.id);
    if (!route) return edge;
    changed = true;
    return withRoute(edge, route);
  });

  return changed ? settled : edges;
}
