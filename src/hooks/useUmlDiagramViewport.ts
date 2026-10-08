import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  getUmlDiagramLayoutMetrics,
  UML_DIAGRAM_CANVAS_PADDING,
  type UmlDiagramLayoutMetrics,
} from '../components/canvas/umlDiagramLayoutGeometry';
import type { UmlDiagramClass } from '../components/canvas/umlDiagramTypes';
import {
  buildUmlLayoutPayload,
  hasSavedUmlLayout,
  loadUmlLayoutOffset,
  loadUmlViewport,
  saveUmlLayout,
  saveUmlViewport,
  type UmlViewport,
} from '../utils/umlLayoutStorage';

const MAX_ZOOM = 3;
const MIN_ZOOM = 0.35;
const TOOLBAR_ZOOM_FACTOR = 1.3;
/** Zoom change per wheel pixel; a trackpad pinch sends many small deltas. */
const WHEEL_ZOOM_SENSITIVITY = 0.01;
/** Caps one mouse-wheel notch to roughly the previous 12% zoom step. */
const MAX_WHEEL_ZOOM_DELTA = 12;
const WHEEL_LINE_HEIGHT_PX = 16;
const FIT_VIEW_PADDING = 48;
const INITIAL_FIT_DELAY_MS = 120;
const LAYOUT_SAVE_DEBOUNCE_MS = 300;

export interface UseUmlDiagramViewportOptions {
  classes: UmlDiagramClass[];
  allClasses: UmlDiagramClass[];
  diagramIdentity: string;
  fileName?: string;
  layoutScopeId: string;
  onBeforePan: () => void;
  /** Return true when this mouse-down should not pan (e.g. it starts a selection box). */
  isPanBlocked: (event: MouseEvent) => boolean;
  isPanTarget: (target: EventTarget | null) => boolean;
  /** Return false for areas that scroll themselves (e.g. edit panels). Defaults to everywhere. */
  isWheelTarget?: (target: EventTarget | null) => boolean;
}

/** Wheel delta in pixels; Shift+wheel on a mouse scrolls horizontally. */
function getWheelDeltaPx(
  event: WheelEvent,
  pageHeight: number,
): { deltaX: number; deltaY: number } {
  let unit = 1;
  if (event.deltaMode === 1) unit = WHEEL_LINE_HEIGHT_PX;
  else if (event.deltaMode === 2) unit = pageHeight;
  const deltaX = event.deltaX * unit;
  const deltaY = event.deltaY * unit;
  if (event.shiftKey && deltaX === 0) return { deltaX: deltaY, deltaY: 0 };
  return { deltaX, deltaY };
}

export interface UseUmlDiagramViewportResult {
  containerRef: RefObject<HTMLElement | null>;
  vx: number;
  vy: number;
  vscale: number;
  panning: boolean;
  layout: UmlDiagramLayoutMetrics;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToView: () => void;
  clientToDiagram: (clientX: number, clientY: number) => { x: number; y: number };
  handleMinimapPan: (x: number, y: number) => void;
  /** Save class positions together with the viewport (only on explicit save). */
  persistLayout: (classesOverride?: UmlDiagramClass[]) => void;
  /** Save pan/zoom only; class positions stay as last saved. */
  persistViewport: () => void;
  scheduleViewportSave: () => void;
  scheduleDebouncedViewportSave: () => void;
  getCurrentViewport: () => UmlViewport;
  restoreViewport: (viewport?: UmlViewport | null) => boolean;
  restoreViewportAfterReload: () => void;
  getCurrentLayoutOffset: () => { offsetX: number; offsetY: number };
}

export function useUmlDiagramViewport({
  classes,
  allClasses,
  diagramIdentity,
  fileName,
  layoutScopeId,
  onBeforePan,
  isPanBlocked,
  isPanTarget,
  isWheelTarget,
}: UseUmlDiagramViewportOptions): UseUmlDiagramViewportResult {
  const [vx, setVx] = useState(0);
  const [vy, setVy] = useState(0);
  const [vscale, setVscale] = useState(1);
  const [panning, setPanning] = useState(false);
  const containerRef = useRef<HTMLElement>(null);
  const viewRef = useRef<UmlViewport>({ x: 0, y: 0, scale: 1 });
  const classesRef = useRef(classes);
  const didInitialFitRef = useRef(false);
  const layoutOffsetRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const layoutSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadViewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panCleanupRef = useRef<(() => void) | null>(null);
  const fitToViewRef = useRef<() => void>(() => {});

  classesRef.current = classes;

  const getCurrentViewport = useCallback((): UmlViewport => ({
    x: viewRef.current.x,
    y: viewRef.current.y,
    scale: viewRef.current.scale,
  }), []);

  const applyViewport = useCallback((viewport: UmlViewport) => {
    viewRef.current = viewport;
    setVx(viewport.x);
    setVy(viewport.y);
    setVscale(viewport.scale);
  }, []);

  const persistLayout = useCallback((classesOverride?: UmlDiagramClass[]) => {
    const classesToPersist = classesOverride ?? classesRef.current;
    if (!fileName || classesToPersist.length === 0) return;
    const offset = layoutOffsetRef.current
      ?? loadUmlLayoutOffset(layoutScopeId, fileName);
    saveUmlLayout(
      layoutScopeId,
      fileName,
      buildUmlLayoutPayload(classesToPersist, getCurrentViewport(), offset),
    );
  }, [fileName, getCurrentViewport, layoutScopeId]);

  const persistViewport = useCallback(() => {
    if (!fileName) return;
    saveUmlViewport(
      layoutScopeId,
      fileName,
      getCurrentViewport(),
      layoutOffsetRef.current ?? loadUmlLayoutOffset(layoutScopeId, fileName),
    );
  }, [fileName, getCurrentViewport, layoutScopeId]);

  const scheduleViewportSave = useCallback(() => {
    if (!fileName) return;
    persistViewport();
  }, [fileName, persistViewport]);

  const scheduleDebouncedViewportSave = useCallback(() => {
    if (!fileName) return;
    if (layoutSaveTimerRef.current) clearTimeout(layoutSaveTimerRef.current);
    layoutSaveTimerRef.current = setTimeout(() => {
      layoutSaveTimerRef.current = null;
      persistViewport();
    }, LAYOUT_SAVE_DEBOUNCE_MS);
  }, [fileName, persistViewport]);

  const restoreViewport = useCallback((viewport?: UmlViewport | null): boolean => {
    let saved: UmlViewport | null;
    if (viewport === undefined) {
      saved = fileName ? loadUmlViewport(layoutScopeId, fileName) : null;
    } else {
      saved = viewport;
    }
    if (!saved) return false;
    applyViewport(saved);
    return true;
  }, [applyViewport, fileName, layoutScopeId]);

  const layoutIdentityRef = useRef({ diagramIdentity, fileName, layoutScopeId });

  useEffect(() => {
    // Only reset when the diagram changes; resetting on mount would drop the
    // offset computed during the first render.
    const previous = layoutIdentityRef.current;
    if (
      previous.diagramIdentity === diagramIdentity
      && previous.fileName === fileName
      && previous.layoutScopeId === layoutScopeId
    ) {
      return;
    }
    layoutIdentityRef.current = { diagramIdentity, fileName, layoutScopeId };
    didInitialFitRef.current = false;
    layoutOffsetRef.current = null;
  }, [diagramIdentity, fileName, layoutScopeId]);

  useEffect(() => {
    restoreViewport();
  }, [diagramIdentity, fileName, layoutScopeId, restoreViewport]);

  useEffect(() => {
    if (!fileName) return;
    return () => {
      if (layoutSaveTimerRef.current) {
        clearTimeout(layoutSaveTimerRef.current);
        layoutSaveTimerRef.current = null;
      }
      persistViewport();
    };
  }, [fileName, layoutScopeId, persistViewport]);

  const layout = useMemo(() => {
    if (!layoutOffsetRef.current && allClasses.length > 0) {
      // Reuse the offset the saved viewport was captured with; recomputing it
      // from the current class bounds would shift the restored diagram.
      const savedOffset = fileName
        ? loadUmlLayoutOffset(layoutScopeId, fileName)
        : null;
      if (savedOffset) {
        layoutOffsetRef.current = savedOffset;
        return getUmlDiagramLayoutMetrics(allClasses, savedOffset);
      }
      const initial = getUmlDiagramLayoutMetrics(allClasses);
      layoutOffsetRef.current = {
        offsetX: initial.offsetX,
        offsetY: initial.offsetY,
      };
      return initial;
    }
    return getUmlDiagramLayoutMetrics(allClasses, layoutOffsetRef.current);
  }, [allClasses, fileName, layoutScopeId]);

  const getCurrentLayoutOffset = useCallback(() => (
    layoutOffsetRef.current ?? {
      offsetX: UML_DIAGRAM_CANVAS_PADDING,
      offsetY: UML_DIAGRAM_CANVAS_PADDING,
    }
  ), []);

  const handleMinimapPan = useCallback((nextX: number, nextY: number) => {
    viewRef.current = { ...viewRef.current, x: nextX, y: nextY };
    setVx(nextX);
    setVy(nextY);
    scheduleDebouncedViewportSave();
  }, [scheduleDebouncedViewportSave]);

  const applyZoom = useCallback((factor: number) => {
    const element = containerRef.current;
    if (!element) return;
    const { x, y, scale } = viewRef.current;
    const centerX = element.clientWidth / 2;
    const centerY = element.clientHeight / 2;
    const nextScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale * factor));
    const ratio = nextScale / scale;
    const nextX = centerX - ratio * (centerX - x);
    const nextY = centerY - ratio * (centerY - y);
    viewRef.current = { x: nextX, y: nextY, scale: nextScale };
    setVx(nextX);
    setVy(nextY);
    setVscale(nextScale);
    scheduleDebouncedViewportSave();
  }, [scheduleDebouncedViewportSave]);

  const zoomIn = useCallback(() => {
    applyZoom(TOOLBAR_ZOOM_FACTOR);
  }, [applyZoom]);

  const zoomOut = useCallback(() => {
    applyZoom(1 / TOOLBAR_ZOOM_FACTOR);
  }, [applyZoom]);

  const fitToView = useCallback(() => {
    const element = containerRef.current;
    if (!element || allClasses.length === 0) return;
    const focus = {
      minX: layout.minX - FIT_VIEW_PADDING,
      minY: layout.minY - FIT_VIEW_PADDING,
      maxX: layout.maxX + FIT_VIEW_PADDING,
      maxY: layout.maxY + FIT_VIEW_PADDING,
    };
    const contentWidth = focus.maxX - focus.minX;
    const contentHeight = focus.maxY - focus.minY;
    const { clientWidth, clientHeight } = element;
    const scale = Math.min(
      (clientWidth - FIT_VIEW_PADDING * 2) / Math.max(contentWidth, 1),
      (clientHeight - FIT_VIEW_PADDING * 2) / Math.max(contentHeight, 1),
      1.15,
    );
    const displayedMinX = focus.minX + layout.offsetX;
    const displayedMinY = focus.minY + layout.offsetY;
    const nextX = (clientWidth - contentWidth * scale) / 2
      - displayedMinX * scale;
    const nextY = (clientHeight - contentHeight * scale) / 2
      - displayedMinY * scale;
    viewRef.current = { x: nextX, y: nextY, scale };
    setVx(nextX);
    setVy(nextY);
    setVscale(scale);
    scheduleViewportSave();
  }, [allClasses.length, layout, scheduleViewportSave]);

  fitToViewRef.current = fitToView;

  useEffect(() => {
    if (didInitialFitRef.current || classes.length === 0) return;
    const timer = setTimeout(() => {
      const hasSaved = fileName
        ? hasSavedUmlLayout(layoutScopeId, fileName)
        : false;
      if (!hasSaved) fitToViewRef.current();
      didInitialFitRef.current = true;
    }, INITIAL_FIT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [classes.length, fileName, layoutScopeId]);

  useEffect(() => {
    viewRef.current = { x: vx, y: vy, scale: vscale };
  }, [vx, vy, vscale]);

  // Two-finger scroll / mouse wheel pans; pinch (sent as Ctrl+wheel) and
  // Cmd/Ctrl+wheel zoom around the pointer, like Figma.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      if (isWheelTarget && !isWheelTarget(event.target)) return;
      event.preventDefault();
      const { deltaX, deltaY } = getWheelDeltaPx(event, element.clientHeight);
      const { x, y, scale } = viewRef.current;
      if (!event.ctrlKey && !event.metaKey) {
        const nextX = x - deltaX;
        const nextY = y - deltaY;
        viewRef.current = { x: nextX, y: nextY, scale };
        setVx(nextX);
        setVy(nextY);
        scheduleDebouncedViewportSave();
        return;
      }
      const rect = element.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const zoomDelta = Math.max(
        -MAX_WHEEL_ZOOM_DELTA,
        Math.min(MAX_WHEEL_ZOOM_DELTA, deltaY),
      );
      const factor = Math.exp(-zoomDelta * WHEEL_ZOOM_SENSITIVITY);
      const nextScale = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, scale * factor),
      );
      const ratio = nextScale / scale;
      const nextX = mouseX - ratio * (mouseX - x);
      const nextY = mouseY - ratio * (mouseY - y);
      viewRef.current = { x: nextX, y: nextY, scale: nextScale };
      setVscale(nextScale);
      setVx(nextX);
      setVy(nextY);
      scheduleDebouncedViewportSave();
    };
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
    // classes.length: the canvas element only exists once the diagram has
    // classes, so the listener is attached again when it appears.
  }, [classes.length, isWheelTarget, scheduleDebouncedViewportSave]);

  const handlePanStart = useCallback((event: MouseEvent) => {
    onBeforePan();
    if (isPanBlocked(event)) return;
    if (!isPanTarget(event.target)) return;
    event.preventDefault();
    setPanning(true);
    const { x, y } = viewRef.current;
    const startX = event.clientX;
    const startY = event.clientY;
    const handleMove = (moveEvent: MouseEvent) => {
      const nextX = x + moveEvent.clientX - startX;
      const nextY = y + moveEvent.clientY - startY;
      viewRef.current = { ...viewRef.current, x: nextX, y: nextY };
      setVx(nextX);
      setVy(nextY);
    };
    const cleanup = () => {
      globalThis.removeEventListener('mousemove', handleMove);
      globalThis.removeEventListener('mouseup', handleUp);
      if (panCleanupRef.current === cleanup) {
        panCleanupRef.current = null;
      }
    };
    const handleUp = () => {
      setPanning(false);
      scheduleViewportSave();
      cleanup();
    };
    panCleanupRef.current = cleanup;
    globalThis.addEventListener('mousemove', handleMove);
    globalThis.addEventListener('mouseup', handleUp);
  }, [isPanBlocked, isPanTarget, onBeforePan, scheduleViewportSave]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    element.addEventListener('mousedown', handlePanStart);
    return () => element.removeEventListener('mousedown', handlePanStart);
  }, [classes.length, handlePanStart]);

  const clientToDiagram = useCallback((clientX: number, clientY: number) => {
    const element = containerRef.current;
    if (!element) return { x: 0, y: 0 };
    const rect = element.getBoundingClientRect();
    const { x, y, scale } = viewRef.current;
    return {
      x: (clientX - rect.left - x) / scale,
      y: (clientY - rect.top - y) / scale,
    };
  }, []);

  const restoreViewportAfterReload = useCallback(() => {
    if (reloadViewportTimerRef.current) {
      clearTimeout(reloadViewportTimerRef.current);
    }
    reloadViewportTimerRef.current = setTimeout(() => {
      reloadViewportTimerRef.current = null;
      if (!restoreViewport()) fitToViewRef.current();
    }, INITIAL_FIT_DELAY_MS);
  }, [restoreViewport]);

  useEffect(() => {
    return () => {
      panCleanupRef.current?.();
      if (reloadViewportTimerRef.current) {
        clearTimeout(reloadViewportTimerRef.current);
      }
    };
  }, []);

  return {
    containerRef,
    vx,
    vy,
    vscale,
    panning,
    layout,
    zoomIn,
    zoomOut,
    fitToView,
    clientToDiagram,
    handleMinimapPan,
    persistLayout,
    persistViewport,
    scheduleViewportSave,
    scheduleDebouncedViewportSave,
    getCurrentViewport,
    restoreViewport,
    restoreViewportAfterReload,
    getCurrentLayoutOffset,
  };
}
