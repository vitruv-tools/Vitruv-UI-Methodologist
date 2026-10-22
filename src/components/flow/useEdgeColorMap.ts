import { useCallback, useEffect, useRef } from 'react';
import { EDGE_COLOR_LIST } from './flowCanvasConstants';

/**
 * Colours are keyed by unordered node pair, so an edge keeps its colour no
 * matter which end it was drawn from.
 */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

/** Colour maps are per user *and* per project; anonymous callers share one key. */
export function getEdgeColorStorageKey(userId?: string, vsumId?: string): string {
  if (userId && vsumId) {
    return `flow_edge_color_map_v1_user_${userId}_vsum_${vsumId}`;
  }
  return 'flow_edge_color_map_v1';
}

/**
 * Resumes the palette after the highest-numbered colour already in use, so a
 * reloaded session keeps handing out fresh colours instead of repeating.
 */
export function resolveNextColorIndex(usedColors: Iterable<string>): number {
  const used = new Set(usedColors);
  let maxIndex = 0;
  EDGE_COLOR_LIST.forEach((color, i) => {
    if (used.has(color)) maxIndex = Math.max(maxIndex, i + 1);
  });
  return maxIndex % EDGE_COLOR_LIST.length;
}

/**
 * Assigns and persists a stable colour per connected metamodel pair.
 *
 * The map lives in a ref rather than state: colours are read during render of
 * edges that were just created, and a re-render on assignment would be both
 * unnecessary and a source of loops.
 */
export function useEdgeColorMap(userId?: string, vsumId?: string) {
  const storageKey = getEdgeColorStorageKey(userId, vsumId);
  const edgeColorMapRef = useRef<Map<string, string>>(new Map());
  const nextColorIndexRef = useRef<number>(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        edgeColorMapRef.current = new Map(Object.entries(parsed));
        nextColorIndexRef.current = resolveNextColorIndex(Object.values(parsed));
        return;
      }
      edgeColorMapRef.current = new Map();
      nextColorIndexRef.current = 0;
    } catch (e) {
      console.warn('Failed to load edge color map', e);
      edgeColorMapRef.current = new Map();
      nextColorIndexRef.current = 0;
    }
  }, [storageKey]);

  const persistEdgeColorMap = useCallback(() => {
    try {
      const obj: Record<string, string> = {};
      edgeColorMapRef.current.forEach((v, k) => {
        obj[k] = v;
      });
      localStorage.setItem(storageKey, JSON.stringify(obj));
    } catch (e) {
      console.error('Failed to persist edge color map', e);
    }
  }, [storageKey]);

  const getColorForPair = useCallback((idA: string, idB: string): string => {
    const key = pairKey(idA, idB);
    const existing = edgeColorMapRef.current.get(key);
    if (existing) return existing;

    const color = EDGE_COLOR_LIST[nextColorIndexRef.current % EDGE_COLOR_LIST.length];
    edgeColorMapRef.current.set(key, color);
    nextColorIndexRef.current += 1;
    persistEdgeColorMap();
    return color;
  }, [persistEdgeColorMap]);

  return { getColorForPair };
}
