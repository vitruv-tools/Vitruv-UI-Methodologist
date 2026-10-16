import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { isAdditiveSelectionEvent } from '../components/canvas/umlClassSelection';

/** Below this distance a press on the canvas counts as a click, not a box. */
const SELECTION_BOX_DRAG_THRESHOLD_PX = 3;

export interface UmlSelectionRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface UmlSelectableClassRect extends UmlSelectionRect {
  id: string;
}

/** Selection box in pixels, relative to the canvas container. */
export interface UmlSelectionBoxOverlay {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface UseUmlSelectionBoxOptions {
  containerRef: RefObject<HTMLElement | null>;
  /** False in read-only and connect mode; a drag then pans instead. */
  enabled: boolean;
  /** Re-attaches the listener once the canvas element exists. */
  classCount: number;
  isStartTarget: (target: EventTarget | null) => boolean;
  /** Converts screen coordinates to the coordinates the class rects use. */
  clientToDiagram: (clientX: number, clientY: number) => { x: number; y: number };
  getClassRects: () => UmlSelectableClassRect[];
  getSelectedClassIds: () => string[];
  /** Called on press; `additive` is true for Shift/Cmd+drag. */
  onStart: (additive: boolean) => void;
  onSelectionChange: (classIds: string[]) => void;
}

export function rectsIntersect(a: UmlSelectionRect, b: UmlSelectionRect): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

/** Classes touched by the box, added to the selection the drag started with. */
export function getSelectionBoxClassIds(
  box: UmlSelectionRect,
  classRects: UmlSelectableClassRect[],
  baseSelection: string[],
): string[] {
  const hitIds = classRects
    .filter(classRect => rectsIntersect(box, classRect))
    .map(classRect => classRect.id);
  return [...baseSelection, ...hitIds.filter(id => !baseSelection.includes(id))];
}

/**
 * Press and drag on the empty canvas draws a selection box; every class it
 * touches is selected while dragging. Shift/Cmd+drag adds to the selection.
 */
export function useUmlSelectionBox({
  containerRef,
  enabled,
  classCount,
  isStartTarget,
  clientToDiagram,
  getClassRects,
  getSelectedClassIds,
  onStart,
  onSelectionChange,
}: UseUmlSelectionBoxOptions): { selectionBox: UmlSelectionBoxOverlay | null } {
  const [selectionBox, setSelectionBox] = useState<UmlSelectionBoxOverlay | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!enabled || event.button !== 0) return;
    if (!isStartTarget(event.target)) return;
    const element = containerRef.current;
    if (!element) return;
    event.preventDefault();

    const additive = isAdditiveSelectionEvent(event);
    const baseSelection = additive ? getSelectedClassIds() : [];
    onStart(additive);

    const startX = event.clientX;
    const startY = event.clientY;
    let dragging = false;

    const handleMove = (moveEvent: MouseEvent) => {
      const { clientX, clientY } = moveEvent;
      if (
        !dragging
        && Math.abs(clientX - startX) <= SELECTION_BOX_DRAG_THRESHOLD_PX
        && Math.abs(clientY - startY) <= SELECTION_BOX_DRAG_THRESHOLD_PX
      ) {
        return;
      }
      dragging = true;
      const containerRect = element.getBoundingClientRect();
      setSelectionBox({
        left: Math.min(startX, clientX) - containerRect.left,
        top: Math.min(startY, clientY) - containerRect.top,
        width: Math.abs(clientX - startX),
        height: Math.abs(clientY - startY),
      });
      const start = clientToDiagram(startX, startY);
      const current = clientToDiagram(clientX, clientY);
      const box = {
        left: Math.min(start.x, current.x),
        top: Math.min(start.y, current.y),
        right: Math.max(start.x, current.x),
        bottom: Math.max(start.y, current.y),
      };
      onSelectionChange(getSelectionBoxClassIds(box, getClassRects(), baseSelection));
    };

    const cleanup = () => {
      globalThis.removeEventListener('mousemove', handleMove);
      globalThis.removeEventListener('mouseup', handleUp);
      if (cleanupRef.current === cleanup) cleanupRef.current = null;
    };
    const handleUp = () => {
      setSelectionBox(null);
      cleanup();
    };

    cleanupRef.current?.();
    cleanupRef.current = cleanup;
    globalThis.addEventListener('mousemove', handleMove);
    globalThis.addEventListener('mouseup', handleUp);
  }, [
    clientToDiagram,
    containerRef,
    enabled,
    getClassRects,
    getSelectedClassIds,
    isStartTarget,
    onSelectionChange,
    onStart,
  ]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    element.addEventListener('mousedown', handleMouseDown);
    return () => element.removeEventListener('mousedown', handleMouseDown);
  }, [classCount, containerRef, handleMouseDown]);

  useEffect(() => () => {
    cleanupRef.current?.();
  }, []);

  return { selectionBox };
}
