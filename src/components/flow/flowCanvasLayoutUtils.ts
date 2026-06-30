// EcoreFileBox collision helpers — shared by layout and drag clamping.
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
