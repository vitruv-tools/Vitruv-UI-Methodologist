// EcoreFileBox collision helpers — shared by layout and drag clamping.
import { Circle, clampToCircle } from '../../hooks/useCircleContainment';

export const ECORE_W = 118;
export const ECORE_H = 126;
export const ECORE_GAP = 20;

export function ecoreRectsOverlap(ax: number, ay: number, bx: number, by: number): boolean {
  return (
    ax < bx + ECORE_W + ECORE_GAP
    && ax + ECORE_W + ECORE_GAP > bx
    && ay < by + ECORE_H + ECORE_GAP
    && ay + ECORE_H + ECORE_GAP > by
  );
}

export function isEcorePositionFree(
  x: number,
  y: number,
  existingNodes: { position: { x: number; y: number } }[],
): boolean {
  return !existingNodes.some(n => ecoreRectsOverlap(x, y, n.position.x, n.position.y));
}

function findFreePositionOnSpiralRing(
  startX: number,
  startY: number,
  step: number,
  ring: number,
  existingNodes: { position: { x: number; y: number } }[],
): { x: number; y: number } | null {
  for (let dx = -ring; dx <= ring; dx++) {
    for (let dy = -ring; dy <= ring; dy++) {
      if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
      const x = startX + dx * step;
      const y = startY + dy * step;
      if (x < 0 || y < 0) continue;
      if (isEcorePositionFree(x, y, existingNodes)) return { x, y };
    }
  }
  return null;
}

function findFreePositionInSpiral(
  startX: number,
  startY: number,
  step: number,
  existingNodes: { position: { x: number; y: number } }[],
): { x: number; y: number } | null {
  for (let ring = 1; ring < 30; ring++) {
    const position = findFreePositionOnSpiralRing(startX, startY, step, ring, existingNodes);
    if (position) return position;
  }
  return null;
}

export function findFreeEcorePosition(
  existingNodes: { position: { x: number; y: number } }[],
  preferred?: { x: number; y: number },
): { x: number; y: number } {
  const step = ECORE_W + ECORE_GAP;
  const startX = preferred?.x ?? 60;
  const startY = preferred?.y ?? 60;

  if (isEcorePositionFree(startX, startY, existingNodes)) {
    return { x: startX, y: startY };
  }

  const spiralPosition = findFreePositionInSpiral(startX, startY, step, existingNodes);
  if (spiralPosition) return spiralPosition;

  return { x: startX, y: startY + existingNodes.length * (ECORE_H + ECORE_GAP) };
}

/** How far, in flow units, a position may be off and still count as inside the circle. */
const CIRCLE_FIT_TOLERANCE = 0.5;

function fitsInCircle(position: { x: number; y: number }, circle: Circle): boolean {
  const clamped = clampToCircle(position, circle);
  return Math.abs(clamped.x - position.x) <= CIRCLE_FIT_TOLERANCE
    && Math.abs(clamped.y - position.y) <= CIRCLE_FIT_TOLERANCE;
}

/**
 * A free position for a new box that lies inside the VSUM circle (with the size the circle checks
 * boxes with), as close to `preferred` as possible; the circle's centre if there is no preferred
 * position. `null` if the circle has no free place, so that the caller falls back to
 * {@link findFreeEcorePosition} and the circle grows.
 */
export function findFreeEcorePositionInCircle(
  existingNodes: { position: { x: number; y: number } }[],
  circle: Circle,
  preferred?: { x: number; y: number },
): { x: number; y: number } | null {
  // Without a preferred position, the box (280×180, as the circle checks it) is centred in the circle.
  const start = clampToCircle(preferred ?? { x: circle.cx - 140, y: circle.cy - 90 }, circle);
  const isUsable = (x: number, y: number) =>
    fitsInCircle({ x, y }, circle) && isEcorePositionFree(x, y, existingNodes);
  if (isUsable(start.x, start.y)) return { x: start.x, y: start.y };

  const step = ECORE_W + ECORE_GAP;
  for (let ring = 1; ring * step <= 2 * circle.r; ring++) {
    const candidate = ringCandidates(start, ring, step).find(({ x, y }) => isUsable(x, y));
    if (candidate) return candidate;
  }
  return null;
}

/**
 * The positions on the square ring `ring` steps away from `start`, in search order
 * (column by column from left to right, top to bottom within each column).
 */
function ringCandidates(
  start: { x: number; y: number },
  ring: number,
  step: number,
): { x: number; y: number }[] {
  const candidates: { x: number; y: number }[] = [];
  for (let dx = -ring; dx <= ring; dx++) {
    for (let dy = -ring; dy <= ring; dy++) {
      if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
      candidates.push({ x: start.x + dx * step, y: start.y + dy * step });
    }
  }
  return candidates;
}
