import React, { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { ecoreToUml, UMLAttribute, UMLRelationship } from '../../utils/ecoreToUml';
import {
  applyLayoutToUmlClasses,
  buildUmlLayoutPayload,
  hasSavedUmlLayout,
  loadUmlViewport,
  saveUmlLayout,
  type UmlViewport,
} from '../../utils/umlLayoutStorage';
import { assignParallelRelMeta, computeUmlFocusRect } from '../../utils/umlClassLayout';
import {
  bridgedLinePathD,
  computeLineBridges,
  optimizeMultiplicityBadges,
  type LineBridge,
  type MultiplicityBadge,
} from '../../utils/umlDiagramGeometry';
import { UMLDiagramMinimap } from './UMLDiagramMinimap';

// ── constants ────────────────────────────────────────────────────────────────

const BW = 190;         // box width
const CANVAS_PAD = 480; // free space around diagram (all sides; allows negative coords)
const MIN_READABLE_ZOOM = 0.55;
const MAX_ZOOM = 3;
const MIN_ZOOM = 0.35;
const NAME_H = 36;      // name-section height (no stereotype)
const STEREO_H = 54;    // name-section height (with stereotype)
const ATTR_ROW = 22;    // height per attribute row
const ATTR_PAD = 10;    // top+bottom padding inside attr section
const ADD_BTN_H = 22;   // "+ Add attribute" row
const METH_H = 26;      // empty methods section

/** Dotted workspace background — matches canvas / HomePage grid */
export const WORKSPACE_DOT_BACKGROUND: React.CSSProperties = {
  backgroundColor: '#f3f4f6',
  backgroundImage: 'radial-gradient(circle, #d1d5db 0.75px, transparent 0.75px)',
  backgroundSize: '24px 24px',
};

// ── helpers ──────────────────────────────────────────────────────────────────

function boxH(c: CLS): number {
  const nh = c.isAbstract || c.isInterface ? STEREO_H : NAME_H;
  const ah = c.attributes.length * ATTR_ROW + ATTR_PAD + ADD_BTN_H;
  return nh + 1 + ah + 1 + METH_H;
}

function getLayoutMetrics(
  classes: CLS[],
  frozenOffset?: { offsetX: number; offsetY: number } | null,
) {
  if (classes.length === 0) {
    return {
      totalW: 1200,
      totalH: 900,
      offsetX: CANVAS_PAD,
      offsetY: CANVAS_PAD,
      minX: 0,
      minY: 0,
      maxX: 700,
      maxY: 400,
    };
  }
  const minX = Math.min(...classes.map(c => c.x));
  const minY = Math.min(...classes.map(c => c.y));
  const maxX = Math.max(...classes.map(c => c.x + BW));
  const maxY = Math.max(...classes.map(c => c.y + boxH(c)));
  const offsetX = frozenOffset?.offsetX ?? CANVAS_PAD - minX;
  const offsetY = frozenOffset?.offsetY ?? CANVAS_PAD - minY;
  const dispMinX = minX + offsetX;
  const dispMinY = minY + offsetY;
  const dispMaxX = maxX + offsetX;
  const dispMaxY = maxY + offsetY;
  return {
    totalW: Math.max(dispMaxX + CANVAS_PAD, dispMaxX - dispMinX + CANVAS_PAD * 2),
    totalH: Math.max(dispMaxY + CANVAS_PAD, dispMaxY - dispMinY + CANVAS_PAD * 2),
    offsetX,
    offsetY,
    minX,
    minY,
    maxX,
    maxY,
  };
}

function edgePt(bx: number, by: number, h: number, tx: number, ty: number) {
  const cx = bx + BW / 2, cy = by + h / 2;
  const dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const hw = BW / 2, hh = h / 2;
  const t = Math.abs(dx) * hh > Math.abs(dy) * hw ? hw / Math.abs(dx) : hh / Math.abs(dy);
  return { x: cx + dx * t, y: cy + dy * t };
}

// ── types ────────────────────────────────────────────────────────────────────

interface CLS {
  id: string;
  name: string;
  isAbstract: boolean;
  isInterface: boolean;
  attributes: UMLAttribute[];
  x: number;
  y: number;
}

type DiagramRel = UMLRelationship & { parallelIndex?: number; parallelCount?: number };

const EDGE_DEFAULT = '#0c436e';
const EDGE_HOVER = '#f87171';
const EDGE_SELECT = '#ef4444';
const EDGE_ENDPOINT_INSET = 10;
const MULT_ALONG_OFFSET = 44;
const MULT_PERP_OFFSET = 10;
const MARKER_MULT_EXTRA_OFFSET = 16;

function multiplicityPosition(
  x1: number, y1: number, x2: number, y2: number,
  end: 'start' | 'end',
  hasDirectionMarker = false,
): { x: number; y: number; anchorX: number; anchorY: number; lineUx: number; lineUy: number; nx: number; ny: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(Math.hypot(dx, dy), 0.0001);
  const lineUx = dx / len;
  const lineUy = dy / len;
  const nx = -lineUy;
  const ny = lineUx;
  const alongMag = MULT_ALONG_OFFSET + (hasDirectionMarker ? MARKER_MULT_EXTRA_OFFSET : 0);
  const along = end === 'start' ? alongMag : -alongMag;
  const anchorX = end === 'start' ? x1 : x2;
  const anchorY = end === 'start' ? y1 : y2;
  return {
    anchorX,
    anchorY,
    lineUx,
    lineUy,
    nx,
    ny,
    x: anchorX + lineUx * along + nx * MULT_PERP_OFFSET,
    y: anchorY + lineUy * along + ny * MULT_PERP_OFFSET,
  };
}

// ── relation-line helpers ─────────────────────────────────────────────────────

type EdgeState = 'default' | 'hovered' | 'selected';

function edgeState(isSelected: boolean, isHovered: boolean): EdgeState {
  if (isSelected) return 'selected';
  if (isHovered)  return 'hovered';
  return 'default';
}

const EDGE_COLOR: Record<EdgeState, string> = {
  default:  EDGE_DEFAULT,
  hovered:  EDGE_HOVER,
  selected: EDGE_SELECT,
};

const EDGE_WIDTH: Record<EdgeState, number> = {
  default: 1.5,
  hovered: 2.5,
  selected: 3,
};

type DirectionMarkerSide = 'start' | 'end';

function getDirectionMarkerSide(type: UMLRelationship['type']): DirectionMarkerSide | null {
  if (type === 'composition') return 'start';
  if (type === 'inheritance' || type === 'association') return 'end';
  return null;
}

function insetLineEndpoints(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.max(Math.hypot(dx, dy), 0.0001);
  const ux = dx / len;
  const uy = dy / len;
  const inset = Math.min(EDGE_ENDPOINT_INSET, Math.max(0, len / 2 - 8));
  return {
    drawP1: { x: p1.x + ux * inset, y: p1.y + uy * inset },
    drawP2: { x: p2.x - ux * inset, y: p2.y - uy * inset },
    ux,
    uy,
  };
}

function directionMarkerSvg(type: UMLRelationship['type'], color: string): React.ReactNode {
  if (type === 'association') {
    return <path d="M 0 0 L 12 6 L 0 12 z" fill={color} />;
  }
  if (type === 'inheritance') {
    return <path d="M 0 0 L 12 6 L 0 12 z" fill="#ffffff" stroke={color} strokeWidth="1.5" />;
  }
  if (type === 'composition') {
    return <path d="M 7 1 L 13 7 L 7 13 L 1 7 Z" fill={color} />;
  }
  return null;
}

function directionMarkerViewBox(type: UMLRelationship['type']): string {
  return type === 'composition' ? '0 0 14 14' : '0 0 12 12';
}

function directionMarkerSize(type: UMLRelationship['type']): number {
  return type === 'composition' ? 20 : 18;
}

function directionMarkerAnchor(
  anchor: { x: number; y: number },
): { x: number; y: number } {
  return anchor;
}

function getRelEndpoints(
  rel: DiagramRel,
  classes: CLS[],
  offsetX: number,
  offsetY: number,
) {
  const src = classes.find(c => c.id === rel.sourceId);
  const tgt = classes.find(c => c.id === rel.targetId);
  if (!src || !tgt) return null;

  const sh = boxH(src);
  const th = boxH(tgt);
  const sx = src.x + offsetX;
  const sy = src.y + offsetY;
  const tx = tgt.x + offsetX;
  const ty = tgt.y + offsetY;
  const rawP1 = edgePt(sx, sy, sh, tx + BW / 2, ty + th / 2);
  const rawP2 = edgePt(tx, ty, th, sx + BW / 2, sy + sh / 2);
  return applyParallelOffset(rawP1, rawP2, rel.parallelIndex ?? 0, rel.parallelCount ?? 1);
}

function applyParallelOffset(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  parallelIndex: number,
  parallelCount: number,
) {
  if (parallelCount <= 1) return { p1, p2 };
  const lineLen = Math.max(Math.hypot(p2.x - p1.x, p2.y - p1.y), 0.0001);
  const sep = 14;
  const off = (parallelIndex - (parallelCount - 1) / 2) * sep;
  const nx = -(p2.y - p1.y) / lineLen;
  const ny =  (p2.x - p1.x) / lineLen;
  return {
    p1: { x: p1.x + nx * off, y: p1.y + ny * off },
    p2: { x: p2.x + nx * off, y: p2.y + ny * off },
  };
}

// ── RelationLine ──────────────────────────────────────────────────────────────

interface RelationLineProps {
  rel: UMLRelationship;
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  drawP1: { x: number; y: number };
  drawP2: { x: number; y: number };
  bridges: LineBridge[];
  state: EdgeState;
  onRelClick: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const RelationLine: React.FC<RelationLineProps> = ({
  rel, p1, p2, drawP1, drawP2, bridges, state, onRelClick, onMouseEnter, onMouseLeave,
}) => {
  const strokeColor = EDGE_COLOR[state];
  const strokeWidth = EDGE_WIDTH[state];
  const haloPath = bridgedLinePathD(drawP1, drawP2, bridges);
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;

  return (
    <g data-rel-line style={{ cursor: 'pointer' }} onClick={onRelClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <path d={haloPath} fill="none" stroke="#ffffff" strokeWidth={strokeWidth + 4} strokeLinecap="round" strokeLinejoin="round" />
      <path d={haloPath} fill="none" stroke="transparent" strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
      <path d={haloPath} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {rel.label && (
        <text x={mx} y={my - 5} textAnchor="middle" fontSize="10" fill={strokeColor}
          stroke="#ffffff" strokeWidth={3} paintOrder="stroke fill"
          fontFamily="ui-sans-serif, system-ui, sans-serif" pointerEvents="none">
          {rel.label}
        </text>
      )}
    </g>
  );
};

const MultiplicityBadgeGraphic: React.FC<{
  badge: MultiplicityBadge;
  strokeColor: string;
}> = ({ badge, strokeColor }) => (
  <g data-mult-badge pointerEvents="none">
    <rect x={badge.x - 18} y={badge.y - 12} width={36} height={24} rx={4} fill="#ffffff" stroke={strokeColor} strokeWidth={1.5} />
    <text x={badge.x} y={badge.y + 4} textAnchor="middle" fontSize="13" fontWeight={700} fill={strokeColor} fontFamily="ui-monospace, Consolas, monospace">
      {badge.text}
    </text>
  </g>
);

interface RelationDirectionMarkerProps {
  rel: UMLRelationship;
  lineStart: { x: number; y: number };
  lineEnd: { x: number; y: number };
  color: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const RelationDirectionMarker: React.FC<RelationDirectionMarkerProps> = ({
  rel, lineStart, lineEnd, color, onMouseEnter, onMouseLeave,
}) => {
  const side = getDirectionMarkerSide(rel.type);
  const graphic = directionMarkerSvg(rel.type, color);
  if (!side || !graphic) return null;

  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lineAnchor = side === 'start' ? lineStart : lineEnd;
  const { x, y } = directionMarkerAnchor(lineAnchor);
  const rotation = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <div
      data-rel-direction-marker
      data-rel-id={rel.id}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        pointerEvents: 'auto',
        cursor: 'pointer',
        zIndex: 5,
        lineHeight: 0,
      }}
    >
      <svg
        width={directionMarkerSize(rel.type)}
        height={directionMarkerSize(rel.type)}
        viewBox={directionMarkerViewBox(rel.type)}
        overflow="visible"
        aria-hidden
      >
        {graphic}
      </svg>
    </div>
  );
};

type EditState =
  | { classId: string; kind: 'name'; val: string }
  | { classId: string; kind: 'attr'; attrId: string; name: string; type: string };

// ── UMLDiagram ────────────────────────────────────────────────────────────────

export interface UMLDiagramHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitToView: () => void;
  flushLayout: () => void;
}

interface UMLDiagramProps {
  ecoreContent: string;
  fileName?: string;
  layoutScopeId?: string;
}

export const UMLDiagram = forwardRef<UMLDiagramHandle, UMLDiagramProps>(({
  ecoreContent,
  fileName,
  layoutScopeId = 'default',
}, ref) => {
  const parsed = useMemo(() => ecoreToUml(ecoreContent), [ecoreContent]);
  const [classes, setClasses] = useState<CLS[]>(() =>
    fileName ? applyLayoutToUmlClasses(layoutScopeId, fileName, parsed.classes) : parsed.classes,
  );
  const rels = useMemo(
    () => assignParallelRelMeta(parsed.relationships) as DiagramRel[],
    [parsed.relationships],
  );
  const [edit, setEdit] = useState<EditState | null>(null);
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null);
  const [hoveredRelId, setHoveredRelId] = useState<string | null>(null);
  const classesRef = useRef(classes);
  classesRef.current = classes;

  // Re-apply saved layout when ecore content or file changes
  useEffect(() => {
    const base = fileName
      ? applyLayoutToUmlClasses(layoutScopeId, fileName, parsed.classes)
      : parsed.classes;
    setClasses(base);
  }, [ecoreContent, fileName, layoutScopeId, parsed.classes]);

  const diagramRef = useRef<UMLDiagramHandle>(null);
  const didInitialFit = useRef(false);
  const layoutOffsetRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    didInitialFit.current = false;
    layoutOffsetRef.current = null;
  }, [ecoreContent, fileName, layoutScopeId]);

  // ── viewport (pan + zoom) ──────────────────────────────────────────────────
  const [vx, setVx] = useState(0);
  const [vy, setVy] = useState(0);
  const [vscale, setVscale] = useState(1);
  const [panning, setPanning] = useState(false);
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });

  const persistLayout = useCallback(() => {
    if (!fileName || classesRef.current.length === 0) return;
    const viewport: UmlViewport = {
      x: viewRef.current.x,
      y: viewRef.current.y,
      scale: viewRef.current.scale,
    };
    saveUmlLayout(layoutScopeId, fileName, buildUmlLayoutPayload(classesRef.current, viewport));
  }, [fileName, layoutScopeId]);

  const scheduleLayoutSave = useCallback(() => {
    if (!fileName) return;
    persistLayout();
  }, [fileName, persistLayout]);

  const layoutSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleDebouncedLayoutSave = useCallback(() => {
    if (!fileName) return;
    if (layoutSaveTimerRef.current) clearTimeout(layoutSaveTimerRef.current);
    layoutSaveTimerRef.current = setTimeout(() => {
      layoutSaveTimerRef.current = null;
      persistLayout();
    }, 300);
  }, [fileName, persistLayout]);

  // Restore saved pan/zoom when reopening a diagram
  useEffect(() => {
    if (!fileName) return;
    const saved = loadUmlViewport(layoutScopeId, fileName);
    if (!saved) return;
    viewRef.current = saved;
    setVx(saved.x);
    setVy(saved.y);
    setVscale(saved.scale);
  }, [ecoreContent, fileName, layoutScopeId]);

  // Auto-save box positions while editing
  useEffect(() => {
    if (!fileName) return;
    const timer = setTimeout(persistLayout, 250);
    return () => clearTimeout(timer);
  }, [classes, fileName, layoutScopeId, persistLayout]);

  useEffect(() => {
    if (!fileName) return;
    return () => {
      if (layoutSaveTimerRef.current) clearTimeout(layoutSaveTimerRef.current);
      persistLayout();
    };
  }, [fileName, layoutScopeId, persistLayout]);

  // Fit once on first open only when no saved layout exists
  useEffect(() => {
    if (didInitialFit.current || classes.length === 0) return;
    const t = setTimeout(() => {
      const hasSaved = fileName ? hasSavedUmlLayout(layoutScopeId, fileName) : false;
      if (!hasSaved) diagramRef.current?.fitToView?.();
      didInitialFit.current = true;
    }, 120);
    return () => clearTimeout(t);
  }, [classes.length, fileName, layoutScopeId]);

  const layout = useMemo(() => {
    if (!layoutOffsetRef.current && classes.length > 0) {
      const initial = getLayoutMetrics(classes);
      layoutOffsetRef.current = { offsetX: initial.offsetX, offsetY: initial.offsetY };
      return initial;
    }
    return getLayoutMetrics(classes, layoutOffsetRef.current);
  }, [classes]);
  const { totalW, totalH, offsetX, offsetY } = layout;
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMinimapPan = useCallback((nx: number, ny: number) => {
    viewRef.current = { ...viewRef.current, x: nx, y: ny };
    setVx(nx);
    setVy(ny);
    scheduleDebouncedLayoutSave();
  }, [scheduleDebouncedLayoutSave]);

  const applyZoom = useCallback((factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const { x, y, scale } = viewRef.current;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    const ns = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale * factor));
    const ratio = ns / scale;
    const nx = cx - ratio * (cx - x);
    const ny = cy - ratio * (cy - y);
    viewRef.current = { x: nx, y: ny, scale: ns };
    setVx(nx); setVy(ny); setVscale(ns);
    scheduleDebouncedLayoutSave();
  }, [scheduleDebouncedLayoutSave]);

  // ── imperative zoom controls ───────────────────────────────────────────────
  useImperativeHandle(ref, () => {
    const handle: UMLDiagramHandle = {
    zoomIn: () => applyZoom(1.3),
    zoomOut: () => applyZoom(1 / 1.3),
    fitToView: () => {
      const el = containerRef.current;
      if (!el || classes.length === 0) return;
      const PAD = 48;
      const focus = computeUmlFocusRect(classes, {
        boxWidth: BW,
        boxHeight: c => boxH(c),
        padding: PAD,
      });
      const contentW = focus.maxX - focus.minX;
      const contentH = focus.maxY - focus.minY;
      const { clientWidth: cw, clientHeight: ch } = el;
      const fitScale = Math.min(
        (cw - PAD * 2) / Math.max(contentW, 1),
        (ch - PAD * 2) / Math.max(contentH, 1),
        1.15,
      );
      const scale = Math.max(MIN_READABLE_ZOOM, fitScale);
      const dispMinX = focus.minX + offsetX;
      const dispMinY = focus.minY + offsetY;
      const nx = (cw - contentW * scale) / 2 - dispMinX * scale;
      const ny = (ch - contentH * scale) / 2 - dispMinY * scale;
      viewRef.current = { x: nx, y: ny, scale };
      setVx(nx); setVy(ny); setVscale(scale);
      scheduleLayoutSave();
    },
    flushLayout: () => persistLayout(),
    };
    diagramRef.current = handle;
    return handle;
  }, [applyZoom, classes, offsetX, offsetY, persistLayout, scheduleLayoutSave]);

  useEffect(() => { viewRef.current = { x: vx, y: vy, scale: vscale }; }, [vx, vy, vscale]);

  // non-passive wheel so we can preventDefault and stop page scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const { x, y, scale } = viewRef.current;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.88 : 1 / 0.88;
      const ns = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale * factor));
      const ratio = ns / scale;
      const nx = mx - ratio * (mx - x);
      const ny = my - ratio * (my - y);
      viewRef.current = { x: nx, y: ny, scale: ns };
      setVscale(ns);
      setVx(nx);
      setVy(ny);
      scheduleDebouncedLayoutSave();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scheduleDebouncedLayoutSave]);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-classbox]')) return;
    if ((e.target as HTMLElement).closest('[data-rel-line]')) return;
    if ((e.target as HTMLElement).closest('[data-rel-direction-marker]')) return;
    e.preventDefault();
    setPanning(true);
    const { x, y } = viewRef.current;
    const sx = e.clientX, sy = e.clientY;
    const onMove = (ev: MouseEvent) => {
      const nx = x + ev.clientX - sx;
      const ny = y + ev.clientY - sy;
      viewRef.current = { ...viewRef.current, x: nx, y: ny };
      setVx(nx);
      setVy(ny);
    };
    const onUp = () => {
      setPanning(false);
      scheduleLayoutSave();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [scheduleLayoutSave]);

  const moveClass = useCallback((id: string, x: number, y: number) => {
    setClasses(prev => prev.map(c => (c.id === id ? { ...c, x, y } : c)));
  }, []);

  const saveName = useCallback((id: string, name: string) => {
    setClasses(prev => prev.map(c => c.id === id ? { ...c, name: name.trim() || c.name } : c));
    setEdit(null);
  }, []);

  const saveAttr = useCallback((classId: string, attrId: string, name: string, type: string) => {
    setClasses(prev => prev.map(c => {
      if (c.id !== classId) return c;
      return { ...c, attributes: c.attributes.map(a => a.id !== attrId ? a : { ...a, name: name.trim() || a.name, type: type.trim() || a.type }) };
    }));
    setEdit(null);
  }, []);

  const addAttr = useCallback((classId: string) => {
    const newAttr: UMLAttribute = { id: `${classId}-${Date.now()}`, name: 'attribute', type: 'String', visibility: '+' };
    setClasses(prev => prev.map(c => c.id !== classId ? c : { ...c, attributes: [...c.attributes, newAttr] }));
    setEdit({ classId, kind: 'attr', attrId: newAttr.id, name: newAttr.name, type: newAttr.type });
  }, []);

  const deleteAttr = useCallback((classId: string, attrId: string) => {
    setClasses(prev => prev.map(c => c.id !== classId ? c : { ...c, attributes: c.attributes.filter(a => a.id !== attrId) }));
  }, []);

  const edgeLayouts = useMemo(() => {
    const raw = rels.flatMap(rel => {
      const endpoints = getRelEndpoints(rel, classes, offsetX, offsetY);
      if (!endpoints) return [];
      const { drawP1, drawP2 } = insetLineEndpoints(endpoints.p1, endpoints.p2);
      return [{ rel, p1: endpoints.p1, p2: endpoints.p2, drawP1, drawP2 }];
    });

    const bridges = computeLineBridges(raw.map(r => ({
      id: r.rel.id,
      drawP1: r.drawP1,
      drawP2: r.drawP2,
    })));

    return raw.map(r => ({
      ...r,
      bridges: bridges.get(r.rel.id) ?? [],
    }));
  }, [rels, classes, offsetX, offsetY]);

  const multiplicityBadges = useMemo(() => {
    const raw: MultiplicityBadge[] = [];
    for (const layout of edgeLayouts) {
      const { rel, p1, p2 } = layout;
      const markerSide = getDirectionMarkerSide(rel.type);

      if (rel.sourceMultiplicity) {
        const pos = multiplicityPosition(p1.x, p1.y, p2.x, p2.y, 'start', markerSide === 'start');
        raw.push({
          key: `${rel.id}-src`,
          relId: rel.id,
          end: 'start',
          anchorClassId: rel.sourceId,
          text: rel.sourceMultiplicity,
          ...pos,
        });
      }
      if (rel.targetMultiplicity) {
        const pos = multiplicityPosition(p1.x, p1.y, p2.x, p2.y, 'end', markerSide === 'end');
        raw.push({
          key: `${rel.id}-tgt`,
          relId: rel.id,
          end: 'end',
          anchorClassId: rel.targetId,
          text: rel.targetMultiplicity,
          ...pos,
        });
      }
    }
    return optimizeMultiplicityBadges(raw);
  }, [edgeLayouts]);

  if (parsed.classes.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 13 }}>
        No UML content found.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handlePanStart}
      style={{
        width: '100%', height: '100%',
        overflow: 'hidden', position: 'relative',
        cursor: panning ? 'grabbing' : 'default',
        ...WORKSPACE_DOT_BACKGROUND,
        userSelect: 'none',
      }}
    >
    <div style={{
      position: 'absolute',
      transform: `translate(${vx}px, ${vy}px) scale(${vscale})`,
      transformOrigin: '0 0',
      width: totalW,
      height: totalH,
    }}>
    {/* SVG: relationship lines */}
    <div style={{ position: 'relative', width: totalW, height: totalH }}>
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: totalW, height: totalH, overflow: 'visible' }}
        onClick={() => setSelectedRelId(null)}
      >
        {edgeLayouts.map(layout => {
          const { rel, p1, p2, drawP1, drawP2, bridges } = layout;
          const state = edgeState(selectedRelId === rel.id, hoveredRelId === rel.id);
          const handleRelClick = (e: React.MouseEvent) => { e.stopPropagation(); setSelectedRelId(prev => (prev === rel.id ? null : rel.id)); };

          return (
            <RelationLine
              key={rel.id}
              rel={rel}
              p1={p1}
              p2={p2}
              drawP1={drawP1}
              drawP2={drawP2}
              bridges={bridges}
              state={state}
              onRelClick={handleRelClick}
              onMouseEnter={() => setHoveredRelId(rel.id)}
              onMouseLeave={() => setHoveredRelId(null)}
            />
          );
        })}
        {multiplicityBadges.map(badge => {
          const state = edgeState(selectedRelId === badge.relId, hoveredRelId === badge.relId);
          return (
            <MultiplicityBadgeGraphic
              key={badge.key}
              badge={badge}
              strokeColor={EDGE_COLOR[state]}
            />
          );
        })}
      </svg>

      {/* Class boxes */}
      {classes.map(cls => (
        <ClassBox
          key={cls.id}
          cls={cls}
          offsetX={offsetX}
          offsetY={offsetY}
          scale={vscale}
          edit={edit?.classId === cls.id ? edit : null}
          onMove={moveClass}
          onDragEnd={scheduleLayoutSave}
          onStartEditName={() => setEdit({ classId: cls.id, kind: 'name', val: cls.name })}
          onSaveName={name => saveName(cls.id, name)}
          onStartEditAttr={attrId => {
            const a = cls.attributes.find(x => x.id === attrId)!;
            setEdit({ classId: cls.id, kind: 'attr', attrId, name: a.name, type: a.type });
          }}
          onSaveAttr={(attrId, n, t) => saveAttr(cls.id, attrId, n, t)}
          onCancelEdit={() => setEdit(null)}
          onAddAttr={() => addAttr(cls.id)}
          onDeleteAttr={attrId => deleteAttr(cls.id, attrId)}
          onEditChange={setEdit}
        />
      ))}

      {/* Direction markers above class boxes — always visible without hover */}
      {rels.map(rel => {
        const endpoints = getRelEndpoints(rel, classes, offsetX, offsetY);
        if (!endpoints) return null;
        const { p1, p2 } = endpoints;
        const state = edgeState(selectedRelId === rel.id, hoveredRelId === rel.id);

        const { drawP1, drawP2 } = insetLineEndpoints(p1, p2);

        return (
          <RelationDirectionMarker
            key={`${rel.id}-direction`}
            rel={rel}
            lineStart={drawP1}
            lineEnd={drawP2}
            color={EDGE_COLOR[state]}
            onMouseEnter={() => setHoveredRelId(rel.id)}
            onMouseLeave={() => setHoveredRelId(null)}
          />
        );
      })}
    </div>
    </div>
      <UMLDiagramMinimap
        classes={classes}
        offsetX={offsetX}
        offsetY={offsetY}
        vx={vx}
        vy={vy}
        vscale={vscale}
        containerRef={containerRef}
        onViewportChange={handleMinimapPan}
      />
    </div>
  );
});

UMLDiagram.displayName = 'UMLDiagram';

// ── ClassBox ─────────────────────────────────────────────────────────────────

interface ClassBoxProps {
  cls: CLS;
  offsetX: number;
  offsetY: number;
  scale: number;
  edit: EditState | null;
  onMove: (id: string, x: number, y: number) => void;
  onDragEnd: () => void;
  onStartEditName: () => void;
  onSaveName: (name: string) => void;
  onStartEditAttr: (attrId: string) => void;
  onSaveAttr: (attrId: string, name: string, type: string) => void;
  onCancelEdit: () => void;
  onAddAttr: () => void;
  onDeleteAttr: (attrId: string) => void;
  onEditChange: (e: EditState) => void;
}

const ClassBox: React.FC<ClassBoxProps> = ({
  cls, offsetX, offsetY, scale, edit, onMove, onDragEnd, onStartEditName, onSaveName,
  onStartEditAttr, onSaveAttr, onCancelEdit, onAddAttr, onDeleteAttr, onEditChange,
}) => {
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [hoveredAttr, setHoveredAttr] = useState<string | null>(null);

  const onBoxMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, button, [data-no-drag]')) return;
    e.stopPropagation();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: cls.x, oy: cls.y };
    const onMove2 = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      onMove(
        cls.id,
        dragRef.current.ox + (ev.clientX - dragRef.current.sx) / scale,
        dragRef.current.oy + (ev.clientY - dragRef.current.sy) / scale,
      );
    };
    const onUp = () => {
      dragRef.current = null;
      onDragEnd();
      window.removeEventListener('mousemove', onMove2);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove2);
    window.addEventListener('mouseup', onUp);
  };

  const isAbstractOrIface = cls.isAbstract || cls.isInterface;
  const nameH = isAbstractOrIface ? STEREO_H : NAME_H;

  return (
    <div
      data-classbox
      onMouseDown={onBoxMouseDown}
      style={{
        position: 'absolute',
        left: cls.x + offsetX,
        top: cls.y + offsetY,
        width: BW,
        border: '1.5px solid #000000',
        borderRadius: 0,
        background: '#ffffff',
        boxShadow: '2px 2px 0 rgba(0,0,0,0.08)',
        userSelect: 'none',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12,
        cursor: 'grab',
      }}
    >
      {/* ── Name section ── */}
      <div
        onDoubleClick={e => { e.stopPropagation(); onStartEditName(); }}
        style={{
          height: nameH,
          background: '#ffffff',
          borderBottom: '1.5px solid #000000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 8px',
          gap: 1,
        }}
      >
        {isAbstractOrIface && (
          <span style={{ fontSize: 10, color: '#444444', fontStyle: 'italic', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
            «{cls.isInterface ? 'interface' : 'abstract'}»
          </span>
        )}
        {edit?.kind === 'name' ? (
          <input
            autoFocus
            value={edit.val}
            onChange={e => onEditChange({ ...edit, val: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') onSaveName(edit.val); if (e.key === 'Escape') onCancelEdit(); }}
            onBlur={() => onSaveName(edit.val)}
            onClick={e => e.stopPropagation()}
            style={{
              width: '90%', textAlign: 'center', border: '1px solid #000',
              borderRadius: 0, padding: '1px 4px', fontSize: 12, fontWeight: 700,
              background: 'white', fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            }}
          />
        ) : (
          <span style={{
            fontWeight: 700,
            fontSize: 13,
            color: '#000000',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontStyle: cls.isAbstract ? 'italic' : 'normal',
            textAlign: 'center',
            wordBreak: 'break-all',
          }}>
            {cls.name}
          </span>
        )}
      </div>

      {/* ── Attributes section ── */}
      <div style={{ borderBottom: '1.5px solid #000000', padding: '3px 0 2px', background: '#ffffff' }}>
        {cls.attributes.map(attr => (
          <AttrRow
            key={attr.id}
            attr={attr}
            editing={edit?.kind === 'attr' && edit.attrId === attr.id ? edit : null}
            hovered={hoveredAttr === attr.id}
            onMouseEnter={() => setHoveredAttr(attr.id)}
            onMouseLeave={() => setHoveredAttr(null)}
            onDoubleClick={() => onStartEditAttr(attr.id)}
            onSave={(n, t) => onSaveAttr(attr.id, n, t)}
            onCancel={onCancelEdit}
            onDelete={() => onDeleteAttr(attr.id)}
            onEditChange={(n, t) => onEditChange({ classId: cls.id, kind: 'attr', attrId: attr.id, name: n, type: t })}
          />
        ))}
        <AddAttrRow onClick={onAddAttr} />
      </div>

      {/* ── Methods section (empty placeholder) ── */}
      <div style={{ height: METH_H, background: '#ffffff' }} />
    </div>
  );
};

// ── AttrRow ───────────────────────────────────────────────────────────────────

interface AttrRowProps {
  attr: UMLAttribute;
  editing: EditState | null;
  hovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDoubleClick: () => void;
  onSave: (name: string, type: string) => void;
  onCancel: () => void;
  onDelete: () => void;
  onEditChange: (name: string, type: string) => void;
}

const AttrRow: React.FC<AttrRowProps> = ({
  attr, editing, hovered, onMouseEnter, onMouseLeave,
  onDoubleClick, onSave, onCancel, onDelete, onEditChange,
}) => {
  if (editing && editing.kind === 'attr') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '1px 6px', height: ATTR_ROW }}>
        <span style={{ color: '#64748b', flexShrink: 0 }}>+</span>
        <input
          autoFocus
          value={editing.name}
          onChange={e => onEditChange(e.target.value, editing.type)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(editing.name, editing.type); if (e.key === 'Escape') onCancel(); if (e.key === 'Tab') { e.preventDefault(); (e.currentTarget.nextSibling as HTMLInputElement)?.focus(); } }}
          style={{ flex: 1, minWidth: 0, fontSize: 11, border: '1px solid #93c5fd', borderRadius: 2, padding: '0 3px' }}
        />
        <span style={{ color: '#94a3b8', flexShrink: 0 }}>:</span>
        <input
          value={editing.type}
          onChange={e => onEditChange(editing.name, e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(editing.name, editing.type); if (e.key === 'Escape') onCancel(); }}
          onBlur={() => onSave(editing.name, editing.type)}
          style={{ width: 54, fontSize: 11, border: '1px solid #93c5fd', borderRadius: 2, padding: '0 3px' }}
        />
      </div>
    );
  }

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDoubleClick={onDoubleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 6px',
        height: ATTR_ROW,
        background: hovered ? '#f8fafc' : 'transparent',
        cursor: 'default',
        gap: 3,
      }}
    >
      <span style={{ color: '#64748b', flexShrink: 0 }}>{attr.visibility}</span>
      <span style={{ color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {attr.name}
      </span>
      <span style={{ color: '#94a3b8', flexShrink: 0 }}>:</span>
      <span style={{ color: '#3b82f6', flexShrink: 0 }}>{attr.type}</span>
      {attr.multiplicity && (
        <span style={{ color: '#94a3b8', fontSize: 10, flexShrink: 0 }}>{attr.multiplicity}</span>
      )}
      {hovered && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Remove"
          style={{
            flexShrink: 0, width: 14, height: 14, border: 'none', background: 'transparent',
            cursor: 'pointer', color: '#ef4444', fontSize: 10, padding: 0, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};

// ── AddAttrRow ────────────────────────────────────────────────────────────────

const AddAttrRow: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      data-no-drag
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: ADD_BTN_H,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: 4,
        cursor: 'pointer',
        color: hov ? '#3b82f6' : '#94a3b8',
        transition: 'color 0.1s',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
      <span style={{ fontSize: 10 }}>Add attribute</span>
    </div>
  );
};
