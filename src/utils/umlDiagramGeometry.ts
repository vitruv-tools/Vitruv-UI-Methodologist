export interface Point {
  x: number;
  y: number;
}

export interface LineBridge {
  t: number;
  bulgeSign: 1 | -1;
}

export interface LineSegment {
  id: string;
  drawP1: Point;
  drawP2: Point;
}

export interface MultiplicityBadge {
  key: string;
  relId: string;
  end: 'start' | 'end';
  anchorClassId: string;
  text: string;
  x: number;
  y: number;
  nx: number;
  ny: number;
  anchorX: number;
  anchorY: number;
  lineUx: number;
  lineUy: number;
}

const BRIDGE_GAP_HALF = 10;
const BRIDGE_BULGE = 10;
const MULT_MIN_GAP = 38;

function alongSign(end: 'start' | 'end'): number {
  return end === 'start' ? 1 : -1;
}

function edgeSortCoord(badge: MultiplicityBadge): number {
  return Math.abs(badge.lineUx) > Math.abs(badge.lineUy) ? badge.anchorY : badge.anchorX;
}

function pushAlongLine(badge: MultiplicityBadge, delta: number): void {
  const sign = alongSign(badge.end);
  badge.x += badge.lineUx * delta * sign;
  badge.y += badge.lineUy * delta * sign;
}

export function segmentIntersection(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): (Point & { t: number; u: number }) | null {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;
  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < 1e-9) return null;

  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / denom;
  const u = ((b1.x - a1.x) * day - (b1.y - a1.y) * dax) / denom;
  const eps = 0.04;
  if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null;

  return {
    x: a1.x + t * dax,
    y: a1.y + t * day,
    t,
    u,
  };
}

export function computeLineBridges(segments: LineSegment[]): Map<string, LineBridge[]> {
  const bridges = new Map<string, LineBridge[]>();

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i];
      const b = segments[j];
      const hit = segmentIntersection(a.drawP1, a.drawP2, b.drawP1, b.drawP2);
      if (!hit) continue;

      const aLen = Math.max(Math.hypot(a.drawP2.x - a.drawP1.x, a.drawP2.y - a.drawP1.y), 0.0001);
      const aUx = (a.drawP2.x - a.drawP1.x) / aLen;
      const aUy = (a.drawP2.y - a.drawP1.y) / aLen;
      const bMid = {
        x: (b.drawP1.x + b.drawP2.x) / 2,
        y: (b.drawP1.y + b.drawP2.y) / 2,
      };
      const cross = aUx * (bMid.y - hit.y) - aUy * (bMid.x - hit.x);
      const bulgeSign: 1 | -1 = cross > 0 ? 1 : -1;

      const list = bridges.get(a.id) ?? [];
      list.push({ t: hit.t, bulgeSign });
      bridges.set(a.id, list);
    }
  }

  return bridges;
}

export function bridgedLinePathD(drawP1: Point, drawP2: Point, bridges: LineBridge[]): string {
  if (bridges.length === 0) {
    return `M ${drawP1.x} ${drawP1.y} L ${drawP2.x} ${drawP2.y}`;
  }

  const dx = drawP2.x - drawP1.x;
  const dy = drawP2.y - drawP1.y;
  const len = Math.max(Math.hypot(dx, dy), 0.0001);
  const ux = dx / len;
  const uy = dy / len;
  const sorted = [...bridges].sort((a, b) => a.t - b.t);

  let d = `M ${drawP1.x} ${drawP1.y}`;
  for (const bridge of sorted) {
    const ix = drawP1.x + ux * len * bridge.t;
    const iy = drawP1.y + uy * len * bridge.t;
    const gs = { x: ix - ux * BRIDGE_GAP_HALF, y: iy - uy * BRIDGE_GAP_HALF };
    const ge = { x: ix + ux * BRIDGE_GAP_HALF, y: iy + uy * BRIDGE_GAP_HALF };
    const mx = (gs.x + ge.x) / 2;
    const my = (gs.y + ge.y) / 2;
    const bx = mx + (-uy) * bridge.bulgeSign * BRIDGE_BULGE;
    const by = my + ux * bridge.bulgeSign * BRIDGE_BULGE;
    d += ` L ${gs.x} ${gs.y} Q ${bx} ${by} ${ge.x} ${ge.y}`;
  }
  d += ` L ${drawP2.x} ${drawP2.y}`;
  return d;
}

function groupBadgeIndices(badges: MultiplicityBadge[]): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  badges.forEach((badge, index) => {
    const key = `${badge.end}:${badge.anchorClassId}`;
    const list = groups.get(key) ?? [];
    list.push(index);
    groups.set(key, list);
  });
  return groups;
}

function separateBadgesIfNeeded(
  a: MultiplicityBadge,
  b: MultiplicityBadge,
  extraPush: number,
): boolean {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  if (dist >= MULT_MIN_GAP) return false;

  const push = (MULT_MIN_GAP - dist) / 2 + extraPush;
  pushAlongLine(a, -push);
  pushAlongLine(b, push);
  return true;
}

function runIndexedSeparationPasses(
  indices: number[],
  result: MultiplicityBadge[],
  maxPasses: number,
  extraPush: number,
): void {
  if (indices.length <= 1) return;

  indices.sort((ia, ib) => edgeSortCoord(result[ia]) - edgeSortCoord(result[ib]));
  for (let pass = 0; pass < maxPasses; pass++) {
    let moved = false;
    for (let k = 0; k < indices.length - 1; k++) {
      if (separateBadgesIfNeeded(result[indices[k]], result[indices[k + 1]], extraPush)) {
        moved = true;
      }
    }
    if (!moved) break;
  }
}

function separateGroupedBadges(result: MultiplicityBadge[], groups: Map<string, number[]>): void {
  for (const indices of groups.values()) {
    runIndexedSeparationPasses(indices, result, 8, 2);
  }
}

function separateAllBadgePairs(result: MultiplicityBadge[]): void {
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        if (separateBadgesIfNeeded(result[i], result[j], 1)) {
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

/** Keep every badge on its own line; only nudge along that line when labels collide. */
export function optimizeMultiplicityBadges(badges: MultiplicityBadge[]): MultiplicityBadge[] {
  const result = badges.map(b => ({ ...b }));
  const groups = groupBadgeIndices(result);
  separateGroupedBadges(result, groups);
  separateAllBadgePairs(result);
  return result;
}
