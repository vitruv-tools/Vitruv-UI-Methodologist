import React, { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { ecoreToUml, UMLAttribute, UMLRelationship } from '../../utils/ecoreToUml';
import {
  applyLayoutToUmlClasses,
  positionsFromUmlClasses,
  saveUmlLayout,
} from '../../utils/umlLayoutStorage';
import { assignParallelRelMeta, computeUmlFocusRect } from '../../utils/umlClassLayout';
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

// ── helpers ──────────────────────────────────────────────────────────────────

function boxH(c: CLS): number {
  const nh = c.isAbstract || c.isInterface ? STEREO_H : NAME_H;
  const ah = c.attributes.length * ATTR_ROW + ATTR_PAD + ADD_BTN_H;
  return nh + 1 + ah + 1 + METH_H;
}

function getLayoutMetrics(classes: CLS[]) {
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
  return {
    totalW: maxX - minX + CANVAS_PAD * 2,
    totalH: maxY - minY + CANVAS_PAD * 2,
    offsetX: CANVAS_PAD - minX,
    offsetY: CANVAS_PAD - minY,
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

function multiplicityPosition(
  x1: number, y1: number, x2: number, y2: number,
  end: 'start' | 'end',
): { x: number; y: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(Math.hypot(dx, dy), 0.0001);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const along = end === 'start' ? 26 : -26;
  const baseX = end === 'start' ? x1 : x2;
  const baseY = end === 'start' ? y1 : y2;
  return {
    x: baseX + ux * along + nx * 20,
    y: baseY + uy * along + ny * 20,
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

function markerUrl(id: string, state: EdgeState): string {
  return `url(#${id}-${state === 'default' ? '' : state === 'hovered' ? 'hov' : 'sel'})`
    .replace('--', '-');
}

function resolveMarkers(type: UMLRelationship['type'], state: EdgeState) {
  if (type === 'inheritance') return { mEnd: markerUrl('uml-inherit', state), mStart: undefined };
  if (type === 'association')  return { mEnd: markerUrl('uml-assoc',   state), mStart: undefined };
  if (type === 'composition')  return { mEnd: undefined, mStart: markerUrl('uml-compose', state) };
  return { mEnd: undefined, mStart: undefined };
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
  state: EdgeState;
  onRelClick: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const RelationLine: React.FC<RelationLineProps> = ({ rel, p1, p2, state, onRelClick, onMouseEnter, onMouseLeave }) => {
  const strokeColor = EDGE_COLOR[state];
  const strokeWidth = EDGE_WIDTH[state];
  const { mEnd, mStart } = resolveMarkers(rel.type, state);
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const srcMultPos = rel.sourceMultiplicity ? multiplicityPosition(p1.x, p1.y, p2.x, p2.y, 'start') : null;
  const tgtMultPos = rel.targetMultiplicity ? multiplicityPosition(p1.x, p1.y, p2.x, p2.y, 'end')   : null;

  return (
    <g data-rel-line style={{ cursor: 'pointer' }} onClick={onRelClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#ffffff" strokeWidth={strokeWidth + 4} strokeLinecap="round" />
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={20} />
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={strokeColor} strokeWidth={strokeWidth} markerEnd={mEnd} markerStart={mStart} strokeLinecap="round" />
      {rel.label && (
        <text x={mx} y={my - 5} textAnchor="middle" fontSize="10" fill={strokeColor}
          stroke="#ffffff" strokeWidth={3} paintOrder="stroke fill"
          fontFamily="ui-sans-serif, system-ui, sans-serif" pointerEvents="none">
          {rel.label}
        </text>
      )}
      {[srcMultPos, tgtMultPos].map((pos, idx) => {
        if (!pos) return null;
        const mult = idx === 0 ? rel.sourceMultiplicity : rel.targetMultiplicity;
        return (
          <g key={idx === 0 ? 'src-mult' : 'tgt-mult'} pointerEvents="none">
            <rect x={pos.x - 18} y={pos.y - 12} width={36} height={24} rx={4} fill="#ffffff" stroke={strokeColor} strokeWidth={1.5} />
            <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize="13" fontWeight={700} fill={strokeColor} fontFamily="ui-monospace, Consolas, monospace">
              {mult}
            </text>
          </g>
        );
      })}
    </g>
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

  // Auto-save box positions while dragging and on unmount
  useEffect(() => {
    if (!fileName) return;
    const timer = setTimeout(() => {
      saveUmlLayout(layoutScopeId, fileName, positionsFromUmlClasses(classes));
    }, 250);
    return () => clearTimeout(timer);
  }, [classes, fileName, layoutScopeId]);

  useEffect(() => {
    if (!fileName) return;
    return () => {
      const snapshot = classesRef.current;
      if (snapshot.length > 0) {
        saveUmlLayout(layoutScopeId, fileName, positionsFromUmlClasses(snapshot));
      }
    };
  }, [fileName, layoutScopeId]);

  const diagramRef = useRef<UMLDiagramHandle>(null);
  const didInitialFit = useRef(false);

  useEffect(() => {
    didInitialFit.current = false;
  }, [ecoreContent, fileName]);

  // Fit once on open — focus viewport on the densest cluster of boxes
  useEffect(() => {
    if (didInitialFit.current || classes.length === 0) return;
    const t = setTimeout(() => {
      diagramRef.current?.fitToView?.();
      didInitialFit.current = true;
    }, 120);
    return () => clearTimeout(t);
  }, [classes.length, fileName, layoutScopeId]);

  // ── viewport (pan + zoom) ──────────────────────────────────────────────────
  const [vx, setVx] = useState(0);
  const [vy, setVy] = useState(0);
  const [vscale, setVscale] = useState(1);
  const [panning, setPanning] = useState(false);
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });

  const layout = useMemo(() => getLayoutMetrics(classes), [classes]);
  const { totalW, totalH, offsetX, offsetY } = layout;
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMinimapPan = useCallback((nx: number, ny: number) => {
    viewRef.current = { ...viewRef.current, x: nx, y: ny };
    setVx(nx);
    setVy(ny);
  }, []);

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
  }, []);

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
    },
    };
    diagramRef.current = handle;
    return handle;
  }, [applyZoom, classes, offsetX, offsetY]);

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
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-classbox]')) return;
    if ((e.target as HTMLElement).closest('[data-rel-line]')) return;
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
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

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
        background: '#f8fafc',
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
        <defs>
          <marker id="uml-inherit" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="11" markerHeight="11" orient="auto">
            <polygon points="0,0 13,7 0,14" fill="white" stroke={EDGE_DEFAULT} strokeWidth="1.5" />
          </marker>
          <marker id="uml-inherit-hov" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="11" markerHeight="11" orient="auto">
            <polygon points="0,0 13,7 0,14" fill="white" stroke={EDGE_HOVER} strokeWidth="1.5" />
          </marker>
          <marker id="uml-inherit-sel" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="11" markerHeight="11" orient="auto">
            <polygon points="0,0 13,7 0,14" fill="white" stroke={EDGE_SELECT} strokeWidth="1.5" />
          </marker>
          <marker id="uml-assoc" viewBox="0 0 13 13" refX="12" refY="6.5" markerWidth="10" markerHeight="10" orient="auto">
            <path d="M0,0 L12,6.5 L0,13" fill="none" stroke={EDGE_DEFAULT} strokeWidth="1.5" />
          </marker>
          <marker id="uml-assoc-hov" viewBox="0 0 13 13" refX="12" refY="6.5" markerWidth="10" markerHeight="10" orient="auto">
            <path d="M0,0 L12,6.5 L0,13" fill="none" stroke={EDGE_HOVER} strokeWidth="1.5" />
          </marker>
          <marker id="uml-assoc-sel" viewBox="0 0 13 13" refX="12" refY="6.5" markerWidth="10" markerHeight="10" orient="auto">
            <path d="M0,0 L12,6.5 L0,13" fill="none" stroke={EDGE_SELECT} strokeWidth="1.5" />
          </marker>
          <marker id="uml-compose" viewBox="0 0 18 12" refX="0" refY="6" markerWidth="13" markerHeight="9" orient="auto">
            <polygon points="0,6 8,0 16,6 8,12" fill={EDGE_DEFAULT} />
          </marker>
          <marker id="uml-compose-hov" viewBox="0 0 18 12" refX="0" refY="6" markerWidth="13" markerHeight="9" orient="auto">
            <polygon points="0,6 8,0 16,6 8,12" fill={EDGE_HOVER} />
          </marker>
          <marker id="uml-compose-sel" viewBox="0 0 18 12" refX="0" refY="6" markerWidth="13" markerHeight="9" orient="auto">
            <polygon points="0,6 8,0 16,6 8,12" fill={EDGE_SELECT} />
          </marker>
        </defs>

        {rels.map(rel => {
          const src = classes.find(c => c.id === rel.sourceId);
          const tgt = classes.find(c => c.id === rel.targetId);
          if (!src || !tgt) return null;

          const sh = boxH(src), th = boxH(tgt);
          const sx = src.x + offsetX, sy = src.y + offsetY;
          const tx = tgt.x + offsetX, ty = tgt.y + offsetY;
          const rawP1 = edgePt(sx, sy, sh, tx + BW / 2, ty + th / 2);
          const rawP2 = edgePt(tx, ty, th, sx + BW / 2, sy + sh / 2);
          const { p1, p2 } = applyParallelOffset(rawP1, rawP2, rel.parallelIndex ?? 0, rel.parallelCount ?? 1);

          const state = edgeState(selectedRelId === rel.id, hoveredRelId === rel.id);
          const handleRelClick = (e: React.MouseEvent) => { e.stopPropagation(); setSelectedRelId(prev => (prev === rel.id ? null : rel.id)); };

          return (
            <RelationLine
              key={rel.id}
              rel={rel}
              p1={p1} p2={p2}
              state={state}
              onRelClick={handleRelClick}
              onMouseEnter={() => setHoveredRelId(rel.id)}
              onMouseLeave={() => setHoveredRelId(null)}
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
  cls, offsetX, offsetY, scale, edit, onMove, onStartEditName, onSaveName,
  onStartEditAttr, onSaveAttr, onCancelEdit, onAddAttr, onDeleteAttr, onEditChange,
}) => {
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [hoveredAttr, setHoveredAttr] = useState<string | null>(null);

  const onNameMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
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
      }}
    >
      {/* ── Name section ── */}
      <div
        onMouseDown={onNameMouseDown}
        onDoubleClick={e => { e.stopPropagation(); onStartEditName(); }}
        style={{
          height: nameH,
          background: '#ffffff',
          borderBottom: '1.5px solid #000000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'grab',
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
