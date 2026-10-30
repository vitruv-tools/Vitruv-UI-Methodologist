import { STUB_LENGTH } from './flowCanvasAStarRouter';

export interface RoutePoint { x: number; y: number }

/** A stub may not be dragged shorter than this, so arrowheads stay clear of the box. */
const MIN_STUB = 14;
const MIN_SEGMENT = 16;
const EPS = 0.5;

function isHorizontal(a: RoutePoint, b: RoutePoint): boolean {
  return Math.abs(a.y - b.y) < EPS && Math.abs(a.x - b.x) >= EPS;
}

function segmentLength(a: RoutePoint, b: RoutePoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pointAlong(a: RoutePoint, b: RoutePoint, distance: number): RoutePoint {
  const len = segmentLength(a, b) || 1;
  return { x: a.x + ((b.x - a.x) / len) * distance, y: a.y + ((b.y - a.y) / len) * distance };
}

export interface PreparedDrag {
  points: RoutePoint[];
  /** Index of the dragged segment (points[index] → points[index + 1]). */
  index: number;
  horizontal: boolean;
}

/**
 * Readies a saved route for dragging one of its segments. The runs touching a
 * box are kept as straight stubs, and extra bend points are added where the
 * dragged segment would otherwise have to skew its neighbours, so dragging
 * only ever slides the segment sideways and stretches what it is joined to.
 * Returns null for segments that cannot move (a bare stub at a box).
 */
export function prepareSegmentDrag(route: RoutePoint[], segment: number): PreparedDrag | null {
  if (segment < 0 || segment >= route.length - 1) return null;
  const pts = route.map(p => ({ ...p }));
  let idx = segment;

  if (idx === pts.length - 2) {
    const a = pts[idx];
    const b = pts[idx + 1];
    if (segmentLength(a, b) < STUB_LENGTH + MIN_SEGMENT) return null;
    pts.splice(idx + 1, 0, pointAlong(b, a, STUB_LENGTH));
  }
  if (idx === 0) {
    const a = pts[0];
    const b = pts[1];
    if (segmentLength(a, b) < STUB_LENGTH + MIN_SEGMENT) return null;
    pts.splice(1, 0, pointAlong(a, b, STUB_LENGTH));
    idx = 1;
  }

  const horizontal = isHorizontal(pts[idx], pts[idx + 1]);
  if (!horizontal && Math.abs(pts[idx].x - pts[idx + 1].x) >= EPS) return null;

  const prevCollinear = isHorizontal(pts[idx - 1], pts[idx]) === horizontal
    && segmentLength(pts[idx - 1], pts[idx]) >= EPS;
  const nextCollinear = isHorizontal(pts[idx + 1], pts[idx + 2]) === horizontal
    && segmentLength(pts[idx + 1], pts[idx + 2]) >= EPS;
  if (nextCollinear) pts.splice(idx + 2, 0, { ...pts[idx + 1] });
  if (prevCollinear) {
    pts.splice(idx, 0, { ...pts[idx] });
    idx += 1;
  }
  return { points: pts, index: idx, horizontal };
}

/** Keeps a stub at least MIN_STUB long, on the side of the box it already leaves from. */
function clampStub(anchor: number, stubEnd: number, value: number): number {
  const outward = Math.sign(stubEnd - anchor) || 1;
  return anchor + outward * Math.max(MIN_STUB, (value - anchor) * outward);
}

/** Slides the prepared segment to `coord` (y for a horizontal one, x for a vertical one). */
export function moveSegment(prepared: PreparedDrag, coord: number): RoutePoint[] {
  const { points, index, horizontal } = prepared;
  const axis = horizontal ? 'y' : 'x';
  const last = points.length - 1;
  let value = coord;

  // A segment next to a box's stub moves along that stub, which must stay clear of the box.
  if (index === 1) value = clampStub(points[0][axis], points[1][axis], value);
  if (index + 1 === last - 1) value = clampStub(points[last][axis], points[last - 1][axis], value);

  const next = points.map(p => ({ ...p }));
  next[index][axis] = value;
  next[index + 1][axis] = value;
  return next;
}

/** Drops repeated points and bends that no longer bend. */
export function cleanRoute(points: RoutePoint[]): RoutePoint[] {
  const deduped: RoutePoint[] = [];
  for (const p of points) {
    const prev = deduped[deduped.length - 1];
    if (!prev || Math.abs(prev.x - p.x) >= EPS || Math.abs(prev.y - p.y) >= EPS) deduped.push(p);
  }
  if (deduped.length < 3) return deduped;
  const out: RoutePoint[] = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i++) {
    const prev = out[out.length - 1];
    const cur = deduped[i];
    const next = deduped[i + 1];
    const collinear = (Math.abs(prev.x - cur.x) < EPS && Math.abs(cur.x - next.x) < EPS)
      || (Math.abs(prev.y - cur.y) < EPS && Math.abs(cur.y - next.y) < EPS);
    if (!collinear) out.push(cur);
  }
  out.push(deduped[deduped.length - 1]);
  return out;
}
