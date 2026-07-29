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
  loadUmlViewport,
  saveUmlLayout,
  type UmlViewport,
} from '../utils/umlLayoutStorage';

const MAX_ZOOM = 3;
const MIN_ZOOM = 0.35;
const TOOLBAR_ZOOM_FACTOR = 1.3;
const WHEEL_ZOOM_FACTOR = 0.88;
const FIT_VIEW_PADDING = 48;
const INITIAL_FIT_DELAY_MS = 120;
const CLASS_POSITION_SAVE_DELAY_MS = 250;
const LAYOUT_SAVE_DEBOUNCE_MS = 300;

export interface UseUmlDiagramViewportOptions {
  classes: UmlDiagramClass[];
  allClasses: UmlDiagramClass[];
  diagramIdentity: string;
  fileName?: string;
  layoutScopeId: string;
  onBeforePan: () => void;
  isPanBlocked: () => boolean;
  isPanTarget: (target: EventTarget | null) => boolean;
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
  persistLayout: (classesOverride?: UmlDiagramClass[]) => void;
  scheduleLayoutSave: () => void;
  scheduleDebouncedLayoutSave: () => void;
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
    saveUmlLayout(
      layoutScopeId,
      fileName,
      buildUmlLayoutPayload(classesToPersist, getCurrentViewport()),
    );
  }, [fileName, getCurrentViewport, layoutScopeId]);

  const scheduleLayoutSave = useCallback(() => {
    if (!fileName) return;
    persistLayout();
  }, [fileName, persistLayout]);

  const scheduleDebouncedLayoutSave = useCallback(() => {
    if (!fileName) return;
    if (layoutSaveTimerRef.current) clearTimeout(layoutSaveTimerRef.current);
    layoutSaveTimerRef.current = setTimeout(() => {
      layoutSaveTimerRef.current = null;
      persistLayout();
    }, LAYOUT_SAVE_DEBOUNCE_MS);
  }, [fileName, persistLayout]);

  const restoreViewport = useCallback((viewport?: UmlViewport | null): boolean => {
    const saved = viewport === undefined
      ? (fileName ? loadUmlViewport(layoutScopeId, fileName) : null)
      : viewport;
    if (!saved) return false;
    applyViewport(saved);
    return true;
  }, [applyViewport, fileName, layoutScopeId]);

  useEffect(() => {
    didInitialFitRef.current = false;
    layoutOffsetRef.current = null;
  }, [diagramIdentity, fileName, layoutScopeId]);

  useEffect(() => {
    restoreViewport();
  }, [diagramIdentity, fileName, layoutScopeId, restoreViewport]);

  useEffect(() => {
    if (!fileName) return;
    const timer = setTimeout(persistLayout, CLASS_POSITION_SAVE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      persistLayout();
    };
  }, [classes, fileName, layoutScopeId, persistLayout]);

  useEffect(() => {
    if (!fileName) return;
    return () => {
      if (layoutSaveTimerRef.current) {
        clearTimeout(layoutSaveTimerRef.current);
        layoutSaveTimerRef.current = null;
      }
      persistLayout();
    };
  }, [fileName, layoutScopeId, persistLayout]);

  const layout = useMemo(() => {
    if (!layoutOffsetRef.current && allClasses.length > 0) {
      const initial = getUmlDiagramLayoutMetrics(allClasses);
      layoutOffsetRef.current = {
        offsetX: initial.offsetX,
        offsetY: initial.offsetY,
      };
      return initial;
    }
    return getUmlDiagramLayoutMetrics(allClasses, layoutOffsetRef.current);
  }, [allClasses]);

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
    scheduleDebouncedLayoutSave();
  }, [scheduleDebouncedLayoutSave]);

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
    scheduleDebouncedLayoutSave();
  }, [scheduleDebouncedLayoutSave]);

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
    scheduleLayoutSave();
  }, [allClasses.length, layout, scheduleLayoutSave]);

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

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const { x, y, scale } = viewRef.current;
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const factor = event.deltaY > 0
        ? WHEEL_ZOOM_FACTOR
        : 1 / WHEEL_ZOOM_FACTOR;
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
      scheduleDebouncedLayoutSave();
    };
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [scheduleDebouncedLayoutSave]);

  const handlePanStart = useCallback((event: MouseEvent) => {
    onBeforePan();
    if (isPanBlocked()) return;
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
      scheduleLayoutSave();
      cleanup();
    };
    panCleanupRef.current = cleanup;
    globalThis.addEventListener('mousemove', handleMove);
    globalThis.addEventListener('mouseup', handleUp);
  }, [isPanBlocked, isPanTarget, onBeforePan, scheduleLayoutSave]);

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
    scheduleLayoutSave,
    scheduleDebouncedLayoutSave,
    getCurrentViewport,
    restoreViewport,
    restoreViewportAfterReload,
    getCurrentLayoutOffset,
  };
}
