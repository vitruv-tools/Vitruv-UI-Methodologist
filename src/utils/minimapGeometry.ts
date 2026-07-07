/**
 * Point where the ray from the map center toward (sx,sy) crosses the map
 * border, or null if (sx,sy) is already inside. Used by minimap overlays
 * (FlowCanvas's CustomMinimap, UMLDiagramMinimap) to draw off-screen
 * indicators for items outside the visible map area.
 */
export function edgeIndicatorPos(
  sx: number, sy: number, w: number, h: number, margin = 9,
): { x: number; y: number } | null {
  const M = margin;
  if (sx >= M && sx <= w - M && sy >= M && sy <= h - M) return null;
  const cx = w / 2, cy = h / 2;
  const dx = sx - cx, dy = sy - cy;
  if (dx === 0 && dy === 0) return null;
  let t = Infinity;
  if (dx > 0) t = Math.min(t, (w - M - cx) / dx);
  if (dx < 0) t = Math.min(t, (M - cx) / dx);
  if (dy > 0) t = Math.min(t, (h - M - cy) / dy);
  if (dy < 0) t = Math.min(t, (M - cy) / dy);
  if (!Number.isFinite(t) || t <= 0) return null;
  return {
    x: Math.max(M, Math.min(w - M, cx + dx * t)),
    y: Math.max(M, Math.min(h - M, cy + dy * t)),
  };
}
