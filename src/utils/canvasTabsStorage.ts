import type { OpenCanvasTab } from '../types/canvasTab';

/**
 * The open project tabs of the canvas, kept in sessionStorage so they survive a
 * page refresh. Only the tab list is stored: each tab loads its saved state
 * from the server when it is opened. Stored per user, so another account
 * signing in in the same browser tab does not get these tabs.
 */
const OPEN_CANVAS_TABS_STORAGE_PREFIX = 'vitruv.openCanvasTabs';

export interface StoredCanvasTab {
  projectId: number;
  name: string;
}

export const openCanvasTabsStorageKey = (userKey: string): string =>
  `${OPEN_CANVAS_TABS_STORAGE_PREFIX}.${userKey}`;

const isStoredCanvasTab = (value: unknown): value is StoredCanvasTab => {
  const tab = value as Partial<StoredCanvasTab> | null;
  return typeof tab?.projectId === 'number'
    && Number.isFinite(tab.projectId)
    && typeof tab.name === 'string';
};

export const readStoredCanvasTabs = (userKey?: string | null): StoredCanvasTab[] => {
  if (!userKey) return [];
  try {
    const raw = sessionStorage.getItem(openCanvasTabsStorageKey(userKey));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isStoredCanvasTab) : [];
  } catch {
    return [];
  }
};

export const writeStoredCanvasTabs = (
  userKey: string | null | undefined,
  tabs: readonly OpenCanvasTab[],
): void => {
  if (!userKey) return;
  const stored: StoredCanvasTab[] = tabs.map(({ projectId, name }) => ({ projectId, name }));
  try {
    sessionStorage.setItem(openCanvasTabsStorageKey(userKey), JSON.stringify(stored));
  } catch {
    return;
  }
};

export const clearStoredCanvasTabs = (userKey?: string | null): void => {
  if (!userKey) return;
  try {
    sessionStorage.removeItem(openCanvasTabsStorageKey(userKey));
  } catch {
    return;
  }
};
