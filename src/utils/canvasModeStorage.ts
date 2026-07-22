import type { CanvasMode } from '../components/flow/FlowCanvas';

export const DEFAULT_CANVAS_MODE: CanvasMode = 'modeling';

const CANVAS_MODE_STORAGE_PREFIX = 'vitruv.canvasMode';

const isFiniteProjectId = (projectId?: number | null): projectId is number =>
  typeof projectId === 'number' && Number.isFinite(projectId);

export const canvasModeStorageKey = (projectId: number): string =>
  `${CANVAS_MODE_STORAGE_PREFIX}.${projectId}`;

export const isCanvasMode = (value: unknown): value is CanvasMode =>
  value === 'modeling' || value === 'constraints' || value === 'views';

export const readStoredCanvasMode = (projectId?: number | null): CanvasMode => {
  if (!isFiniteProjectId(projectId)) return DEFAULT_CANVAS_MODE;
  try {
    const storedValue = localStorage.getItem(canvasModeStorageKey(projectId));
    return isCanvasMode(storedValue) ? storedValue : DEFAULT_CANVAS_MODE;
  } catch {
    return DEFAULT_CANVAS_MODE;
  }
};

export const writeStoredCanvasMode = (projectId: number | undefined | null, mode: CanvasMode): void => {
  if (!isFiniteProjectId(projectId)) return;
  try {
    localStorage.setItem(canvasModeStorageKey(projectId), mode);
  } catch {
    return;
  }
};
