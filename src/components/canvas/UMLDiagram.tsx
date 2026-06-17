import React, { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { ecoreToUml, UMLAttribute, UMLRelationship, UMLRelType, UMLModel, UMLVisibility, UMLOperation, buildAttributeTypeOptions, buildOperationReturnTypeOptions, normalizeAttributeTypeDisplay, normalizeOperationReturnType, nextUniqueAttributeName, nextUniqueOperationName, UML_VISIBILITY_OPTIONS } from '../../utils/ecoreToUml';
import { saveMetaModelEcore, MetaModelSaveMetadata } from '../../utils/saveMetaModelEcore';
import { umlSemanticSnapshot, umlToEcore } from '../../utils/umlToEcore';
import {
  normalizeMultiplicityDisplay,
  relationshipMultiplicitySelectOptions,
  UML_RELATIONSHIP_MULTIPLICITY_LABELS,
} from '../../utils/umlMultiplicity';
import { validateUmlModel } from '../../utils/umlValidation';
import { useUmlEditHistory, UmlEditSnapshot } from '../../hooks/useUmlEditHistory';
import {
  applyLayoutToUmlClasses,
  buildUmlLayoutPayload,
  hasSavedUmlLayout,
  loadUmlViewport,
  positionsFromUmlClasses,
  sanitizeUmlClassId,
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

const DIAGRAM_TOOLBAR_TOP = 10;
const DIAGRAM_TOOLBAR_HEIGHT = 46;
const DIAGRAM_HINT_TOP = DIAGRAM_TOOLBAR_TOP + DIAGRAM_TOOLBAR_HEIGHT + 8;
const BW = 190;         // box width (normal)
const EDIT_BW = 288;    // wider while editing class name or attributes
const EDIT_NAME_H = 52; // taller name row while editing
const EDIT_ATTR_ROW = 38; // taller attribute row while editing
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

/** Vitruv design tokens — aligned with Model Library / canvas UI */
const UML = {
  primary: '#049484',
  primarySoft: '#ecfdf5',
  primaryBorder: '#a7f3d0',
  primaryRing: 'rgba(4,148,132,0.2)',
  ink: '#0c436e',
  text: '#374151',
  textMuted: '#64748b',
  border: '#e2e8f0',
  surface: '#ffffff',
  surfaceMuted: '#f8fafc',
  fontSans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

const attrFieldStyle: React.CSSProperties = {
  fontSize: 11,
  border: `1px solid ${UML.primaryBorder}`,
  borderRadius: 4,
  padding: '1px 4px',
  background: UML.surface,
  color: UML.ink,
  fontFamily: UML.fontSans,
};

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
  const oh = c.operations.length * ATTR_ROW + (c.operations.length > 0 ? ATTR_PAD : 0) + ADD_BTN_H;
  const mh = Math.max(METH_H, oh);
  return nh + 1 + ah + 1 + mh;
}

function getInheritanceParentId(relationships: UMLRelationship[], classId: string): string | null {
  return relationships.find(r => r.type === 'inheritance' && r.sourceId === classId)?.targetId ?? null;
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
  operations: UMLOperation[];
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
}

const RelationLine: React.FC<RelationLineProps> = ({
  rel, p1, p2, drawP1, drawP2, bridges, state,
}) => {
  const strokeColor = EDGE_COLOR[state];
  const strokeWidth = EDGE_WIDTH[state];
  const haloPath = bridgedLinePathD(drawP1, drawP2, bridges);
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;

  return (
    <g data-rel-line style={{ pointerEvents: 'none' }}>
      <path d={haloPath} fill="none" stroke="#ffffff" strokeWidth={strokeWidth + 4} strokeLinecap="round" strokeLinejoin="round" />
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

/** Wide invisible stroke above class boxes — fixes clicks blocked by class z-order. */
const RelationHitTarget: React.FC<{
  relId: string;
  drawP1: { x: number; y: number };
  drawP2: { x: number; y: number };
  bridges: LineBridge[];
  onRelClick: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}> = ({ relId, drawP1, drawP2, bridges, onRelClick, onMouseEnter, onMouseLeave }) => {
  const path = bridgedLinePathD(drawP1, drawP2, bridges);
  return (
    <path
      data-rel-hit-line
      data-rel-id={relId}
      d={path}
      fill="none"
      stroke="transparent"
      strokeWidth={28}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
      onClick={onRelClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
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
  onRelClick: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const RelationDirectionMarker: React.FC<RelationDirectionMarkerProps> = ({
  rel, lineStart, lineEnd, color, onRelClick, onMouseEnter, onMouseLeave,
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
      onClick={onRelClick}
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

function isEmptyCanvasTarget(target: HTMLElement): boolean {
  return !target.closest('[data-classbox]')
    && !target.closest('[data-rel-hit-line]')
    && !target.closest('[data-rel-direction-marker]')
    && !target.closest('[data-uml-toolbar]')
    && !target.closest('[data-rel-edit-panel]')
    && !target.closest('[data-class-edit-panel]')
    && !target.closest('[data-uml-connect-banner]')
    && !target.closest('[data-uml-validation]');
}

type EditState =
  | { classId: string; kind: 'name'; val: string }
  | { classId: string; kind: 'attr'; attrId: string; name: string; type: string; visibility: UMLVisibility }
  | { classId: string; kind: 'op'; opId: string; name: string; returnType: string; visibility: UMLVisibility };

/** `library` persists to the metamodel library API; `workspace` only updates the open project/session copy. */
export type UmlDiagramSaveTarget = 'library' | 'workspace';

export interface UmlDiagramSaveContext {
  metaModelId: string;
  ecoreFileId: number;
  modelName: string;
  /** Defaults to `library` (Model Library / drawer). Canvas UML uses `workspace`. */
  saveTarget?: UmlDiagramSaveTarget;
  /** Passed to library save so relink works when GET /meta-models/{id} is unavailable. */
  metaModelMetadata?: MetaModelSaveMetadata;
  onSaved?: (result: { ecoreContent: string; ecoreFileId: number }) => void;
  onError?: (message: string) => void;
}

function nextUniqueClassName(existingNames: Iterable<string>): string {
  const taken = existingNames instanceof Set ? existingNames : new Set(existingNames);
  let candidate = 'NewClass';
  let suffix = 1;
  while (taken.has(candidate)) {
    candidate = `NewClass${suffix++}`;
  }
  return candidate;
}

// ── UMLDiagram ────────────────────────────────────────────────────────────────

export interface UMLDiagramHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitToView: () => void;
  flushLayout: () => void;
  getModel: () => UMLModel;
  isDirty: () => boolean;
  save: () => Promise<void>;
  reload: (ecoreContent: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** Cancel connect mode / clear selection. Returns true if handled. */
  tryEscape: () => boolean;
}

interface UMLDiagramProps {
  ecoreContent: string;
  fileName?: string;
  layoutScopeId?: string;
  /** When false, diagram is view-only (no create/delete/edit). Defaults to true. */
  interactive?: boolean;
  /** When set, enables persisting semantic UML edits back to the metamodel ecore file. */
  saveContext?: UmlDiagramSaveContext;
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
}

const REL_TYPE_CYCLE: UMLRelType[] = ['association', 'composition', 'inheritance'];
const REL_TYPE_LABELS: Record<UMLRelType, string> = {
  association: 'Association',
  composition: 'Composition',
  inheritance: 'Inheritance',
};

function nextRelType(current: UMLRelType): UMLRelType {
  const idx = REL_TYPE_CYCLE.indexOf(current);
  return REL_TYPE_CYCLE[(idx + 1) % REL_TYPE_CYCLE.length];
}

export const UMLDiagram = forwardRef<UMLDiagramHandle, UMLDiagramProps>(({
  ecoreContent,
  fileName,
  layoutScopeId = 'default',
  interactive = true,
  saveContext,
  onHistoryChange,
}, ref) => {
  const parsed = useMemo(() => {
    const model = ecoreToUml(ecoreContent);
    return {
      ...model,
      classes: model.classes.map(c => ({ ...c, operations: c.operations ?? [] })),
    };
  }, [ecoreContent]);
  const [classes, setClasses] = useState<CLS[]>(() => {
    const base = fileName ? applyLayoutToUmlClasses(layoutScopeId, fileName, parsed.classes) : parsed.classes;
    return base.map(c => ({ ...c, operations: c.operations ?? [] }));
  });
  const [relationships, setRelationships] = useState<UMLRelationship[]>(() => parsed.relationships);
  const [originalEcore, setOriginalEcore] = useState(ecoreContent);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const initialSnapshotRef = useRef('');
  const skipNextEcoreResetRef = useRef(false);
  const rels = useMemo(
    () => assignParallelRelMeta(relationships) as DiagramRel[],
    [relationships],
  );
  const [edit, setEdit] = useState<EditState | null>(null);
  const editRef = useRef<EditState | null>(null);
  editRef.current = edit;
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null);
  const [hoveredRelId, setHoveredRelId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const classesRef = useRef(classes);
  classesRef.current = classes;
  const relationshipsRef = useRef(relationships);
  relationshipsRef.current = relationships;
  const dragHistorySavedRef = useRef(false);

  const {
    canUndo: historyCanUndo,
    canRedo: historyCanRedo,
    recordBeforeChange,
    undo: undoHistory,
    redo: redoHistory,
    clearHistory,
  } = useUmlEditHistory();

  const takeSnapshot = useCallback((): UmlEditSnapshot => ({
    classes: structuredClone(classesRef.current),
    relationships: structuredClone(relationshipsRef.current),
  }), []);

  const applySnapshot = useCallback((snapshot: UmlEditSnapshot) => {
    setClasses(snapshot.classes);
    setRelationships(snapshot.relationships);
    setEdit(null);
    setSelectedClassId(null);
    setSelectedRelId(null);
    setConnectMode(false);
    setConnectSourceId(null);
  }, []);

  const notifyHistoryChange = useCallback(() => {
    onHistoryChange?.({
      canUndo: historyCanUndo,
      canRedo: historyCanRedo,
    });
  }, [onHistoryChange, historyCanUndo, historyCanRedo]);

  useEffect(() => {
    notifyHistoryChange();
  }, [notifyHistoryChange, historyCanUndo, historyCanRedo]);

  const recordChange = useCallback(() => {
    if (!interactive) return;
    recordBeforeChange(takeSnapshot());
  }, [interactive, recordBeforeChange, takeSnapshot]);

  const handleUndo = useCallback(() => {
    if (!interactive || !historyCanUndo) return;
    const restored = undoHistory(takeSnapshot());
    if (restored) applySnapshot(restored);
  }, [interactive, historyCanUndo, undoHistory, takeSnapshot, applySnapshot]);

  const handleRedo = useCallback(() => {
    if (!interactive || !historyCanRedo) return;
    const restored = redoHistory(takeSnapshot());
    if (restored) applySnapshot(restored);
  }, [interactive, historyCanRedo, redoHistory, takeSnapshot, applySnapshot]);

  const getModel = useCallback((): UMLModel => ({
    classes: classesRef.current,
    relationships: relationshipsRef.current,
  }), []);

  const resetFromEcore = useCallback((content: string, preserveLivePositions = false) => {
    const livePositions = preserveLivePositions
      ? positionsFromUmlClasses(classesRef.current)
      : null;
    const next = ecoreToUml(content);
    let baseClasses = fileName
      ? applyLayoutToUmlClasses(layoutScopeId, fileName, next.classes)
      : next.classes;
    if (livePositions) {
      baseClasses = baseClasses.map(c => {
        const live = livePositions[c.id] ?? livePositions[sanitizeUmlClassId(c.name)];
        return live ? { ...c, x: live.x, y: live.y } : c;
      });
    }
    setOriginalEcore(content);
    setClasses(baseClasses.map(c => ({ ...c, operations: c.operations ?? [] })));
    setRelationships(next.relationships);
    setSelectedClassId(null);
    setSelectedRelId(null);
    setConnectMode(false);
    setConnectSourceId(null);
    setEdit(null);
    initialSnapshotRef.current = umlSemanticSnapshot({
      classes: baseClasses,
      relationships: next.relationships,
    });
    setSaveMessage('');
    if (preserveLivePositions && fileName) {
      const viewport: UmlViewport = {
        x: viewRef.current.x,
        y: viewRef.current.y,
        scale: viewRef.current.scale,
      };
      saveUmlLayout(layoutScopeId, fileName, buildUmlLayoutPayload(baseClasses, viewport));
    }
    clearHistory();
  }, [fileName, layoutScopeId, clearHistory]);

  // Re-apply saved layout when ecore content or file changes
  useEffect(() => {
    if (skipNextEcoreResetRef.current) {
      skipNextEcoreResetRef.current = false;
      return;
    }
    resetFromEcore(ecoreContent);
  }, [ecoreContent, fileName, layoutScopeId, resetFromEcore]);

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
    return () => {
      clearTimeout(timer);
      persistLayout();
    };
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

  const moveClass = useCallback((id: string, x: number, y: number) => {
    if (!dragHistorySavedRef.current) {
      recordChange();
      dragHistorySavedRef.current = true;
    }
    setClasses(prev => prev.map(c => (c.id === id ? { ...c, x, y } : c)));
    scheduleDebouncedLayoutSave();
  }, [recordChange, scheduleDebouncedLayoutSave]);

  const finishClassDrag = useCallback(() => {
    dragHistorySavedRef.current = false;
    scheduleLayoutSave();
  }, [scheduleLayoutSave]);

  const saveName = useCallback((oldId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setEdit(null);
      return;
    }
    recordChange();
    const newId = sanitizeUmlClassId(trimmed);
    setClasses(prev => prev.map(c => {
      if (c.id !== oldId) return c;
      return {
        ...c,
        id: newId,
        name: trimmed,
        attributes: c.attributes.map((a, idx) => ({ ...a, id: `${newId}-${idx}` })),
        operations: c.operations.map((o, idx) => ({ ...o, id: `${newId}-op-${idx}` })),
      };
    }));
    setRelationships(prev => prev.map(r => ({
      ...r,
      sourceId: r.sourceId === oldId ? newId : r.sourceId,
      targetId: r.targetId === oldId ? newId : r.targetId,
    })));
    setSelectedClassId(prev => (prev === oldId ? newId : prev));
    setConnectSourceId(prev => (prev === oldId ? newId : prev));
    setEdit(null);
  }, [recordChange]);

  const saveAttr = useCallback((classId: string, attrId: string, name: string, type: string, visibility: UMLVisibility) => {
    recordChange();
    setClasses(prev => prev.map(c => {
      if (c.id !== classId) return c;
      const current = c.attributes.find(a => a.id === attrId);
      if (!current) return c;
      const otherNames = c.attributes.filter(a => a.id !== attrId).map(a => a.name);
      const trimmed = name.trim();
      const resolvedName = trimmed
        ? nextUniqueAttributeName(otherNames, trimmed)
        : current.name;
      return {
        ...c,
        attributes: c.attributes.map(a => a.id !== attrId ? a : {
          ...a,
          name: resolvedName,
          type: normalizeAttributeTypeDisplay(type.trim() || a.type),
          visibility,
        }),
      };
    }));
    setEdit(null);
  }, [recordChange]);

  const saveOp = useCallback((classId: string, opId: string, name: string, returnType: string, visibility: UMLVisibility) => {
    recordChange();
    setClasses(prev => prev.map(c => {
      if (c.id !== classId) return c;
      const current = c.operations.find(o => o.id === opId);
      if (!current) return c;
      const otherNames = c.operations.filter(o => o.id !== opId).map(o => o.name);
      const trimmed = name.trim();
      const resolvedName = trimmed
        ? nextUniqueOperationName(otherNames, trimmed)
        : current.name;
      return {
        ...c,
        operations: c.operations.map(o => o.id !== opId ? o : {
          ...o,
          name: resolvedName,
          returnType: normalizeOperationReturnType(returnType.trim() || o.returnType),
          visibility,
        }),
      };
    }));
    setEdit(null);
  }, [recordChange]);

  const flushPendingEdit = useCallback(() => {
    const pending = editRef.current;
    if (!pending) return;

    const active = document.activeElement as HTMLElement | null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) {
      active.blur();
      return;
    }

    if (pending.kind === 'attr') {
      saveAttr(pending.classId, pending.attrId, pending.name, pending.type, pending.visibility);
    } else if (pending.kind === 'op') {
      saveOp(pending.classId, pending.opId, pending.name, pending.returnType, pending.visibility);
    } else if (pending.kind === 'name') {
      saveName(pending.classId, pending.val);
    }
  }, [saveAttr, saveOp, saveName]);

  const dismissClassSelection = useCallback(() => {
    flushPendingEdit();
    setSelectedClassId(null);
    setEdit(null);
  }, [flushPendingEdit]);

  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!interactive) return;
    if (!isEmptyCanvasTarget(e.target as HTMLElement)) return;
    e.preventDefault();
    e.stopPropagation();
    dismissClassSelection();
  }, [interactive, dismissClassSelection]);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    flushPendingEdit();
    if (!isEmptyCanvasTarget(e.target as HTMLElement)) return;
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
  }, [scheduleLayoutSave, flushPendingEdit]);

  const addAttr = useCallback((classId: string) => {
    flushPendingEdit();
    recordChange();
    const cls = classesRef.current.find(c => c.id === classId);
    const uniqueName = nextUniqueAttributeName(cls?.attributes.map(a => a.name) ?? []);
    const newAttr: UMLAttribute = {
      id: `${classId}-${Date.now()}`,
      name: uniqueName,
      type: 'String',
      visibility: '+',
    };
    setClasses(prev => prev.map(c => c.id !== classId ? c : { ...c, attributes: [...c.attributes, newAttr] }));
    setEdit({ classId, kind: 'attr', attrId: newAttr.id, name: newAttr.name, type: newAttr.type, visibility: '+' });
  }, [recordChange, flushPendingEdit]);

  const addOp = useCallback((classId: string) => {
    flushPendingEdit();
    recordChange();
    const cls = classesRef.current.find(c => c.id === classId);
    const uniqueName = nextUniqueOperationName(cls?.operations.map(o => o.name) ?? []);
    const newOp: UMLOperation = {
      id: `${classId}-op-${Date.now()}`,
      name: uniqueName,
      returnType: 'Void',
      visibility: '+',
    };
    setClasses(prev => prev.map(c => c.id !== classId ? c : { ...c, operations: [...c.operations, newOp] }));
    setEdit({ classId, kind: 'op', opId: newOp.id, name: newOp.name, returnType: newOp.returnType, visibility: '+' });
  }, [recordChange, flushPendingEdit]);

  const deleteAttr = useCallback((classId: string, attrId: string) => {
    recordChange();
    setClasses(prev => prev.map(c => c.id !== classId ? c : { ...c, attributes: c.attributes.filter(a => a.id !== attrId) }));
  }, [recordChange]);

  const deleteOp = useCallback((classId: string, opId: string) => {
    recordChange();
    setClasses(prev => prev.map(c => c.id !== classId ? c : { ...c, operations: c.operations.filter(o => o.id !== opId) }));
  }, [recordChange]);

  const deleteClass = useCallback((classId: string) => {
    recordChange();
    setClasses(prev => prev.filter(c => c.id !== classId));
    setRelationships(prev => prev.filter(r => r.sourceId !== classId && r.targetId !== classId));
    setSelectedClassId(prev => (prev === classId ? null : prev));
    setConnectSourceId(prev => (prev === classId ? null : prev));
    setEdit(prev => (prev?.classId === classId ? null : prev));
  }, [recordChange]);

  const addClass = useCallback(() => {
    recordChange();
    const el = containerRef.current;
    const { x: vx0, y: vy0, scale } = viewRef.current;
    const offset = layoutOffsetRef.current ?? { offsetX: CANVAS_PAD, offsetY: CANVAS_PAD };
    let cx = 200;
    let cy = 120;
    if (el) {
      cx = (el.clientWidth / 2 - vx0) / scale - offset.offsetX - EDIT_BW / 2;
      cy = (el.clientHeight / 2 - vy0) / scale - offset.offsetY - 72;
    }

    const name = nextUniqueClassName(classesRef.current.map(c => c.name));
    const id = sanitizeUmlClassId(name);

    const newClass: CLS = {
      id,
      name,
      isAbstract: false,
      isInterface: false,
      attributes: [],
      operations: [],
      x: cx,
      y: cy,
    };
    setClasses(prev => [...prev, newClass]);
    setSelectedClassId(id);
  }, [recordChange]);

  const addRelationship = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const exists = relationshipsRef.current.some(
      r => r.sourceId === sourceId && r.targetId === targetId && r.type === 'association',
    );
    if (exists) return;
    recordChange();
    const newRelId = `rel-${Date.now()}`;
    setRelationships(prev => [...prev, {
      id: newRelId,
      sourceId,
      targetId,
      type: 'association' as UMLRelType,
      targetMultiplicity: '0..1',
      sourceMultiplicity: '1',
    }]);
    setSelectedRelId(newRelId);
  }, [recordChange]);

  const deleteRelationship = useCallback((relId: string) => {
    recordChange();
    setRelationships(prev => prev.filter(r => r.id !== relId));
    setSelectedRelId(prev => (prev === relId ? null : prev));
  }, [recordChange]);

  const cycleRelationshipType = useCallback((relId: string) => {
    recordChange();
    setRelationships(prev => prev.map(r =>
      r.id === relId ? { ...r, type: nextRelType(r.type) } : r,
    ));
  }, [recordChange]);

  const updateRelationship = useCallback((relId: string, patch: Partial<UMLRelationship>) => {
    recordChange();
    setRelationships(prev => prev.map(r => (r.id === relId ? { ...r, ...patch } : r)));
  }, [recordChange]);

  const tryEscape = useCallback(() => {
    if (connectMode) {
      setConnectMode(false);
      setConnectSourceId(null);
      return true;
    }
    if (edit) {
      setEdit(null);
      return true;
    }
    return false;
  }, [connectMode, edit]);

  const handleRelationshipClick = useCallback((relId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.detail >= 2 && interactive) {
      cycleRelationshipType(relId);
    }
    setSelectedRelId(relId);
  }, [interactive, cycleRelationshipType]);

  const isDirty = useCallback(() => {
    return umlSemanticSnapshot(getModel()) !== initialSnapshotRef.current;
  }, [getModel]);

  const handleSave = useCallback(async () => {
    if (!saveContext || saving) return;
    setSaving(true);
    setSaveMessage('');
    try {
      persistLayout();
      const result =
        saveContext.saveTarget === 'workspace'
          ? {
              ecoreContent: umlToEcore(getModel(), originalEcore),
              ecoreFileId: saveContext.ecoreFileId,
            }
          : await saveMetaModelEcore({
              metaModelId: saveContext.metaModelId,
              ecoreFileId: saveContext.ecoreFileId,
              modelName: saveContext.modelName,
              model: getModel(),
              originalEcore,
              metaModelMetadata: saveContext.metaModelMetadata,
            });
      resetFromEcore(result.ecoreContent, true);
      skipNextEcoreResetRef.current = true;
      saveContext.onSaved?.(result);
      setSaveMessage(saveContext.saveTarget === 'workspace' ? 'Saved to project' : 'Saved');
      clearHistory();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setSaveMessage(message);
      saveContext.onError?.(message);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(''), 4000);
    }
  }, [saveContext, saving, getModel, originalEcore, resetFromEcore, persistLayout, clearHistory]);

  // ── imperative handle ──────────────────────────────────────────────────────
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
      getModel,
      isDirty,
      save: handleSave,
      reload: (content: string) => {
        skipNextEcoreResetRef.current = true;
        resetFromEcore(content, false);
        setTimeout(() => {
          if (fileName) {
            const saved = loadUmlViewport(layoutScopeId, fileName);
            if (saved) {
              viewRef.current = saved;
              setVx(saved.x);
              setVy(saved.y);
              setVscale(saved.scale);
              return;
            }
          }
          diagramRef.current?.fitToView?.();
        }, 120);
      },
      undo: handleUndo,
      redo: handleRedo,
      canUndo: () => historyCanUndo,
      canRedo: () => historyCanRedo,
      tryEscape,
    };
    diagramRef.current = handle;
    return handle;
  }, [applyZoom, classes, offsetX, offsetY, fileName, layoutScopeId, persistLayout, scheduleLayoutSave, getModel, isDirty, handleSave, resetFromEcore, tryEscape, handleUndo, handleRedo, historyCanUndo, historyCanRedo]);

  const handleClassSelect = useCallback((classId: string) => {
    if (!interactive) return;
    flushPendingEdit();
    if (connectMode) {
      if (!connectSourceId) {
        setConnectSourceId(classId);
        setSelectedClassId(classId);
        return;
      }
      if (connectSourceId !== classId) {
        addRelationship(connectSourceId, classId);
      }
      setConnectMode(false);
      setConnectSourceId(null);
      setSelectedClassId(classId);
      return;
    }
    setSelectedClassId(classId);
  }, [interactive, connectMode, connectSourceId, addRelationship, flushPendingEdit]);

  const updateClass = useCallback((classId: string, patch: Partial<Pick<CLS, 'name' | 'isAbstract' | 'isInterface'>>) => {
    recordChange();
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) return;
      const newId = sanitizeUmlClassId(trimmed);
      setClasses(prev => prev.map(c => {
        if (c.id !== classId) return c;
        return {
          ...c,
          id: newId,
          name: trimmed,
          attributes: c.attributes.map((a, idx) => ({ ...a, id: `${newId}-${idx}` })),
          operations: c.operations.map((o, idx) => ({ ...o, id: `${newId}-op-${idx}` })),
        };
      }));
      setRelationships(prev => prev.map(r => ({
        ...r,
        sourceId: r.sourceId === classId ? newId : r.sourceId,
        targetId: r.targetId === classId ? newId : r.targetId,
      })));
      setSelectedClassId(prev => (prev === classId ? newId : prev));
      setConnectSourceId(prev => (prev === classId ? newId : prev));
      return;
    }
    setClasses(prev => prev.map(c => (c.id !== classId ? c : { ...c, ...patch })));
  }, [recordChange]);

  const setInheritanceParent = useCallback((classId: string, parentId: string | null) => {
    recordChange();
    setRelationships(prev => {
      const filtered = prev.filter(r => !(r.type === 'inheritance' && r.sourceId === classId));
      if (!parentId || parentId === classId) return filtered;
      return [...filtered, {
        id: `rel-${Date.now()}`,
        sourceId: classId,
        targetId: parentId,
        type: 'inheritance' as UMLRelType,
      }];
    });
  }, [recordChange]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedRelId) {
      deleteRelationship(selectedRelId);
      return;
    }
    if (selectedClassId) {
      deleteClass(selectedClassId);
    }
  }, [selectedRelId, selectedClassId, deleteRelationship, deleteClass]);

  useEffect(() => {
    if (!interactive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const mod = e.ctrlKey || e.metaKey;

      if (mod && !inField) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) handleRedo();
          else handleUndo();
          return;
        }
        if (key === 'y') {
          e.preventDefault();
          e.stopPropagation();
          handleRedo();
          return;
        }
      }

      if (e.key === 'Escape') {
        if (tryEscape()) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (inField) return;
      if (!selectedRelId && !selectedClassId) return;
      e.preventDefault();
      handleDeleteSelected();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [interactive, selectedRelId, selectedClassId, handleDeleteSelected, tryEscape, handleUndo, handleRedo]);

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

  const validationIssues = useMemo(
    () => validateUmlModel({ classes, relationships }),
    [classes, relationships],
  );

  if (classes.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: '#9ca3af', fontSize: 13, gap: 12,
        ...WORKSPACE_DOT_BACKGROUND,
      }}>
        <span>No UML content found.</span>
        {interactive && (
          <button
            type="button"
            onClick={addClass}
            style={{
              padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
              background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            + Add class
          </button>
        )}
      </div>
    );
  }

  const canDelete = !!(selectedRelId || selectedClassId);
  const selectedRel = selectedRelId ? relationships.find(r => r.id === selectedRelId) : null;
  const selectedClass = selectedClassId ? classes.find(c => c.id === selectedClassId) : null;
  const hasUnsavedChanges = isDirty();
  const saveMessageIsSuccess = saveMessage === 'Saved' || saveMessage === 'Saved to project';

  return (
    <div
      ref={containerRef}
      onMouseDown={handlePanStart}
      onDoubleClick={handleCanvasDoubleClick}
      style={{
        width: '100%', height: '100%',
        overflow: 'hidden', position: 'relative',
        cursor: panning ? 'grabbing' : (connectMode ? 'crosshair' : 'default'),
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
        onClick={() => {
          if (connectMode) {
            setConnectMode(false);
            setConnectSourceId(null);
          }
        }}
      >
        {edgeLayouts.map(layout => {
          const { rel, p1, p2, drawP1, drawP2, bridges } = layout;
          const state = edgeState(selectedRelId === rel.id, hoveredRelId === rel.id);

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
          selected={selectedClassId === cls.id}
          connectSource={connectSourceId === cls.id}
          interactive={interactive}
          edit={edit?.classId === cls.id ? edit : null}
          onSelect={() => handleClassSelect(cls.id)}
          onDragStart={() => { dragHistorySavedRef.current = false; }}
          onMove={moveClass}
          onDragEnd={finishClassDrag}
          onStartEditName={() => {
            if (!interactive) return;
            flushPendingEdit();
            setEdit({ classId: cls.id, kind: 'name', val: cls.name });
          }}
          onSaveName={name => saveName(cls.id, name)}
          onStartEditAttr={attrId => {
            if (!interactive) return;
            flushPendingEdit();
            const a = cls.attributes.find(x => x.id === attrId)!;
            setEdit({
              classId: cls.id,
              kind: 'attr',
              attrId,
              name: a.name,
              type: normalizeAttributeTypeDisplay(a.type),
              visibility: a.visibility,
            });
          }}
          onSaveAttr={(attrId, n, t, v) => saveAttr(cls.id, attrId, n, t, v)}
          onCancelEdit={() => setEdit(null)}
          onAddAttr={() => interactive && addAttr(cls.id)}
          onDeleteAttr={attrId => deleteAttr(cls.id, attrId)}
          onStartEditOp={opId => {
            if (!interactive) return;
            flushPendingEdit();
            const o = cls.operations.find(x => x.id === opId)!;
            setEdit({
              classId: cls.id,
              kind: 'op',
              opId,
              name: o.name,
              returnType: normalizeOperationReturnType(o.returnType),
              visibility: o.visibility,
            });
          }}
          onSaveOp={(opId, n, rt, v) => saveOp(cls.id, opId, n, rt, v)}
          onAddOp={() => interactive && addOp(cls.id)}
          onDeleteOp={opId => deleteOp(cls.id, opId)}
          onDelete={() => deleteClass(cls.id)}
          onEditChange={setEdit}
        />
      ))}

      {/* Hit targets above class boxes — connections stay clickable */}
      <svg
        data-rel-hit-layer
        style={{ position: 'absolute', top: 0, left: 0, width: totalW, height: totalH, overflow: 'visible', zIndex: 6, pointerEvents: 'none' }}
      >
        {edgeLayouts.map(layout => {
          const { rel, drawP1, drawP2, bridges } = layout;
          return (
            <RelationHitTarget
              key={`hit-${rel.id}`}
              relId={rel.id}
              drawP1={drawP1}
              drawP2={drawP2}
              bridges={bridges}
              onRelClick={e => handleRelationshipClick(rel.id, e)}
              onMouseEnter={() => setHoveredRelId(rel.id)}
              onMouseLeave={() => setHoveredRelId(null)}
            />
          );
        })}
      </svg>

      {/* Direction markers above class boxes */}
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
            onRelClick={e => handleRelationshipClick(rel.id, e)}
            onMouseEnter={() => setHoveredRelId(rel.id)}
            onMouseLeave={() => setHoveredRelId(null)}
          />
        );
      })}
    </div>
    </div>
      {interactive && connectMode && (
        <div
          data-uml-connect-banner
          style={{
            position: 'absolute',
            top: DIAGRAM_HINT_TOP,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 32,
            padding: '6px 14px',
            borderRadius: 10,
            background: UML.surface,
            border: `1px solid ${UML.primaryBorder}`,
            color: UML.ink,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: UML.fontSans,
            boxShadow: `0 4px 14px ${UML.primaryRing}`,
            pointerEvents: 'none',
            maxWidth: 'min(420px, calc(100vw - 320px))',
            textAlign: 'center',
            lineHeight: 1.35,
          }}
        >
          {connectSourceId
            ? 'Click the target class to create a connection'
            : 'Click the source class, then the target class'}
        </div>
      )}
      {interactive && (
        <div
          data-uml-toolbar
          style={{
            position: 'absolute',
            top: DIAGRAM_TOOLBAR_TOP,
            right: 12,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            zIndex: 30,
            padding: '5px 8px',
            borderRadius: 10,
            background: UML.surface,
            border: `1px solid ${UML.primaryBorder}`,
            boxShadow: `0 4px 14px ${UML.primaryRing}, 0 0 0 1px rgba(4,148,132,0.05)`,
          }}
        >
          <DiagramToolButton title="Add class" active={false} onClick={addClass} label="Class">
            <IconPlus />
          </DiagramToolButton>
          <DiagramToolButton
            title="Undo (Ctrl+Z)"
            active={false}
            disabled={!historyCanUndo}
            onClick={handleUndo}
            label="Undo"
          >
            <IconUndo />
          </DiagramToolButton>
          <DiagramToolButton
            title="Redo (Ctrl+Shift+Z)"
            active={false}
            disabled={!historyCanRedo}
            onClick={handleRedo}
            label="Redo"
          >
            <IconRedo />
          </DiagramToolButton>
          <DiagramToolButton
            title={connectMode ? 'Cancel connect mode (Esc)' : 'Connect two classes'}
            active={connectMode}
            onClick={() => {
              setConnectMode(v => !v);
              setConnectSourceId(null);
            }}
            label="Connect"
          >
            <IconConnect />
          </DiagramToolButton>
          <DiagramToolButton
            title="Delete selected class or connection"
            active={false}
            disabled={!canDelete}
            onClick={handleDeleteSelected}
            label="Delete"
          >
            <IconTrash />
          </DiagramToolButton>
          {saveContext && (
            <DiagramToolButton
              title={hasUnsavedChanges
                ? (saveContext.saveTarget === 'workspace' ? 'Save changes to project' : 'Save metamodel changes')
                : 'No unsaved changes'}
              active={hasUnsavedChanges}
              disabled={!hasUnsavedChanges || saving}
              onClick={() => { void handleSave(); }}
              label="Save"
              accent
            >
              {saving ? '…' : <IconSave />}
            </DiagramToolButton>
          )}
        </div>
      )}
      {saveMessage && (
        <div style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          padding: '8px 16px',
          borderRadius: 8,
          background: saveMessageIsSuccess ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${saveMessageIsSuccess ? '#86efac' : '#fecaca'}`,
          color: saveMessageIsSuccess ? '#15803d' : '#dc2626',
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          maxWidth: 'min(480px, 90vw)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          {saveMessage}
        </div>
      )}
      {interactive && validationIssues.length > 0 && (
        <div
          data-uml-validation
          style={{
            position: 'absolute',
            top: DIAGRAM_HINT_TOP,
            left: selectedClass ? 288 : 12,
            right: selectedRel ? 288 : 12,
            zIndex: 31,
            padding: '8px 12px',
            borderRadius: 8,
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            color: '#92400e',
            fontSize: 11,
            fontFamily: UML.fontSans,
            lineHeight: 1.45,
            maxHeight: 72,
            overflowY: 'auto',
          }}
        >
          {validationIssues.slice(0, 4).map((issue, idx) => (
            <div key={`${issue.message}-${idx}`}>
              {issue.severity === 'error' ? '⛔' : '⚠'} {issue.message}
            </div>
          ))}
          {validationIssues.length > 4 && (
            <div style={{ marginTop: 4, fontStyle: 'italic' }}>
              +{validationIssues.length - 4} more issue(s)
            </div>
          )}
        </div>
      )}
      {interactive && selectedClass && (
        <ClassEditPanel
          cls={selectedClass}
          classes={classes}
          parentId={getInheritanceParentId(relationships, selectedClass.id)}
          onUpdate={patch => updateClass(selectedClass.id, patch)}
          onSetParent={parentId => setInheritanceParent(selectedClass.id, parentId)}
          onDelete={() => deleteClass(selectedClass.id)}
          onClose={() => setSelectedClassId(null)}
        />
      )}
      {interactive && selectedRel && (
        <RelationshipEditPanel
          rel={selectedRel}
          classes={classes}
          onUpdate={patch => updateRelationship(selectedRel.id, patch)}
          onClose={() => setSelectedRelId(null)}
          onSwapEndpoints={() => updateRelationship(selectedRel.id, {
            sourceId: selectedRel.targetId,
            targetId: selectedRel.sourceId,
            sourceMultiplicity: selectedRel.targetMultiplicity,
            targetMultiplicity: selectedRel.sourceMultiplicity,
          })}
        />
      )}
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
  selected: boolean;
  connectSource: boolean;
  interactive: boolean;
  edit: EditState | null;
  onSelect: () => void;
  onMove: (id: string, x: number, y: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onStartEditName: () => void;
  onSaveName: (name: string) => void;
  onStartEditAttr: (attrId: string) => void;
  onSaveAttr: (attrId: string, name: string, type: string, visibility: UMLVisibility) => void;
  onCancelEdit: () => void;
  onAddAttr: () => void;
  onDeleteAttr: (attrId: string) => void;
  onStartEditOp: (opId: string) => void;
  onSaveOp: (opId: string, name: string, returnType: string, visibility: UMLVisibility) => void;
  onAddOp: () => void;
  onDeleteOp: (opId: string) => void;
  onDelete: () => void;
  onEditChange: (e: EditState) => void;
}

const ClassBox: React.FC<ClassBoxProps> = ({
  cls, offsetX, offsetY, scale, selected, connectSource, interactive, edit, onSelect, onDragStart, onMove, onDragEnd, onStartEditName, onSaveName,
  onStartEditAttr, onSaveAttr, onCancelEdit, onAddAttr, onDeleteAttr, onStartEditOp, onSaveOp, onAddOp, onDeleteOp, onDelete, onEditChange,
}) => {
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const didDragRef = useRef(false);
  const [hoveredAttr, setHoveredAttr] = useState<string | null>(null);
  const [hoveredOp, setHoveredOp] = useState<string | null>(null);

  const attrTypeOptions = useMemo(
    () => buildAttributeTypeOptions(
      edit?.kind === 'attr' ? edit.type : undefined,
    ),
    [edit],
  );

  const opReturnOptions = useMemo(
    () => buildOperationReturnTypeOptions(
      edit?.kind === 'op' ? edit.returnType : undefined,
    ),
    [edit],
  );

  const onBoxMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, button, [data-no-drag]')) return;
    e.stopPropagation();
    didDragRef.current = false;
    onDragStart();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: cls.x, oy: cls.y };
    const onMove2 = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      if (Math.abs(ev.clientX - dragRef.current.sx) > 3 || Math.abs(ev.clientY - dragRef.current.sy) > 3) {
        didDragRef.current = true;
      }
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
  const isEditingBox = edit?.classId === cls.id && (edit.kind === 'name' || edit.kind === 'attr' || edit.kind === 'op');
  const isEditingName = isEditingBox && edit.kind === 'name';
  const displayW = isEditingBox ? EDIT_BW : BW;
  const nameSectionH = isEditingName
    ? (isAbstractOrIface ? Math.max(STEREO_H, EDIT_NAME_H + 8) : EDIT_NAME_H)
    : nameH;

  return (
    <div
      data-classbox
      onMouseDown={onBoxMouseDown}
      onClick={(e) => {
        e.stopPropagation();
        if (didDragRef.current) {
          didDragRef.current = false;
          return;
        }
        onSelect();
      }}
      style={{
        position: 'absolute',
        left: cls.x + offsetX,
        top: cls.y + offsetY,
        width: displayW,
        border: connectSource
          ? `2.5px solid ${UML.primary}`
          : selected
            ? `2.5px solid ${UML.primary}`
            : `1.5px solid ${UML.border}`,
        borderRadius: 8,
        background: UML.surface,
        boxShadow: isEditingBox
          ? `0 0 0 4px ${UML.primaryRing}, 0 12px 28px rgba(4,148,132,0.18)`
          : selected || connectSource
            ? `0 0 0 3px ${UML.primaryRing}, 0 4px 14px rgba(15,23,42,0.08)`
            : '0 2px 8px rgba(15,23,42,0.06)',
        userSelect: 'none',
        fontFamily: UML.fontMono,
        fontSize: 12,
        cursor: 'grab',
        zIndex: isEditingBox ? 25 : selected ? 15 : 1,
        transition: 'width 0.22s ease, box-shadow 0.22s ease',
      }}
    >
      {interactive && selected && (
        <button
          type="button"
          data-no-drag
          title="Delete class"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#dc2626',
            fontSize: 11,
            lineHeight: 1,
            cursor: 'pointer',
            zIndex: 2,
          }}
        >
          ✕
        </button>
      )}
      {/* ── Name section ── */}
      <div
        onDoubleClick={e => { e.stopPropagation(); onStartEditName(); }}
        onClick={e => {
          e.stopPropagation();
          if (!interactive) return;
          if (!selected) {
            onSelect();
            return;
          }
          if (edit?.classId !== cls.id) {
            onStartEditName();
          }
        }}
        style={{
          height: nameSectionH,
          background: isEditingName ? UML.primarySoft : selected ? UML.primarySoft : UML.surfaceMuted,
          borderBottom: `1.5px solid ${UML.border}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isEditingName ? '8px 12px' : '4px 8px',
          gap: 1,
          transition: 'height 0.22s ease, padding 0.22s ease',
        }}
      >
        {isAbstractOrIface && (
          <span style={{ fontSize: 10, color: '#444444', fontStyle: 'italic', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
            «{cls.isInterface ? 'interface' : 'abstract'}»
          </span>
        )}
        {edit?.kind === 'name' && edit.classId === cls.id ? (
          <input
            autoFocus
            value={edit.val}
            onChange={e => onEditChange({ ...edit, val: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') onSaveName(edit.val); if (e.key === 'Escape') onCancelEdit(); }}
            onBlur={() => onSaveName(edit.val)}
            onClick={e => e.stopPropagation()}
            style={{
              width: '94%',
              textAlign: 'center',
              border: `2px solid ${UML.primary}`,
              borderRadius: 6,
              padding: '7px 10px',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: UML.fontSans,
              color: UML.ink,
              background: UML.surface,
              outline: 'none',
              boxShadow: `0 0 0 3px ${UML.primaryRing}`,
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
      <div style={{
        borderBottom: `1px solid ${UML.border}`,
        padding: isEditingBox ? '6px 0 4px' : '3px 0 2px',
        background: UML.surface,
        transition: 'padding 0.22s ease',
      }}>
        {cls.attributes.map(attr => (
          <AttrRow
            key={attr.id}
            attr={attr}
            typeOptions={attrTypeOptions}
            expanded={isEditingBox}
            editing={edit?.kind === 'attr' && edit.attrId === attr.id ? edit : null}
            hovered={hoveredAttr === attr.id}
            showDelete={interactive && selected}
            onMouseEnter={() => setHoveredAttr(attr.id)}
            onMouseLeave={() => setHoveredAttr(null)}
            onDoubleClick={() => onStartEditAttr(attr.id)}
            onSave={(n, t, v) => onSaveAttr(attr.id, n, t, v)}
            onCancel={onCancelEdit}
            onDelete={() => onDeleteAttr(attr.id)}
            onEditChange={(n, t, v) => onEditChange({ classId: cls.id, kind: 'attr', attrId: attr.id, name: n, type: t, visibility: v })}
          />
        ))}
        {interactive && <AddAttrRow onClick={onAddAttr} />}
      </div>

      {/* ── Operations section ── */}
      <div style={{
        padding: isEditingBox ? '6px 0 4px' : '3px 0 2px',
        background: '#ffffff',
        minHeight: METH_H,
        transition: 'padding 0.22s ease',
      }}>
        {cls.operations.map(op => (
          <OpRow
            key={op.id}
            op={op}
            returnOptions={opReturnOptions}
            expanded={isEditingBox}
            editing={edit?.kind === 'op' && edit.opId === op.id ? edit : null}
            hovered={hoveredOp === op.id}
            showDelete={interactive && selected}
            onMouseEnter={() => setHoveredOp(op.id)}
            onMouseLeave={() => setHoveredOp(null)}
            onDoubleClick={() => onStartEditOp(op.id)}
            onSave={(n, rt, v) => onSaveOp(op.id, n, rt, v)}
            onCancel={onCancelEdit}
            onDelete={() => onDeleteOp(op.id)}
            onEditChange={(n, rt, v) => onEditChange({ classId: cls.id, kind: 'op', opId: op.id, name: n, returnType: rt, visibility: v })}
          />
        ))}
        {interactive && <AddOpRow onClick={onAddOp} />}
      </div>
    </div>
  );
};

// ── AttrRow ───────────────────────────────────────────────────────────────────

interface AttrRowProps {
  attr: UMLAttribute;
  typeOptions: string[];
  expanded?: boolean;
  editing: EditState | null;
  hovered: boolean;
  showDelete?: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDoubleClick: () => void;
  onSave: (name: string, type: string, visibility: UMLVisibility) => void;
  onCancel: () => void;
  onDelete: () => void;
  onEditChange: (name: string, type: string, visibility: UMLVisibility) => void;
}

const AttrRow: React.FC<AttrRowProps> = ({
  attr, typeOptions, expanded = false, editing, hovered, showDelete = false, onMouseEnter, onMouseLeave,
  onDoubleClick, onSave, onCancel, onDelete, onEditChange,
}) => {
  const editFieldStyle: React.CSSProperties = expanded
    ? {
        ...attrFieldStyle,
        fontSize: 13,
        padding: '4px 6px',
        borderRadius: 5,
        border: `2px solid ${UML.primaryBorder}`,
      }
    : attrFieldStyle;

  if (editing && editing.kind === 'attr') {
    const selectValue = typeOptions.includes(editing.type)
      ? editing.type
      : (typeOptions[0] ?? 'String');

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: expanded ? 6 : 2,
        padding: expanded ? '6px 12px' : '1px 6px',
        minHeight: expanded ? EDIT_ATTR_ROW : ATTR_ROW,
        flexWrap: 'nowrap',
      }}>
        <select
          value={editing.visibility}
          onMouseDown={e => e.preventDefault()}
          onChange={e => {
            const visibility = e.target.value as UMLVisibility;
            const name = (e.currentTarget.closest('div')?.querySelector('input') as HTMLInputElement | null)?.value ?? editing.name;
            onEditChange(name, editing.type, visibility);
            onSave(name, editing.type, visibility);
          }}
          style={{ ...editFieldStyle, width: expanded ? 42 : 34, flexShrink: 0, padding: '2px 2px' }}
          title="Visibility"
        >
          {UML_VISIBILITY_OPTIONS.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <input
          autoFocus
          value={editing.name}
          onChange={e => onEditChange(e.target.value, editing.type, editing.visibility)}
          onBlur={e => onSave(e.currentTarget.value, editing.type, editing.visibility)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(editing.name, editing.type, editing.visibility); if (e.key === 'Escape') onCancel(); }}
          style={{ ...editFieldStyle, flex: 1, minWidth: expanded ? 72 : 40 }}
        />
        <span style={{ color: UML.textMuted, flexShrink: 0 }}>:</span>
        <select
          value={selectValue}
          onMouseDown={e => e.preventDefault()}
          onChange={e => {
            const type = e.target.value;
            const name = (e.currentTarget.closest('div')?.querySelector('input') as HTMLInputElement | null)?.value ?? editing.name;
            onEditChange(name, type, editing.visibility);
            onSave(name, type, editing.visibility);
          }}
          onKeyDown={e => {
            const v = e.currentTarget.value;
            if (e.key === 'Enter') onSave(editing.name, v, editing.visibility);
            if (e.key === 'Escape') onCancel();
          }}
          title="Attribute type (primitive only)"
          style={{ ...editFieldStyle, width: expanded ? 96 : 76, color: UML.primary, fontWeight: 600 }}
        >
          {typeOptions.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
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
      <span style={{ color: '#64748b', flexShrink: 0 }}>{attr.visibility ?? '+'}</span>
      <span style={{ color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {attr.name}
      </span>
      <span style={{ color: '#94a3b8', flexShrink: 0 }}>:</span>
      <span style={{ color: UML.primary, flexShrink: 0, fontWeight: 600 }}>{normalizeAttributeTypeDisplay(attr.type)}</span>
      {showDelete && (
        <button
          type="button"
          data-no-drag
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Delete attribute"
          style={{
            flexShrink: 0,
            width: 18,
            height: 18,
            border: 'none',
            borderRadius: 4,
            background: hovered ? '#fee2e2' : '#fef2f2',
            cursor: 'pointer',
            color: '#dc2626',
            fontSize: 11,
            padding: 0,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 'auto',
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
        color: hov ? UML.primary : UML.textMuted,
        transition: 'color 0.1s',
        fontFamily: UML.fontSans,
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
      <span style={{ fontSize: 10 }}>Add attribute</span>
    </div>
  );
};

// ── OpRow ─────────────────────────────────────────────────────────────────────

interface OpRowProps {
  op: UMLOperation;
  returnOptions: string[];
  expanded?: boolean;
  editing: EditState | null;
  hovered: boolean;
  showDelete?: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDoubleClick: () => void;
  onSave: (name: string, returnType: string, visibility: UMLVisibility) => void;
  onCancel: () => void;
  onDelete: () => void;
  onEditChange: (name: string, returnType: string, visibility: UMLVisibility) => void;
}

const OpRow: React.FC<OpRowProps> = ({
  op, returnOptions, expanded = false, editing, hovered, showDelete = false,
  onMouseEnter, onMouseLeave, onDoubleClick, onSave, onCancel, onDelete, onEditChange,
}) => {
  const editFieldStyle: React.CSSProperties = expanded
    ? { ...attrFieldStyle, fontSize: 13, padding: '4px 6px', borderRadius: 5, border: `2px solid ${UML.primaryBorder}` }
    : attrFieldStyle;

  if (editing && editing.kind === 'op') {
    const selectValue = returnOptions.includes(editing.returnType)
      ? editing.returnType
      : (returnOptions[0] ?? 'Void');
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: expanded ? 6 : 2,
        padding: expanded ? '6px 12px' : '1px 6px',
        minHeight: expanded ? EDIT_ATTR_ROW : ATTR_ROW, flexWrap: 'nowrap',
      }}>
        <select
          value={editing.visibility}
          onMouseDown={e => e.preventDefault()}
          onChange={e => {
            const visibility = e.target.value as UMLVisibility;
            const name = (e.currentTarget.closest('div')?.querySelector('input') as HTMLInputElement | null)?.value ?? editing.name;
            onEditChange(name, editing.returnType, visibility);
            onSave(name, editing.returnType, visibility);
          }}
          style={{ ...editFieldStyle, width: expanded ? 42 : 34, flexShrink: 0 }}
        >
          {UML_VISIBILITY_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <input
          autoFocus
          value={editing.name}
          onChange={e => onEditChange(e.target.value, editing.returnType, editing.visibility)}
          onBlur={e => onSave(e.currentTarget.value, editing.returnType, editing.visibility)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(editing.name, editing.returnType, editing.visibility); if (e.key === 'Escape') onCancel(); }}
          style={{ ...editFieldStyle, flex: 1, minWidth: expanded ? 72 : 40 }}
        />
        <span style={{ color: UML.textMuted, flexShrink: 0 }}>() :</span>
        <select
          value={selectValue}
          onMouseDown={e => e.preventDefault()}
          onChange={e => {
            const returnType = e.target.value;
            const name = (e.currentTarget.closest('div')?.querySelector('input') as HTMLInputElement | null)?.value ?? editing.name;
            onEditChange(name, returnType, editing.visibility);
            onSave(name, returnType, editing.visibility);
          }}
          style={{ ...editFieldStyle, width: expanded ? 86 : 68, color: UML.primary, fontWeight: 600 }}
        >
          {returnOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDoubleClick={onDoubleClick}
      style={{
        display: 'flex', alignItems: 'center', padding: '0 6px', height: ATTR_ROW,
        background: hovered ? '#f8fafc' : 'transparent', cursor: 'default', gap: 3,
      }}
    >
      <span style={{ color: '#64748b', flexShrink: 0 }}>{op.visibility ?? '+'}</span>
      <span style={{ color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {op.name}()
      </span>
      <span style={{ color: '#94a3b8', flexShrink: 0 }}>:</span>
      <span style={{ color: UML.primary, flexShrink: 0, fontWeight: 600 }}>{normalizeOperationReturnType(op.returnType)}</span>
      {showDelete && (
        <button type="button" data-no-drag onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Delete operation"
          style={{
            flexShrink: 0, width: 18, height: 18, border: 'none', borderRadius: 4,
            background: hovered ? '#fee2e2' : '#fef2f2', cursor: 'pointer', color: '#dc2626',
            fontSize: 11, padding: 0, marginLeft: 'auto',
          }}>✕</button>
      )}
    </div>
  );
};

const AddOpRow: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <div data-no-drag onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        height: ADD_BTN_H, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 4,
        cursor: 'pointer', color: hov ? UML.primary : UML.textMuted, fontFamily: UML.fontSans,
      }}>
      <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
      <span style={{ fontSize: 10 }}>Add operation</span>
    </div>
  );
};

const ClassEditPanel: React.FC<{
  cls: CLS;
  classes: CLS[];
  parentId: string | null;
  onUpdate: (patch: Partial<Pick<CLS, 'name' | 'isAbstract' | 'isInterface'>>) => void;
  onSetParent: (parentId: string | null) => void;
  onDelete: () => void;
  onClose: () => void;
}> = ({ cls, classes, parentId, onUpdate, onSetParent, onDelete, onClose }) => (
  <div
    data-class-edit-panel
    style={{
      position: 'absolute', top: DIAGRAM_HINT_TOP, left: 12, bottom: 12, zIndex: 35,
      width: 268, background: UML.surface, border: `1px solid ${UML.primaryBorder}`,
      borderRadius: 10, boxShadow: `0 8px 24px ${UML.primaryRing}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: UML.fontSans,
    }}
    onClick={e => e.stopPropagation()}
    onMouseDown={e => e.stopPropagation()}
  >
    <div style={{
      padding: '10px 14px', borderBottom: `1px solid ${UML.border}`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
      background: `linear-gradient(180deg, ${UML.primarySoft} 0%, ${UML.surface} 100%)`,
    }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: UML.primary, textTransform: 'uppercase' }}>Class</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: UML.ink, marginTop: 3 }}>Edit class</div>
      </div>
      <button type="button" onClick={onClose} title="Close panel" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: UML.textMuted, fontSize: 14 }}>✕</button>
    </div>
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
      <label style={panelLabelStyle}>Class name</label>
      <input
        value={cls.name}
        onChange={e => onUpdate({ name: e.target.value })}
        style={{ ...panelInputStyle, marginBottom: 14 }}
      />
      <label style={{ ...panelLabelStyle, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', fontSize: 12 }}>
        <input type="checkbox" checked={cls.isAbstract} onChange={e => onUpdate({ isAbstract: e.target.checked })} />
        Abstract class
      </label>
      <label style={{ ...panelLabelStyle, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', fontSize: 12, marginBottom: 14 }}>
        <input type="checkbox" checked={cls.isInterface} onChange={e => onUpdate({ isInterface: e.target.checked })} />
        Interface
      </label>
      <label style={panelLabelStyle}>Superclass (inheritance)</label>
      <select
        value={parentId ?? ''}
        onChange={e => onSetParent(e.target.value || null)}
        style={{ ...panelInputStyle, marginBottom: 14 }}
      >
        <option value="">(none)</option>
        {classes.filter(c => c.id !== cls.id).map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={onDelete}
        style={{
          width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #fecaca',
          background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Delete class
      </button>
    </div>
    <div style={{ padding: '8px 14px', borderTop: `1px solid ${UML.border}`, fontSize: 10, color: UML.textMuted, lineHeight: 1.45 }}>
      Edit attributes and operations on the class box · Close with ✕
    </div>
  </div>
);

const DiagramToolButton: React.FC<{
  title: string;
  label?: string;
  active?: boolean;
  disabled?: boolean;
  accent?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, label, active = false, disabled = false, accent = false, onClick, children }) => {
  const [hov, setHov] = useState(false);
  const accentColor = UML.primary;
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 34,
        minWidth: label ? 76 : 34,
        padding: label ? '0 10px' : 0,
        border: `1px solid ${active ? accentColor : UML.border}`,
        borderRadius: 8,
        background: disabled
          ? UML.surfaceMuted
          : active
            ? UML.primarySoft
            : accent && hov
              ? UML.primarySoft
              : hov
                ? '#f0fdfa'
                : UML.surface,
        color: disabled
          ? '#cbd5e1'
          : active || accent
            ? accentColor
            : hov
              ? UML.ink
              : UML.textMuted,
        boxShadow: active || (hov && !disabled) ? `0 0 0 2px ${UML.primaryRing}` : 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: UML.fontSans,
        transition: 'all 0.12s',
      }}
    >
      {children}
      {label && <span>{label}</span>}
    </button>
  );
};

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconUndo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7h11a5 5 0 0 1 0 10H3" />
    <polyline points="7 3 3 7 7 11" />
  </svg>
);

const IconRedo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 7H10a5 5 0 0 0 0 10h11" />
    <polyline points="17 3 21 7 17 11" />
  </svg>
);

const IconConnect = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 17H7A5 5 0 0 1 7 7h2" />
    <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);

const IconSave = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
  </svg>
);

const panelInputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 12,
  border: `1px solid ${UML.border}`,
  borderRadius: 8,
  padding: '6px 9px',
  boxSizing: 'border-box',
  fontFamily: UML.fontSans,
  color: UML.ink,
};

const RelationshipEditPanel: React.FC<{
  rel: UMLRelationship;
  classes: CLS[];
  onUpdate: (patch: Partial<UMLRelationship>) => void;
  onSwapEndpoints: () => void;
  onClose: () => void;
}> = ({ rel, classes, onUpdate, onSwapEndpoints, onClose }) => {
  return (
    <div
      data-rel-edit-panel
      style={{
        position: 'absolute',
        top: DIAGRAM_HINT_TOP,
        right: 12,
        bottom: 12,
        zIndex: 35,
        width: 268,
        background: UML.surface,
        border: `1px solid ${UML.primaryBorder}`,
        borderRadius: 10,
        boxShadow: `0 8px 24px ${UML.primaryRing}, 0 0 0 1px rgba(4,148,132,0.05)`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: UML.fontSans,
      }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <div style={{
        padding: '10px 14px',
        borderBottom: `1px solid ${UML.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
        background: `linear-gradient(180deg, ${UML.primarySoft} 0%, ${UML.surface} 100%)`,
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: UML.primary, textTransform: 'uppercase' }}>
            Connection
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: UML.ink, marginTop: 3 }}>
            Edit relationship
          </div>
        </div>
        <button type="button" onClick={onClose} title="Close panel" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: UML.textMuted, padding: 2, fontSize: 14, lineHeight: 1 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        <label style={panelLabelStyle}>From class</label>
        <select
          value={rel.sourceId}
          onChange={e => {
            const next = e.target.value;
            if (next !== rel.targetId) onUpdate({ sourceId: next });
          }}
          style={{ ...panelInputStyle, marginBottom: 8 }}
        >
          {classes.map(c => (
            <option key={c.id} value={c.id} disabled={c.id === rel.targetId}>{c.name}</option>
          ))}
        </select>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 10px' }}>
          <button
            type="button"
            onClick={onSwapEndpoints}
            title="Swap direction"
            style={{
              border: `1px solid ${UML.primaryBorder}`,
              borderRadius: 8,
              background: UML.primarySoft,
              color: UML.primary,
              fontSize: 11,
              fontWeight: 600,
              padding: '5px 12px',
              cursor: 'pointer',
            }}
          >
            ⇄ Swap direction
          </button>
        </div>

        <label style={panelLabelStyle}>To class</label>
        <select
          value={rel.targetId}
          onChange={e => {
            const next = e.target.value;
            if (next !== rel.sourceId) onUpdate({ targetId: next });
          }}
          style={{ ...panelInputStyle, marginBottom: 14 }}
        >
          {classes.map(c => (
            <option key={c.id} value={c.id} disabled={c.id === rel.sourceId}>{c.name}</option>
          ))}
        </select>

        <label style={panelLabelStyle}>Connection name</label>
        <input
          value={rel.label ?? ''}
          onChange={e => onUpdate({ label: e.target.value })}
          placeholder="e.g. manages, contains"
          style={{ ...panelInputStyle, marginBottom: 14 }}
        />

        <label style={panelLabelStyle}>Type</label>
        <select
          value={rel.type}
          onChange={e => onUpdate({ type: e.target.value as UMLRelType })}
          style={{ ...panelInputStyle, marginBottom: 14 }}
        >
          {(Object.keys(REL_TYPE_LABELS) as UMLRelType[]).map(t => (
            <option key={t} value={t}>{REL_TYPE_LABELS[t]}</option>
          ))}
        </select>

        {rel.type !== 'inheritance' && (
          <>
            <label style={panelLabelStyle}>Source multiplicity</label>
            <select
              value={normalizeMultiplicityDisplay(rel.sourceMultiplicity)}
              onChange={e => onUpdate({
                sourceMultiplicity: e.target.value ? e.target.value : undefined,
              })}
              style={{ ...panelInputStyle, marginBottom: 14 }}
            >
              {relationshipMultiplicitySelectOptions(rel.sourceMultiplicity).map(m => (
                <option key={`src-${m || 'none'}`} value={m}>
                  {UML_RELATIONSHIP_MULTIPLICITY_LABELS[m] ?? m}
                </option>
              ))}
            </select>
            <label style={panelLabelStyle}>Target multiplicity</label>
            <select
              value={normalizeMultiplicityDisplay(rel.targetMultiplicity)}
              onChange={e => onUpdate({
                targetMultiplicity: e.target.value ? e.target.value : undefined,
              })}
              style={panelInputStyle}
            >
              {relationshipMultiplicitySelectOptions(rel.targetMultiplicity).map(m => (
                <option key={`tgt-${m || 'none'}`} value={m}>
                  {UML_RELATIONSHIP_MULTIPLICITY_LABELS[m] ?? m}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <div style={{ padding: '8px 14px', borderTop: `1px solid ${UML.border}`, fontSize: 10, color: UML.textMuted, lineHeight: 1.45 }}>
        Double-click a line to cycle type · Delete key removes selection · Close with ✕
      </div>
    </div>
  );
};

const panelLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: UML.textMuted,
  marginBottom: 5,
};
