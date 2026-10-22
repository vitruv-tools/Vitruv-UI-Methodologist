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
  /** Length of the relationship line in diagram coordinates. */
  lineLength?: number;
}

export interface AxisRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const BRIDGE_GAP_HALF = 10;
const BRIDGE_BULGE = 10;
const MULT_MIN_GAP = 40;
const MULT_GROUP_GAP = 42;
const SHORT_LINE_THRESHOLD = 120;
const MIN_ALONG_OFFSET = 26;

function badgeBoundsAt(badge: MultiplicityBadge, halfW: number, halfH: number): AxisRect {
  return {
    left: badge.x - halfW,
    top: badge.y - halfH,
    right: badge.x + halfW,
    bottom: badge.y + halfH,
  };
}

function rectsOverlap(a: AxisRect, b: AxisRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function maxAlongForLine(lineLength: number, badgeHalfH: number): number {
  return Math.max(MIN_ALONG_OFFSET, (lineLength - badgeHalfH * 2 - 10) / 2);
}

function perpOffsetForLine(basePerp: number, lineLength: number): number {
  if (lineLength >= SHORT_LINE_THRESHOLD) return basePerp;
  return basePerp + Math.min(28, (SHORT_LINE_THRESHOLD - lineLength) * 0.35);
}

function alongSign(end: 'start' | 'end'): number {
  return end === 'start' ? 1 : -1;
}

/** Move a badge further along its edge, away from the attached class. */
function pushAwayFromAnchor(badge: MultiplicityBadge, distance: number): void {
  const sign = alongSign(badge.end);
  badge.x -= badge.lineUx * distance * sign;
  badge.y -= badge.lineUy * distance * sign;
}

function distanceFromAnchor(badge: MultiplicityBadge): number {
  const sign = alongSign(badge.end);
  return (badge.x - badge.anchorX) * badge.lineUx * sign
    + (badge.y - badge.anchorY) * badge.lineUy * sign;
}

function setBadgeAlongOffset(
  badge: MultiplicityBadge,
  along: number,
  perpOffset: number,
): void {
  const sign = alongSign(badge.end);
  badge.x = badge.anchorX + badge.lineUx * along * sign + badge.nx * perpOffset;
  badge.y = badge.anchorY + badge.lineUy * along * sign + badge.ny * perpOffset;
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
  if (a.anchorClassId === b.anchorClassId && a.end === b.end) {
    const further = distanceFromAnchor(a) >= distanceFromAnchor(b) ? a : b;
    pushAwayFromAnchor(further, push);
  } else {
    pushAwayFromAnchor(a, push);
    pushAwayFromAnchor(b, push);
  }
  return true;
}

function pushBadgePerpendicular(badge: MultiplicityBadge, delta: number): void {
  badge.x += badge.nx * delta;
  badge.y += badge.ny * delta;
}

function pushBadgeFromRectCenter(badge: MultiplicityBadge, rect: AxisRect): void {
  const cx = (rect.left + rect.right) / 2;
  const cy = (rect.top + rect.bottom) / 2;
  const dx = badge.x - cx;
  const dy = badge.y - cy;
  const dist = Math.max(Math.hypot(dx, dy), 0.0001);
  badge.x += (dx / dist) * 8;
  badge.y += (dy / dist) * 8;
}

function layoutAnchorGroup(
  indices: number[],
  result: MultiplicityBadge[],
  baseAlong: number,
  perpOffset: number,
): void {
  if (indices.length === 0) return;

  const lineLengths = indices.map(i => result[i].lineLength ?? Number.POSITIVE_INFINITY);
  const minLen = Math.min(...lineLengths);
  const short = minLen < SHORT_LINE_THRESHOLD;
  const cappedAlong = Math.min(baseAlong, maxAlongForLine(minLen, 12));

  if (indices.length === 1) {
    const badge = result[indices[0]];
    if (badge.lineLength == null) return;
    setBadgeAlongOffset(
      badge,
      Math.min(baseAlong, maxAlongForLine(badge.lineLength, 12)),
      perpOffsetForLine(perpOffset, badge.lineLength),
    );
    return;
  }

  indices.sort((ia, ib) => distanceFromAnchor(result[ia]) - distanceFromAnchor(result[ib]));
  indices.forEach((idx, i) => {
    const len = result[idx].lineLength ?? minLen;
    const along = short
      ? Math.min(cappedAlong, maxAlongForLine(len, 12))
      : cappedAlong + i * MULT_GROUP_GAP;
    const perp = short
      ? perpOffsetForLine(perpOffset, len) + (i - (indices.length - 1) / 2) * 26
      : perpOffset + (i - (indices.length - 1) / 2) * 6;
    setBadgeAlongOffset(result[idx], along, perp);
  });
}

function separateGroupedBadges(
  result: MultiplicityBadge[],
  groups: Map<string, number[]>,
  baseAlong: number,
  perpOffset: number,
): void {
  for (const indices of groups.values()) {
    layoutAnchorGroup(indices, result, baseAlong, perpOffset);
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

/** Keep every badge on its own line; spread from anchors and nudge apart when labels collide. */
export function optimizeMultiplicityBadges(
  badges: MultiplicityBadge[],
  baseAlong = 52,
  perpOffset = 10,
): MultiplicityBadge[] {
  const result = badges.map(b => ({ ...b }));
  const groups = groupBadgeIndices(result);
  separateGroupedBadges(result, groups, baseAlong, perpOffset);
  separateAllBadgePairs(result);
  return result;
}

/** Push badges away from class boxes and each other until labels are readable. */
export function resolveMultiplicityBadgeCollisions(
  badges: MultiplicityBadge[],
  obstacles: AxisRect[],
  badgeHalfW = 18,
  badgeHalfH = 12,
): MultiplicityBadge[] {
  const result = badges.map(b => ({ ...b }));
  clearBadgesFromObstacles(result, obstacles, badgeHalfW, badgeHalfH);
  settleBadgeCollisions(result, obstacles, badgeHalfW, badgeHalfH);
  return result;
}

function findBadgeOverlap(
  badge: MultiplicityBadge,
  obstacles: AxisRect[],
  badgeHalfW: number,
  badgeHalfH: number,
): AxisRect | null {
  const bounds = badgeBoundsAt(badge, badgeHalfW, badgeHalfH);
  return obstacles.find(rect => rectsOverlap(bounds, rect)) ?? null;
}

function nudgeBadgeClearOfObstacle(badge: MultiplicityBadge, hit: AxisRect, pass: number): void {
  const strategy = pass % 3;
  if (strategy === 0) {
    pushAwayFromAnchor(badge, 6);
    return;
  }
  if (strategy === 1) {
    pushBadgePerpendicular(badge, pass % 2 === 0 ? 7 : -7);
    return;
  }
  pushBadgeFromRectCenter(badge, hit);
}

function clearBadgesFromObstacles(
  badges: MultiplicityBadge[],
  obstacles: AxisRect[],
  badgeHalfW: number,
  badgeHalfH: number,
): void {
  for (const badge of badges) {
    for (let pass = 0; pass < 36; pass++) {
      const hit = findBadgeOverlap(badge, obstacles, badgeHalfW, badgeHalfH);
      if (!hit) break;
      nudgeBadgeClearOfObstacle(badge, hit, pass);
    }
  }
}

function refineBadgeSpacingPass(
  badges: MultiplicityBadge[],
  obstacles: AxisRect[],
  badgeHalfW: number,
  badgeHalfH: number,
): boolean {
  let moved = false;
  for (let i = 0; i < badges.length; i++) {
    for (let j = i + 1; j < badges.length; j++) {
      if (separateBadgesIfNeeded(badges[i], badges[j], 2)) moved = true;
    }
    const hit = findBadgeOverlap(badges[i], obstacles, badgeHalfW, badgeHalfH);
    if (!hit) continue;
    pushBadgeFromRectCenter(badges[i], hit);
    moved = true;
  }
  return moved;
}

function settleBadgeCollisions(
  badges: MultiplicityBadge[],
  obstacles: AxisRect[],
  badgeHalfW: number,
  badgeHalfH: number,
): void {
  for (let pass = 0; pass < 8; pass++) {
    const moved = refineBadgeSpacingPass(badges, obstacles, badgeHalfW, badgeHalfH);
    if (!moved) break;
  }
}
