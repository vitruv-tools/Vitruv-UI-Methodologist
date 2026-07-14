import React, { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle, type RefObject } from 'react';
import { ecoreToUml, UMLAttribute, UMLRelationship, UMLRelType, UMLModel, UMLVisibility, UMLOperation, buildAttributeTypeOptions, buildOperationReturnTypeOptions, normalizeAttributeTypeDisplay, normalizeOperationReturnType, nextUniqueAttributeName, nextUniqueOperationName, UML_VISIBILITY_OPTIONS } from '../../utils/ecoreToUml';
import { saveMetaModelEcore, MetaModelSaveMetadata } from '../../utils/saveMetaModelEcore';
import { umlSemanticSnapshot, umlToEcore } from '../../utils/umlToEcore';
import {
  normalizeMultiplicityDisplay,
  relationshipMultiplicitySelectOptions,
  UML_RELATIONSHIP_MULTIPLICITY_LABELS,
} from '../../utils/umlMultiplicity';
import { validateUmlModel } from '../../utils/umlValidation';
import { extractNsUriFromEcore } from '../../utils/ecoreParser';
import { ReactionConfigPopup } from './ReactionConfigPopup';
import { ReactionConfig, ReactionEdge, ReactionsModel } from '../../types/reactions';
import { ReactionEditorModal } from '../flow/ReactionEditorModal';
import { CodeEditorState } from '../flow/flowCanvasTypes';
import { buildInitialReactionCodeFromConfig } from '../../utils/reactionCode';
import { fetchReactionCode, persistReactionCode } from '../../utils/reactionFile';
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
  resolveMultiplicityBadgeCollisions,
  type AxisRect,
  type LineBridge,
  type MultiplicityBadge,
} from '../../utils/umlDiagramGeometry';
import { UMLDiagramMinimap } from './UMLDiagramMinimap';
import { computeUmlModelGroups } from '../../utils/umlModelGroups';

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
const MULT_ALONG_OFFSET = 52;
const MULT_PERP_OFFSET = 10;
const MARKER_MULT_EXTRA_OFFSET = 18;
const MULT_BADGE_HALF_W = 18;
const MULT_BADGE_HALF_H = 12;
const MULT_CLASS_CLEARANCE = 8;

function multiplicityPosition(
  x1: number, y1: number, x2: number, y2: number,
  end: 'start' | 'end',
  hasDirectionMarker = false,
): { x: number; y: number; anchorX: number; anchorY: number; lineUx: number; lineUy: number; nx: number; ny: number; lineLength: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(Math.hypot(dx, dy), 0.0001);
  const lineUx = dx / len;
  const lineUy = dy / len;
  const nx = -lineUy;
  const ny = lineUx;
  const markerExtra = hasDirectionMarker ? MARKER_MULT_EXTRA_OFFSET : 0;
  const idealAlong = MULT_ALONG_OFFSET + markerExtra;
  const maxAlong = Math.max(26, (len - MULT_BADGE_HALF_H * 2 - 10) / 2);
  const alongMag = Math.min(idealAlong, maxAlong);
  const along = end === 'start' ? alongMag : -alongMag;
  const anchorX = end === 'start' ? x1 : x2;
  const anchorY = end === 'start' ? y1 : y2;
  const perp = len < 120
    ? MULT_PERP_OFFSET + Math.min(28, (120 - len) * 0.35)
    : MULT_PERP_OFFSET;
  return {
    anchorX,
    anchorY,
    lineUx,
    lineUy,
    nx,
    ny,
    lineLength: len,
    x: anchorX + lineUx * along + nx * perp,
    y: anchorY + lineUy * along + ny * perp,
  };
}

function buildClassObstacleRects(classes: CLS[], offsetX: number, offsetY: number): AxisRect[] {
  return classes.map(cls => ({
    left: cls.x + offsetX - MULT_CLASS_CLEARANCE,
    top: cls.y + offsetY - MULT_CLASS_CLEARANCE,
    right: cls.x + offsetX + BW + MULT_CLASS_CLEARANCE,
    bottom: cls.y + offsetY + boxH(cls) + MULT_CLASS_CLEARANCE,
  }));
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

const REACTION_EDGE_COLOR: Record<EdgeState, string> = {
  default:  '#a855f7',
  hovered:  '#9333ea',
  selected: '#7e22ce',
};

function reactionArrowSvg(color: string): React.ReactNode {
  return <path d="M 0 0 L 12 6 L 0 12 z" fill={color} />;
}

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

type ReactionPortSide = 'left' | 'right';

interface ReactionDragState {
  sourceClassId: string;
  sourceSide: ReactionPortSide;
  startX: number;
  startY: number;
  cursorX: number;
  cursorY: number;
}

function getReactionPortPosition(
  cls: CLS,
  offsetX: number,
  offsetY: number,
  side: ReactionPortSide,
): { x: number; y: number } {
  const h = boxH(cls);
  return {
    x: side === 'left' ? cls.x + offsetX : cls.x + offsetX + BW,
    y: cls.y + offsetY + h / 2,
  };
}

interface ReactionClassContext {
  modelId: number;
  modelName: string;
  modelUrl: string;
  className: string;
}

function parseAdditionalModelId(classId: string): number | null {
  const match = /^addl-(\d+)-/.exec(classId);
  return match ? Number(match[1]) : null;
}

function resolveReactionClassContext(
  classId: string,
  className: string,
  primaryEcore: string,
  primaryName: string,
  primaryModelId: number,
  reactionModels: ReactionsModel[],
): ReactionClassContext {
  const additionalModelId = parseAdditionalModelId(classId);
  if (additionalModelId != null) {
    const model = reactionModels.find(m => m.id === additionalModelId);
    if (model) {
      return {
        modelId: model.id,
        modelName: model.name,
        modelUrl: extractNsUriFromEcore(model.ecoreContent) ?? `http://vitruv.tools/${model.name}`,
        className,
      };
    }
  }

  const primaryModel = reactionModels.find(m => m.name === primaryName) ?? reactionModels[0];
  return {
    modelId: primaryModel?.id ?? primaryModelId,
    modelName: primaryName,
    modelUrl: extractNsUriFromEcore(primaryEcore) ?? `http://vitruv.tools/${primaryName}`,
    className,
  };
}

function buildDefaultReactionConfig(
  source: ReactionClassContext,
  target: ReactionClassContext,
): ReactionConfig {
  return {
    bidirectional: false,
    reactionName: `${source.className}_${target.className}`,
    model1Url: source.modelUrl,
    model2Url: target.modelUrl,
    model1Alias: source.modelName,
    model2Alias: target.modelName,
    model1RootType: source.className,
    model2RootType: target.className,
    model1RootVal: source.className,
  };
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
  reactionEdge?: ReactionEdge;
}

const RelationLine: React.FC<RelationLineProps> = ({
  rel, p1, p2, drawP1, drawP2, bridges, state, reactionEdge,
}) => {
  const strokeColor = reactionEdge ? REACTION_EDGE_COLOR[state] : EDGE_COLOR[state];
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
  reactionEdge?: ReactionEdge;
  onRelClick: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const RelationDirectionMarker: React.FC<RelationDirectionMarkerProps> = ({
  rel, lineStart, lineEnd, color, reactionEdge, onRelClick, onMouseEnter, onMouseLeave,
}) => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const baseRotation = Math.atan2(dy, dx) * (180 / Math.PI);

  const renderMarker = (
    side: DirectionMarkerSide,
    graphic: React.ReactNode,
    rotation: number,
    markerKey: string,
  ) => {
    const lineAnchor = side === 'start' ? lineStart : lineEnd;
    const { x, y } = directionMarkerAnchor(lineAnchor);
    const markerSize = reactionEdge ? 18 : directionMarkerSize(rel.type);
    const viewBox = reactionEdge ? '0 0 12 12' : directionMarkerViewBox(rel.type);

    return (
      <button
        key={markerKey}
        type="button"
        data-rel-direction-marker
        data-rel-id={rel.id}
        aria-label={rel.label ? `Select relationship: ${rel.label}` : `Select ${rel.type} relationship`}
        onClick={onRelClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg)`,
          transition: 'none',
          pointerEvents: 'auto',
          cursor: 'pointer',
          zIndex: 5,
          lineHeight: 0,
          border: 'none',
          background: 'transparent',
          padding: 0,
        }}
      >
        <svg
          width={markerSize}
          height={markerSize}
          viewBox={viewBox}
          overflow="visible"
          aria-hidden="true"
        >
          {graphic}
        </svg>
      </button>
    );
  };

  if (reactionEdge) {
    const arrow = reactionArrowSvg(color);
    const markers = reactionEdge.config.bidirectional
      ? [
          { side: 'start' as const, rotation: baseRotation + 180, key: 'start' },
          { side: 'end' as const, rotation: baseRotation, key: 'end' },
        ]
      : [{ side: 'end' as const, rotation: baseRotation, key: 'end' }];

    return (
      <>
        {markers.map(marker => renderMarker(marker.side, arrow, marker.rotation, `${rel.id}-${marker.key}`))}
      </>
    );
  }

  const side = getDirectionMarkerSide(rel.type);
  const graphic = directionMarkerSvg(rel.type, color);
  if (!side || !graphic) return null;

  return renderMarker(side, graphic, baseRotation, rel.id);
};

function isEmptyCanvasTarget(target: HTMLElement): boolean {
  return !target.closest('[data-classbox]')
    && !target.closest('[data-rel-hit-line]')
    && !target.closest('[data-rel-direction-marker]')
    && !target.closest('[data-uml-toolbar]')
    && !target.closest('[data-rel-edit-panel]')
    && !target.closest('[data-class-edit-panel]')
    && !target.closest('[data-uml-connect-banner]')
    && !target.closest('[data-uml-validation]')
    && !target.closest('[data-wrapper-header]')
    && !target.closest('[data-reaction-port]')
    && !target.closest('[data-reaction-edit-panel]');
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

function remapAttributeIds(attributes: UMLAttribute[], classId: string): UMLAttribute[] {
  return attributes.map((attribute, index) => ({
    ...attribute,
    id: `${classId}-${index}`,
  }));
}

function remapOperationIds(operations: UMLOperation[], classId: string): UMLOperation[] {
  return operations.map((operation, index) => ({
    ...operation,
    id: `${classId}-op-${index}`,
  }));
}

function renameClassInList(
  classes: CLS[],
  oldId: string,
  newId: string,
  trimmedName: string,
): CLS[] {
  return classes.map(classItem => {
    if (classItem.id !== oldId) return classItem;
    return {
      ...classItem,
      id: newId,
      name: trimmedName,
      attributes: remapAttributeIds(classItem.attributes, newId),
      operations: remapOperationIds(classItem.operations, newId),
    };
  });
}

function renameClassInRelationships(
  relationships: UMLRelationship[],
  oldId: string,
  newId: string,
): UMLRelationship[] {
  return relationships.map(relationship => ({
    ...relationship,
    sourceId: relationship.sourceId === oldId ? newId : relationship.sourceId,
    targetId: relationship.targetId === oldId ? newId : relationship.targetId,
  }));
}

function updateClassById(
  classes: CLS[],
  classId: string,
  updater: (classItem: CLS) => CLS,
): CLS[] {
  return classes.map(classItem =>
    (classItem.id === classId ? updater(classItem) : classItem),
  );
}

function removeAttributeFromClass(classItem: CLS, attrId: string): CLS {
  return {
    ...classItem,
    attributes: classItem.attributes.filter(attribute => attribute.id !== attrId),
  };
}

function removeOperationFromClass(classItem: CLS, opId: string): CLS {
  return {
    ...classItem,
    operations: classItem.operations.filter(operation => operation.id !== opId),
  };
}

function patchAttribute(
  attribute: UMLAttribute,
  attrId: string,
  resolvedName: string,
  type: string,
  visibility: UMLVisibility,
): UMLAttribute {
  if (attribute.id === attrId) {
    return {
      ...attribute,
      name: resolvedName,
      type: normalizeAttributeTypeDisplay(type.trim() || attribute.type),
      visibility,
    };
  }
  return attribute;
}

function getOtherAttributeNames(attributes: UMLAttribute[], attrId: string): string[] {
  const otherNames: string[] = [];
  for (const attribute of attributes) {
    if (attribute.id !== attrId) otherNames.push(attribute.name);
  }
  return otherNames;
}

function applyAttributeSaveToClass(
  classItem: CLS,
  classId: string,
  attrId: string,
  name: string,
  type: string,
  visibility: UMLVisibility,
): CLS {
  if (classItem.id !== classId) return classItem;
  const current = classItem.attributes.find(attribute => attribute.id === attrId);
  if (!current) return classItem;
  const otherNames = getOtherAttributeNames(classItem.attributes, attrId);
  const trimmed = name.trim();
  const resolvedName = trimmed
    ? nextUniqueAttributeName(otherNames, trimmed)
    : current.name;
  return {
    ...classItem,
    attributes: classItem.attributes.map(attribute =>
      patchAttribute(attribute, attrId, resolvedName, type, visibility),
    ),
  };
}

function updateClassAttribute(
  classes: CLS[],
  classId: string,
  attrId: string,
  name: string,
  type: string,
  visibility: UMLVisibility,
): CLS[] {
  return classes.map(classItem =>
    applyAttributeSaveToClass(classItem, classId, attrId, name, type, visibility),
  );
}

function patchOperation(
  operation: UMLOperation,
  opId: string,
  resolvedName: string,
  returnType: string,
  visibility: UMLVisibility,
): UMLOperation {
  if (operation.id === opId) {
    return {
      ...operation,
      name: resolvedName,
      returnType: normalizeOperationReturnType(returnType.trim() || operation.returnType),
      visibility,
    };
  }
  return operation;
}

function getOtherOperationNames(operations: UMLOperation[], opId: string): string[] {
  const otherNames: string[] = [];
  for (const operation of operations) {
    if (operation.id !== opId) otherNames.push(operation.name);
  }
  return otherNames;
}

function applyOperationSaveToClass(
  classItem: CLS,
  classId: string,
  opId: string,
  name: string,
  returnType: string,
  visibility: UMLVisibility,
): CLS {
  if (classItem.id !== classId) return classItem;
  const current = classItem.operations.find(operation => operation.id === opId);
  if (!current) return classItem;
  const otherNames = getOtherOperationNames(classItem.operations, opId);
  const trimmed = name.trim();
  const resolvedName = trimmed
    ? nextUniqueOperationName(otherNames, trimmed)
    : current.name;
  return {
    ...classItem,
    operations: classItem.operations.map(operation =>
      patchOperation(operation, opId, resolvedName, returnType, visibility),
    ),
  };
}

function updateClassOperation(
  classes: CLS[],
  classId: string,
  opId: string,
  name: string,
  returnType: string,
  visibility: UMLVisibility,
): CLS[] {
  return classes.map(classItem =>
    applyOperationSaveToClass(classItem, classId, opId, name, returnType, visibility),
  );
}

function mergeAdditionalClassesWithPositions(prev: CLS[], newCls: CLS[]): CLS[] {
  return newCls.map(nc => {
    const existing = prev.find(p => p.id === nc.id);
    return existing ? { ...nc, x: existing.x, y: existing.y } : nc;
  });
}

function applyWrapperDragToClass(
  c: CLS,
  origins: Map<string, { x: number; y: number }>,
  dx: number,
  dy: number,
): CLS {
  const orig = origins.get(c.id);
  if (!orig) return c;
  return { ...c, x: orig.x + dx, y: orig.y + dy };
}

function getReactionPortTargetClassId(hit: HTMLElement | null, sourceClassId: string): string | null {
  const port = hit?.closest('[data-reaction-port]') as HTMLElement | null;
  const targetClassId = port?.dataset.classId;
  if (!targetClassId || targetClassId === sourceClassId) return null;
  return targetClassId;
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
  /** Additional models to render in the same canvas with colored wrapper groups. */
  additionalModels?: { id: number; name: string; ecoreContent: string; color: string; fill: string }[];
  /** Called when the user removes an added (non-primary) meta model from the view. */
  onRemoveAdditionalModel?: (modelName: string) => void;
  /** When 'reactions', elements show connection indicators. */
  reactionsMode?: 'uml' | 'reactions';
  /** Models available in the reactions view for resolving URLs and aliases. */
  reactionModels?: ReactionsModel[];
  /** VSUM project id for Reaction Editor LSP connection. */
  vsumId?: string;
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

function isKeyboardInputField(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function tryHandleUndoRedoShortcut(
  e: KeyboardEvent,
  inField: boolean,
  handleUndo: () => void,
  handleRedo: () => void,
): boolean {
  if (!((e.ctrlKey || e.metaKey) && !inField)) return false;
  const key = e.key.toLowerCase();
  if (key === 'z') {
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey) handleRedo();
    else handleUndo();
    return true;
  }
  if (key === 'y') {
    e.preventDefault();
    e.stopPropagation();
    handleRedo();
    return true;
  }
  return false;
}

function tryHandleEscapeShortcut(e: KeyboardEvent, tryEscape: () => boolean): void {
  if (e.key !== 'Escape') return;
  if (tryEscape()) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function tryHandleDeleteShortcut(
  e: KeyboardEvent,
  inField: boolean,
  selectedRelId: string | null,
  selectedClassId: string | null,
  handleDeleteSelected: () => void,
): void {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  if (inField) return;
  if (!selectedRelId && !selectedClassId) return;
  e.preventDefault();
  handleDeleteSelected();
}

function getDiagramCursor(panning: boolean, connectMode: boolean): React.CSSProperties['cursor'] {
  if (panning) return 'grabbing';
  if (connectMode) return 'crosshair';
  return 'default';
}

function getSaveButtonTitle(hasUnsavedChanges: boolean, saveContext: UmlDiagramSaveContext): string {
  if (!hasUnsavedChanges) return 'No unsaved changes';
  if (saveContext.saveTarget === 'workspace') return 'Save changes to project';
  return 'Save metamodel changes';
}

function classesShareModel(
  classIdA: string,
  classIdB: string,
  classModelMap: Map<string, { name: string; color: string; fill: string }>,
): boolean {
  const modelA = classModelMap.get(classIdA)?.name;
  const modelB = classModelMap.get(classIdB)?.name;
  if (!modelA || !modelB) return false;
  return modelA === modelB;
}

function getConnectModeHint(connectSourceId: string | null, multiModel: boolean): string {
  if (connectSourceId) {
    return multiModel
      ? 'Click a target class in the same model'
      : 'Click the target class to create a connection';
  }
  return multiModel
    ? 'Click the source class, then another class in the same model'
    : 'Click the source class, then the target class';
}

function getValidationBannerInset(
  selectedClass: CLS | null | undefined,
  selectedRel: UMLRelationship | null | undefined,
  reactionPanelOpen = false,
): { left: number; right: number } {
  return {
    left: selectedClass ? 288 : 12,
    right: (selectedRel || reactionPanelOpen) ? 320 : 12,
  };
}

function isSaveMessageSuccess(message: string): boolean {
  return message === 'Saved' || message === 'Saved to project';
}

const UmlEmptyDiagram: React.FC<{ interactive: boolean; onAddClass: () => void }> = ({
  interactive,
  onAddClass,
}) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: '#9ca3af', fontSize: 13, gap: 12,
    ...WORKSPACE_DOT_BACKGROUND,
  }}>
    <span>No UML content found.</span>
    {interactive && (
      <button
        type="button"
        onClick={onAddClass}
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

const UmlSaveMessageBanner: React.FC<{ message: string }> = ({ message }) => {
  const success = isSaveMessageSuccess(message);
  return (
    <div style={{
      position: 'absolute',
      top: 14,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      padding: '8px 16px',
      borderRadius: 8,
      background: success ? '#ecfdf5' : '#fef2f2',
      border: `1px solid ${success ? '#86efac' : '#fecaca'}`,
      color: success ? '#15803d' : '#dc2626',
      fontSize: 13,
      fontWeight: 600,
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      maxWidth: 'min(480px, 90vw)',
      textAlign: 'center',
      pointerEvents: 'none',
    }}>
      {message}
    </div>
  );
};

export const UMLDiagram = forwardRef<UMLDiagramHandle, UMLDiagramProps>(({
  ecoreContent,
  fileName,
  layoutScopeId = 'default',
  interactive = true,
  saveContext,
  onHistoryChange,
  additionalModels = [],
  onRemoveAdditionalModel,
  reactionsMode = 'uml',
  reactionModels = [],
  vsumId,
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

  // Additional models: parse and track classes per model group
  const additionalParsed = useMemo(() => {
    return additionalModels.map((m, i) => {
      try {
        const model = ecoreToUml(m.ecoreContent);
        return {
          ...m,
          classes: model.classes.map(c => ({
            ...c,
            operations: c.operations ?? [],
            id: `addl-${m.id}-${c.id}`,
            x: c.x + (i + 1) * 450,
            y: c.y,
          })),
          relationships: model.relationships.map(r => ({
            ...r,
            id: `addl-${m.id}-${r.id}`,
            sourceId: `addl-${m.id}-${r.sourceId}`,
            targetId: `addl-${m.id}-${r.targetId}`,
          })),
        };
      } catch { return { ...m, classes: [] as CLS[], relationships: [] as UMLRelationship[] }; }
    });
  }, [additionalModels]);

  const [additionalClasses, setAdditionalClasses] = useState<CLS[]>(() =>
    additionalParsed.flatMap(m => m.classes)
  );
  const [additionalRels, setAdditionalRels] = useState<UMLRelationship[]>(() =>
    additionalParsed.flatMap(m => m.relationships)
  );

  useEffect(() => {
    const newCls = additionalParsed.flatMap(m => m.classes);
    setAdditionalClasses(prev => mergeAdditionalClassesWithPositions(prev, newCls));
    setAdditionalRels(additionalParsed.flatMap(m => m.relationships));
  }, [additionalParsed]);

  // Map classId -> model color info for wrapper rendering
  const classModelMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string; fill: string }>();
    // Primary model classes
    for (const cls of classes) {
      if (additionalModels.length > 0) {
        map.set(cls.id, { name: fileName?.replace(/\.ecore$/, '') || 'Primary', color: '#2563eb', fill: 'rgba(37,99,235,0.06)' });
      }
    }
    // Additional model classes
    for (const m of additionalParsed) {
      for (const cls of m.classes) {
        map.set(cls.id, { name: m.name, color: m.color, fill: m.fill });
      }
    }
    return map;
  }, [classes, additionalParsed, additionalModels.length, fileName]);

  // Combined classes and relationships for rendering
  const allClasses = useMemo(() => [...classes, ...additionalClasses], [classes, additionalClasses]);
  const allRels = useMemo(() => [...relationships, ...additionalRels], [relationships, additionalRels]);

  const rels = useMemo(
    () => assignParallelRelMeta(allRels) as DiagramRel[],
    [allRels],
  );

  const modelGroups = useMemo(() => {
    if (additionalModels.length === 0) return [];
    return computeUmlModelGroups(allClasses, classModelMap, boxH, BW);
  }, [additionalModels.length, allClasses, classModelMap]);

  const removableModelNames = useMemo(
    () => new Set(additionalModels.map(m => m.name)),
    [additionalModels],
  );

  const additionalClassIdKey = useMemo(
    () => additionalClasses.map(c => c.id).sort((a, b) => a.localeCompare(b)).join(','),
    [additionalClasses],
  );

  useEffect(() => {
    const validIds = new Set([
      ...classes.map(c => c.id),
      ...additionalClasses.map(c => c.id),
    ]);
    setReactionEdges(prev => {
      const next = prev.filter(e => validIds.has(e.sourceClassId) && validIds.has(e.targetClassId));
      return next.length === prev.length ? prev : next;
    });
    setRelationships(prev => {
      const next = prev.filter(r => validIds.has(r.sourceId) && validIds.has(r.targetId));
      return next.length === prev.length ? prev : next;
    });
    setSelectedRelId(prev => (prev && validIds.has(prev) ? prev : null));
    setEditingReactionId(prev => (prev && validIds.has(prev) ? prev : null));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- prune only when added models change
  }, [additionalClassIdKey]);
  const [edit, setEdit] = useState<EditState | null>(null);
  const editRef = useRef<EditState | null>(null);
  editRef.current = edit;
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null);
  const [hoveredRelId, setHoveredRelId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [reactionDrag, setReactionDrag] = useState<ReactionDragState | null>(null);
  const [reactionEdges, setReactionEdges] = useState<ReactionEdge[]>([]);
  const [editingReactionId, setEditingReactionId] = useState<string | null>(null);
  const [reactionEditorState, setReactionEditorState] = useState<CodeEditorState | null>(null);
  const classesRef = useRef(classes);
  classesRef.current = classes;
  const relationshipsRef = useRef(relationships);
  relationshipsRef.current = relationships;
  const dragHistorySavedRef = useRef(false);
  const reactionDragActiveRef = useRef(false);

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
    if (!layoutOffsetRef.current && allClasses.length > 0) {
      const initial = getLayoutMetrics(allClasses);
      layoutOffsetRef.current = { offsetX: initial.offsetX, offsetY: initial.offsetY };
      return initial;
    }
    return getLayoutMetrics(allClasses, layoutOffsetRef.current);
  }, [allClasses]);
  const { totalW, totalH, offsetX, offsetY } = layout;
  const containerRef = useRef<HTMLElement>(null);

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

  const moveAdditionalClass = useCallback((id: string, x: number, y: number) => {
    setAdditionalClasses(prev => prev.map(c => (c.id === id ? { ...c, x, y } : c)));
  }, []);

  const wrapperDragOrigins = useRef<Map<string, { x: number; y: number }>>(new Map());

  const handleWrapperDragStart = useCallback((e: React.MouseEvent, groupName: string) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const primaryName = fileName?.replace(/\.ecore$/, '') || 'Primary';

    const origins = new Map<string, { x: number; y: number }>();
    const allCurrent = primaryName === groupName ? classes : additionalClasses;
    for (const c of allCurrent) {
      const info = classModelMap.get(c.id);
      if (info?.name === groupName) {
        origins.set(c.id, { x: c.x, y: c.y });
      }
    }
    wrapperDragOrigins.current = origins;

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / vscale;
      const dy = (ev.clientY - startY) / vscale;
      const origins = wrapperDragOrigins.current;
      const applyDrag = (c: CLS) => applyWrapperDragToClass(c, origins, dx, dy);

      if (groupName === primaryName) {
        setClasses(prev => prev.map(applyDrag));
      } else {
        setAdditionalClasses(prev => prev.map(applyDrag));
      }
    };

    const onUp = () => {
      wrapperDragOrigins.current.clear();
      scheduleDebouncedLayoutSave();
      globalThis.removeEventListener('mousemove', onMove);
      globalThis.removeEventListener('mouseup', onUp);
    };

    globalThis.addEventListener('mousemove', onMove);
    globalThis.addEventListener('mouseup', onUp);
  }, [vscale, fileName, classes, additionalClasses, classModelMap, scheduleDebouncedLayoutSave]);

  const saveName = useCallback((oldId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setEdit(null);
      return;
    }
    recordChange();
    const newId = sanitizeUmlClassId(trimmed);
    setClasses(prev => renameClassInList(prev, oldId, newId, trimmed));
    setRelationships(prev => renameClassInRelationships(prev, oldId, newId));
    setSelectedClassId(prev => (prev === oldId ? newId : prev));
    setConnectSourceId(prev => (prev === oldId ? newId : prev));
    setEdit(null);
  }, [recordChange]);

  const saveAttr = useCallback((classId: string, attrId: string, name: string, type: string, visibility: UMLVisibility) => {
    recordChange();
    setClasses(prev => updateClassAttribute(prev, classId, attrId, name, type, visibility));
    setEdit(null);
  }, [recordChange]);

  const saveOp = useCallback((classId: string, opId: string, name: string, returnType: string, visibility: UMLVisibility) => {
    recordChange();
    setClasses(prev => updateClassOperation(prev, classId, opId, name, returnType, visibility));
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

  const handleCanvasDoubleClick = useCallback((e: MouseEvent) => {
    if (!interactive) return;
    if (!isEmptyCanvasTarget(e.target as HTMLElement)) return;
    e.preventDefault();
    e.stopPropagation();
    dismissClassSelection();
  }, [interactive, dismissClassSelection]);

  const handlePanStart = useCallback((e: MouseEvent) => {
    flushPendingEdit();
    if (reactionDragActiveRef.current) return;
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
      globalThis.removeEventListener('mousemove', onMove);
      globalThis.removeEventListener('mouseup', onUp);
    };
    globalThis.addEventListener('mousemove', onMove);
    globalThis.addEventListener('mouseup', onUp);
  }, [scheduleLayoutSave, flushPendingEdit]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('mousedown', handlePanStart);
    el.addEventListener('dblclick', handleCanvasDoubleClick);
    return () => {
      el.removeEventListener('mousedown', handlePanStart);
      el.removeEventListener('dblclick', handleCanvasDoubleClick);
    };
  }, [handlePanStart, handleCanvasDoubleClick, classes.length]);

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
    setClasses(prev => updateClassById(prev, classId, classItem => ({
      ...classItem,
      attributes: [...classItem.attributes, newAttr],
    })));
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
    setClasses(prev => updateClassById(prev, classId, classItem => ({
      ...classItem,
      operations: [...classItem.operations, newOp],
    })));
    setEdit({ classId, kind: 'op', opId: newOp.id, name: newOp.name, returnType: newOp.returnType, visibility: '+' });
  }, [recordChange, flushPendingEdit]);

  const deleteAttr = useCallback((classId: string, attrId: string) => {
    recordChange();
    setClasses(prev => updateClassById(prev, classId, classItem => removeAttributeFromClass(classItem, attrId)));
  }, [recordChange]);

  const deleteOp = useCallback((classId: string, opId: string) => {
    recordChange();
    setClasses(prev => updateClassById(prev, classId, classItem => removeOperationFromClass(classItem, opId)));
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
    if (sourceId === targetId) return false;
    if (additionalModels.length > 0 && !classesShareModel(sourceId, targetId, classModelMap)) {
      return false;
    }
    const exists = relationshipsRef.current.some(
      r => r.sourceId === sourceId && r.targetId === targetId && r.type === 'association',
    );
    if (exists) return false;
    recordChange();
    const newRelId = `rel-${Date.now()}`;
    setRelationships(prev => [...prev, {
      id: newRelId,
      sourceId,
      targetId,
      type: 'association',
      targetMultiplicity: '0..1',
      sourceMultiplicity: '1',
    }]);
    setSelectedRelId(newRelId);
    return true;
  }, [recordChange, additionalModels.length, classModelMap]);

  const primaryModelName = fileName?.replace(/\.ecore$/, '') || 'Primary';
  const primaryModelId = reactionModels[0]?.id ?? 0;

  const addReactionConnection = useCallback((sourceClassId: string, targetClassId: string) => {
    if (sourceClassId === targetClassId) return;

    const sourceClass = allClasses.find(c => c.id === sourceClassId);
    const targetClass = allClasses.find(c => c.id === targetClassId);
    if (!sourceClass || !targetClass) return;

    const exists = relationshipsRef.current.some(
      r => r.sourceId === sourceClassId && r.targetId === targetClassId,
    );
    if (exists) {
      const existing = reactionEdges.find(
        e => e.sourceClassId === sourceClassId && e.targetClassId === targetClassId,
      );
      if (existing) {
        setEditingReactionId(existing.id);
        setSelectedRelId(existing.id);
      }
      return;
    }

    recordChange();
    const newRelId = `reaction-${Date.now()}`;
    const sourceCtx = resolveReactionClassContext(
      sourceClassId,
      sourceClass.name,
      ecoreContent,
      primaryModelName,
      primaryModelId,
      reactionModels,
    );
    const targetCtx = resolveReactionClassContext(
      targetClassId,
      targetClass.name,
      ecoreContent,
      primaryModelName,
      primaryModelId,
      reactionModels,
    );

    const reactionEdge: ReactionEdge = {
      id: newRelId,
      sourceModelId: sourceCtx.modelId,
      sourceClassId,
      sourceClassName: sourceClass.name,
      targetModelId: targetCtx.modelId,
      targetClassId,
      targetClassName: targetClass.name,
      config: buildDefaultReactionConfig(sourceCtx, targetCtx),
    };

    setRelationships(prev => [...prev, {
      id: newRelId,
      sourceId: sourceClassId,
      targetId: targetClassId,
      type: 'association',
      label: reactionEdge.config.reactionName,
    }]);
    setReactionEdges(prev => [...prev, reactionEdge]);
    setSelectedRelId(newRelId);
    setEditingReactionId(newRelId);
    setSelectedClassId(null);
  }, [
    allClasses,
    reactionEdges,
    recordChange,
    ecoreContent,
    primaryModelName,
    primaryModelId,
    reactionModels,
  ]);

  const updateReactionConfig = useCallback((reactionId: string, config: ReactionConfig) => {
    setReactionEdges(prev => prev.map(edge =>
      edge.id === reactionId ? { ...edge, config } : edge,
    ));
    setRelationships(prev => prev.map(rel =>
      rel.id === reactionId ? { ...rel, label: config.reactionName } : rel,
    ));
  }, []);

  const deleteReaction = useCallback((reactionId: string) => {
    recordChange();
    setReactionEdges(prev => prev.filter(edge => edge.id !== reactionId));
    setRelationships(prev => prev.filter(rel => rel.id !== reactionId));
    if (editingReactionId === reactionId) setEditingReactionId(null);
    if (selectedRelId === reactionId) setSelectedRelId(null);
    if (reactionEditorState?.edgeId === reactionId) setReactionEditorState(null);
  }, [recordChange, editingReactionId, selectedRelId, reactionEditorState?.edgeId]);

  const openReactionEditor = useCallback(async (reactionId: string) => {
    const edge = reactionEdges.find(e => e.id === reactionId);
    if (!edge) return;

    const initialCode = await fetchReactionCode(
      edge.code,
      edge.reactionFileId,
      () => buildInitialReactionCodeFromConfig(edge.config),
    );

    setReactionEditorState({
      isOpen: true,
      edgeId: reactionId,
      initialCode,
      sourceFileName: edge.config.model1Alias,
      targetFileName: edge.config.model2Alias,
      reactionFileId: edge.reactionFileId ?? null,
    });
    setSelectedRelId(reactionId);
    setSelectedClassId(null);
  }, [reactionEdges]);

  const handleCloseReactionEditor = useCallback(() => {
    setReactionEditorState(null);
  }, []);

  const handleSaveReactionCode = useCallback(async (code: string) => {
    if (!reactionEditorState?.edgeId) return;
    const reactionId = reactionEditorState.edgeId;
    try {
      const reactionFileId = await persistReactionCode(code, reactionEditorState.reactionFileId);
      setReactionEdges(prev => prev.map(edge =>
        edge.id === reactionId ? { ...edge, code, reactionFileId } : edge,
      ));
      setReactionEditorState(prev =>
        prev ? { ...prev, reactionFileId } : prev,
      );
    } catch (err) {
      console.error('Failed to save reaction file', err);
      throw err;
    }
  }, [reactionEditorState]);

  const handleDeleteReactionFromEditor = useCallback(() => {
    if (reactionEditorState?.edgeId) {
      deleteReaction(reactionEditorState.edgeId);
    }
  }, [reactionEditorState, deleteReaction]);

  const clientToDiagram = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const { x: viewX, y: viewY, scale } = viewRef.current;
    return {
      x: (clientX - rect.left - viewX) / scale,
      y: (clientY - rect.top - viewY) / scale,
    };
  }, []);

  const handleReactionPortMouseDown = useCallback((
    e: React.MouseEvent,
    classId: string,
    side: ReactionPortSide,
  ) => {
    if (!interactive || reactionsMode !== 'reactions') return;
    e.stopPropagation();
    e.preventDefault();
    reactionDragActiveRef.current = true;

    const cls = allClasses.find(c => c.id === classId);
    if (!cls) return;

    const { x: startX, y: startY } = getReactionPortPosition(cls, offsetX, offsetY, side);
    const cursor = clientToDiagram(e.clientX, e.clientY);
    setReactionDrag({
      sourceClassId: classId,
      sourceSide: side,
      startX,
      startY,
      cursorX: cursor.x,
      cursorY: cursor.y,
    });

    const onMove = (ev: MouseEvent) => {
      ev.preventDefault();
      const next = clientToDiagram(ev.clientX, ev.clientY);
      setReactionDrag(prev => prev ? { ...prev, cursorX: next.x, cursorY: next.y } : null);
    };

    const onUp = (ev: MouseEvent) => {
      reactionDragActiveRef.current = false;
      const targetClassId = getReactionPortTargetClassId(
        document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null,
        classId,
      );
      if (targetClassId) {
        addReactionConnection(classId, targetClassId);
      }
      setReactionDrag(null);
      globalThis.removeEventListener('mousemove', onMove);
      globalThis.removeEventListener('mouseup', onUp);
    };

    globalThis.addEventListener('mousemove', onMove);
    globalThis.addEventListener('mouseup', onUp);
  }, [
    interactive,
    reactionsMode,
    allClasses,
    offsetX,
    offsetY,
    clientToDiagram,
    addReactionConnection,
  ]);

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
    if (reactionDrag) {
      reactionDragActiveRef.current = false;
      setReactionDrag(null);
      return true;
    }
    if (editingReactionId) {
      setEditingReactionId(null);
      return true;
    }
    if (connectMode) {
      setConnectMode(false);
      setConnectSourceId(null);
      return true;
    }
    if (connectSourceId) {
      setConnectSourceId(null);
      return true;
    }
    if (edit) {
      setEdit(null);
      return true;
    }
    if (selectedRelId) {
      setSelectedRelId(null);
      return true;
    }
    if (selectedClassId) {
      dismissClassSelection();
      return true;
    }
    return false;
  }, [reactionDrag, editingReactionId, connectMode, connectSourceId, edit, selectedRelId, selectedClassId, dismissClassSelection]);

  useEffect(() => {
    if (reactionsMode === 'reactions') {
      reactionDragActiveRef.current = false;
      setReactionDrag(null);
      setEditingReactionId(null);
      setConnectMode(false);
      setConnectSourceId(null);
    }
  }, [reactionsMode]);

  const handleRelationshipClick = useCallback((relId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isReactionEdge = reactionEdges.some(edge => edge.id === relId);
    if (reactionsMode === 'reactions' && isReactionEdge) {
      if (e.detail >= 2) {
        setEditingReactionId(null);
        void openReactionEditor(relId);
        return;
      }
      setEditingReactionId(relId);
      setSelectedRelId(relId);
      setSelectedClassId(null);
      return;
    }
    if (e.detail >= 2 && interactive && reactionsMode !== 'reactions') {
      cycleRelationshipType(relId);
    }
    setEditingReactionId(null);
    setSelectedRelId(relId);
  }, [interactive, reactionsMode, reactionEdges, cycleRelationshipType, openReactionEditor]);

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
    if (connectMode && reactionsMode !== 'reactions') {
      if (!connectSourceId) {
        setConnectSourceId(classId);
        setSelectedClassId(classId);
        return;
      }
      if (connectSourceId !== classId) {
        const connected = addRelationship(connectSourceId, classId);
        if (!connected) {
          setSelectedClassId(classId);
          return;
        }
      }
      setConnectMode(false);
      setConnectSourceId(null);
      setSelectedClassId(classId);
      return;
    }
    setEditingReactionId(null);
    setSelectedClassId(classId);
  }, [interactive, connectMode, reactionsMode, connectSourceId, addRelationship, flushPendingEdit]);

  const updateClass = useCallback((classId: string, patch: Partial<Pick<CLS, 'name' | 'isAbstract' | 'isInterface'>>) => {
    recordChange();
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) return;
      const newId = sanitizeUmlClassId(trimmed);
      setClasses(prev => renameClassInList(prev, classId, newId, trimmed));
      setRelationships(prev => renameClassInRelationships(prev, classId, newId));
      setSelectedClassId(prev => (prev === classId ? newId : prev));
      setConnectSourceId(prev => (prev === classId ? newId : prev));
      return;
    }
    setClasses(prev => updateClassById(prev, classId, classItem => ({ ...classItem, ...patch })));
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
        type: 'inheritance',
      }];
    });
  }, [recordChange]);

  const handleDeleteSelected = useCallback(() => {
    if (editingReactionId) {
      deleteReaction(editingReactionId);
      return;
    }
    if (selectedRelId && reactionEdges.some(edge => edge.id === selectedRelId)) {
      deleteReaction(selectedRelId);
      return;
    }
    if (selectedRelId) {
      deleteRelationship(selectedRelId);
      return;
    }
    if (selectedClassId) {
      deleteClass(selectedClassId);
    }
  }, [editingReactionId, selectedRelId, selectedClassId, reactionEdges, deleteReaction, deleteRelationship, deleteClass]);

  useEffect(() => {
    if (!interactive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const inField = isKeyboardInputField(e.target);
      if (tryHandleUndoRedoShortcut(e, inField, handleUndo, handleRedo)) return;
      tryHandleEscapeShortcut(e, tryEscape);
      if (e.key === 'Escape') return;
      tryHandleDeleteShortcut(e, inField, selectedRelId, selectedClassId, handleDeleteSelected);
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [interactive, selectedRelId, selectedClassId, handleDeleteSelected, tryEscape, handleUndo, handleRedo]);

  const edgeLayouts = useMemo(() => {
    const raw = rels.flatMap(rel => {
      const endpoints = getRelEndpoints(rel, allClasses, offsetX, offsetY);
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
  }, [rels, allClasses, offsetX, offsetY]);

  const multiplicityBadges = useMemo(() => {
    const reactionRelIds = new Set(reactionEdges.map(edge => edge.id));
    const raw: MultiplicityBadge[] = [];
    for (const layout of edgeLayouts) {
      const { rel, p1, p2 } = layout;
      if (reactionRelIds.has(rel.id)) continue;

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
    const obstacles = buildClassObstacleRects(allClasses, offsetX, offsetY);
    return resolveMultiplicityBadgeCollisions(
      optimizeMultiplicityBadges(raw, MULT_ALONG_OFFSET, MULT_PERP_OFFSET),
      obstacles,
      MULT_BADGE_HALF_W,
      MULT_BADGE_HALF_H,
    );
  }, [edgeLayouts, reactionEdges, allClasses, offsetX, offsetY]);

  const reactionEdgeById = useMemo(
    () => new Map(reactionEdges.map(edge => [edge.id, edge])),
    [reactionEdges],
  );

  const validationIssues = useMemo(
    () => validateUmlModel({ classes, relationships }, allClasses),
    [classes, relationships, allClasses],
  );

  if (classes.length === 0) {
    return <UmlEmptyDiagram interactive={interactive} onAddClass={addClass} />;
  }

  const canDelete = !!(selectedRelId || selectedClassId);
  const selectedRel = selectedRelId ? relationships.find(r => r.id === selectedRelId) : null;
  const editingReaction = editingReactionId
    ? reactionEdges.find(edge => edge.id === editingReactionId) ?? null
    : null;
  const selectedRelIsReaction = !!(selectedRelId && reactionEdges.some(edge => edge.id === selectedRelId));
  const selectedClass = selectedClassId ? classes.find(c => c.id === selectedClassId) : null;
  const hasUnsavedChanges = isDirty();
  const validationInset = getValidationBannerInset(
    selectedClass,
    selectedRel,
    !!(editingReaction || (reactionsMode === 'reactions' && selectedRelIsReaction)),
  );
  const diagramCursor = getDiagramCursor(panning, connectMode);
  const saveButtonTitle = saveContext
    ? getSaveButtonTitle(hasUnsavedChanges, saveContext)
    : '';

  return (
    <section
      ref={containerRef}
      aria-label="UML diagram canvas"
      style={{
        width: '100%', height: '100%',
        overflow: 'hidden', position: 'relative',
        cursor: diagramCursor,
        ...WORKSPACE_DOT_BACKGROUND,
        userSelect: 'none',
      }}
    >
    {reactionsMode === 'reactions' && (
      <style>{`@keyframes reactionPulse{0%,100%{opacity:1}50%{opacity:0.6}}`}</style>
    )}
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
          const reactionEdge = reactionEdgeById.get(rel.id);
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
              reactionEdge={reactionEdge}
            />
          );
        })}
      </svg>

      {/* Model group wrapper rects */}
      {modelGroups.map(g => {
        const sx = g.minX + offsetX;
        const sy = g.minY + offsetY;
        const canRemove = interactive && removableModelNames.has(g.name) && onRemoveAdditionalModel;
        return (
          <div
            key={g.name}
            style={{
              position: 'absolute',
              left: sx,
              top: sy,
              width: g.width,
              height: g.height,
              border: `2px solid ${g.color}`,
              borderRadius: 10,
              background: g.fill,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            <div
              data-wrapper-header
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 22,
                background: g.color,
                borderRadius: '8px 8px 0 0',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 8,
                paddingRight: canRemove ? 4 : 8,
                fontSize: 11,
                fontWeight: 700,
                color: '#fff',
                letterSpacing: 0.3,
                pointerEvents: 'auto',
              }}
            >
              <button
                type="button"
                onMouseDown={interactive ? (e) => handleWrapperDragStart(e, g.name) : undefined}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff',
                  letterSpacing: 0.3,
                  cursor: interactive ? 'grab' : 'default',
                  textAlign: 'left',
                }}
              >
                {g.name}
              </button>
              {canRemove && (
                <button
                  type="button"
                  title={`Remove ${g.name}`}
                  aria-label={`Remove ${g.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveAdditionalModel?.(g.name);
                  }}
                  style={{
                    width: 18,
                    height: 18,
                    border: 'none',
                    borderRadius: 4,
                    background: 'rgba(255,255,255,0.18)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  &times;
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Class boxes */}
      {allClasses.map(cls => {
        const isAdditional = cls.id.startsWith('addl-');
        return (
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
          reactionsMode={reactionsMode === 'reactions'}
          onReactionPortMouseDown={handleReactionPortMouseDown}
          onSelect={() => handleClassSelect(cls.id)}
          onDragStart={() => { dragHistorySavedRef.current = false; }}
          onMove={isAdditional ? moveAdditionalClass : moveClass}
          onDragEnd={isAdditional ? () => {} : finishClassDrag}
          onStartEditName={() => {
            if (!interactive || isAdditional) return;
            flushPendingEdit();
            setEdit({ classId: cls.id, kind: 'name', val: cls.name });
          }}
          onSaveName={name => saveName(cls.id, name)}
          onStartEditAttr={attrId => {
            if (!interactive || isAdditional) return;
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
          onAddAttr={() => interactive && !isAdditional && addAttr(cls.id)}
          onDeleteAttr={attrId => deleteAttr(cls.id, attrId)}
          onStartEditOp={opId => {
            if (!interactive || isAdditional) return;
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
          onAddOp={() => interactive && !isAdditional && addOp(cls.id)}
          onDeleteOp={opId => deleteOp(cls.id, opId)}
          onDelete={() => !isAdditional && deleteClass(cls.id)}
          onEditChange={setEdit}
        />
        );
      })}

      {reactionDrag && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: totalW,
            height: totalH,
            overflow: 'visible',
            zIndex: 8,
            pointerEvents: 'none',
          }}
        >
          <line
            x1={reactionDrag.startX}
            y1={reactionDrag.startY}
            x2={reactionDrag.cursorX}
            y2={reactionDrag.cursorY}
            stroke="#a855f7"
            strokeWidth={2.5}
            strokeDasharray="8 5"
            opacity={0.9}
          />
          <circle
            cx={reactionDrag.cursorX}
            cy={reactionDrag.cursorY}
            r={5}
            fill="#a855f7"
            stroke="#fff"
            strokeWidth={2}
          />
        </svg>
      )}

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

      {/* Multiplicity badges above class boxes so labels stay visible */}
      <svg
        data-mult-badge-layer
        style={{ position: 'absolute', top: 0, left: 0, width: totalW, height: totalH, overflow: 'visible', zIndex: 22, pointerEvents: 'none' }}
      >
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

      {/* Direction markers above class boxes */}
      {edgeLayouts.map(layout => {
        const { rel, drawP1, drawP2 } = layout;
        const reactionEdge = reactionEdgeById.get(rel.id);
        const state = edgeState(selectedRelId === rel.id, hoveredRelId === rel.id);
        const color = reactionEdge ? REACTION_EDGE_COLOR[state] : EDGE_COLOR[state];

        return (
          <RelationDirectionMarker
            key={`${rel.id}-direction`}
            rel={rel}
            reactionEdge={reactionEdge}
            lineStart={drawP1}
            lineEnd={drawP2}
            color={color}
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
          {getConnectModeHint(connectSourceId, additionalModels.length > 0)}
        </div>
      )}
      {interactive && reactionsMode === 'reactions' && !connectMode && (
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
            background: '#faf5ff',
            border: '1px solid #e9d5ff',
            color: '#6b21a8',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: UML.fontSans,
            boxShadow: '0 4px 14px rgba(168,85,247,0.15)',
            pointerEvents: 'none',
            maxWidth: 'min(420px, calc(100vw - 320px))',
            textAlign: 'center',
            lineHeight: 1.35,
          }}
        >
          {reactionDrag
            ? 'Release on another class dot to create a reaction'
            : 'Drag from a purple dot to connect classes across models'}
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
          {reactionsMode !== 'reactions' && (
            <DiagramToolButton
              title={connectMode ? 'Cancel connect mode (Esc)' : 'Connect two classes in the same model'}
              active={connectMode}
              onClick={() => {
                setConnectMode(v => !v);
                setConnectSourceId(null);
              }}
              label="Connect"
            >
              <IconConnect />
            </DiagramToolButton>
          )}
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
              title={saveButtonTitle}
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
      {saveMessage && <UmlSaveMessageBanner message={saveMessage} />}
      {interactive && validationIssues.length > 0 && (
        <div
          data-uml-validation
          style={{
            position: 'absolute',
            top: DIAGRAM_HINT_TOP,
            left: validationInset.left,
            right: validationInset.right,
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
      {interactive && editingReaction && (
        <ReactionConfigPopup
          edge={editingReaction}
          onUpdate={config => updateReactionConfig(editingReaction.id, config)}
          onDelete={() => deleteReaction(editingReaction.id)}
          onClose={() => setEditingReactionId(null)}
        />
      )}
      {interactive && (
        <ReactionEditorModal
          state={reactionEditorState}
          onClose={handleCloseReactionEditor}
          onSave={handleSaveReactionCode}
          onDelete={handleDeleteReactionFromEditor}
          vsumId={vsumId}
        />
      )}
      {interactive && selectedRel && !selectedRelIsReaction && reactionsMode !== 'reactions' && (
        <RelationshipEditPanel
          rel={selectedRel}
          classes={allClasses}
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
        classes={allClasses}
        relationships={rels}
        modelGroups={modelGroups}
        offsetX={offsetX}
        offsetY={offsetY}
        vx={vx}
        vy={vy}
        vscale={vscale}
        containerRef={containerRef}
        onViewportChange={handleMinimapPan}
      />
    </section>
  );
});

UMLDiagram.displayName = 'UMLDiagram';

// ── ClassBox helpers ─────────────────────────────────────────────────────────

type ClassBoxDragPointRef = RefObject<{ sx: number; sy: number; ox: number; oy: number } | null>;
type ClassBoxDidDragRef = RefObject<boolean>;

function getEditAttrType(edit: EditState | null): string | undefined {
  if (edit?.kind !== 'attr') return undefined;
  return edit.type;
}

function getEditOpReturnType(edit: EditState | null): string | undefined {
  if (edit?.kind !== 'op') return undefined;
  return edit.returnType;
}

function isClassBoxEditing(edit: EditState | null, classId: string): boolean {
  return edit?.classId === classId && (edit.kind === 'name' || edit.kind === 'attr' || edit.kind === 'op');
}

function isClassEditingName(edit: EditState | null, classId: string): boolean {
  return edit?.classId === classId && edit.kind === 'name';
}

function getClassBoxNameSectionHeight(cls: CLS, isEditingName: boolean): number {
  const isAbstractOrIface = cls.isAbstract || cls.isInterface;
  if (!isEditingName) {
    if (isAbstractOrIface) return STEREO_H;
    return NAME_H;
  }
  if (isAbstractOrIface) return Math.max(STEREO_H, EDIT_NAME_H + 8);
  return EDIT_NAME_H;
}

function getClassBoxBorder(selected: boolean, connectSource: boolean): string {
  if (connectSource || selected) return `2.5px solid ${UML.primary}`;
  return `1.5px solid ${UML.border}`;
}

function isClassBoxHighlighted(selected: boolean, connectSource: boolean): boolean {
  return selected || connectSource;
}

function getClassBoxBoxShadow(isEditingBox: boolean, highlighted: boolean): string {
  if (isEditingBox) return `0 0 0 4px ${UML.primaryRing}, 0 12px 28px rgba(4,148,132,0.18)`;
  if (highlighted) return `0 0 0 3px ${UML.primaryRing}, 0 4px 14px rgba(15,23,42,0.08)`;
  return '0 2px 8px rgba(15,23,42,0.06)';
}

function getClassBoxZIndex(isEditingBox: boolean, selected: boolean): number {
  if (isEditingBox) return 25;
  if (selected) return 15;
  return 1;
}

function getClassBoxSectionPadding(isEditingBox: boolean): string {
  return isEditingBox ? '6px 0 4px' : '3px 0 2px';
}

function getClassBoxOuterStyle(params: {
  isEditingBox: boolean;
  selected: boolean;
  boxBorder: string;
  boxShadow: string;
  boxZIndex: number;
}): React.CSSProperties {
  return {
    width: '100%',
    border: params.boxBorder,
    borderRadius: 8,
    background: UML.surface,
    boxShadow: params.boxShadow,
    userSelect: 'none',
    fontFamily: UML.fontMono,
    fontSize: 12,
    cursor: 'grab',
    zIndex: params.boxZIndex,
    transition: 'width 0.22s ease, box-shadow 0.22s ease',
  };
}

function getClassBoxWrapperStyle(params: {
  cls: CLS;
  offsetX: number;
  offsetY: number;
  displayW: number;
}): React.CSSProperties {
  return {
    position: 'absolute',
    left: params.cls.x + params.offsetX,
    top: params.cls.y + params.offsetY,
    width: params.displayW,
  };
}

function getClassBoxAriaLabel(cls: CLS, selected: boolean, connectSource: boolean): string {
  let kind = 'class';
  if (cls.isInterface) kind = 'interface';
  else if (cls.isAbstract) kind = 'abstract class';

  let state = '';
  if (connectSource) state = ', connection source';
  else if (selected) state = ', selected';

  return `UML ${kind} ${cls.name}${state}`;
}

function shouldIgnoreClassBoxKeyboardEvent(e: React.KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  return target !== e.currentTarget
    && Boolean(target.closest('input, button, select, textarea'));
}

function handleInlineEditKeyDown(
  e: React.KeyboardEvent,
  onEnter: () => void,
  onEscape: () => void,
): void {
  if (e.key === 'Enter') {
    onEnter();
    return;
  }
  if (e.key === 'Escape') {
    onEscape();
  }
}

function handleClassBoxKeyDown(
  e: React.KeyboardEvent,
  interactive: boolean,
  onSelect: () => void,
): void {
  if (!interactive) return;
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (shouldIgnoreClassBoxKeyboardEvent(e)) return;
  e.preventDefault();
  onSelect();
}

function getClassBoxInteractionProps(params: {
  interactive: boolean;
  selected: boolean;
  boxAriaLabel: string;
  didDragRef: ClassBoxDidDragRef;
  onBoxMouseDown: (e: React.MouseEvent) => void;
  onSelect: () => void;
}): Pick<
  React.HTMLAttributes<HTMLDivElement>,
  'role' | 'aria-label' | 'aria-selected' | 'tabIndex' | 'onMouseDown' | 'onClick' | 'onKeyDown'
> {
  return {
    role: 'group',
    'aria-label': params.boxAriaLabel,
    'aria-selected': params.selected,
    tabIndex: params.interactive ? 0 : -1,
    onMouseDown: params.onBoxMouseDown,
    onClick: (e) => handleClassBoxSelectClick(e, params.didDragRef, params.onSelect),
    onKeyDown: (e) => handleClassBoxKeyDown(e, params.interactive, params.onSelect),
  };
}

function getClassBoxNameSectionBackground(isEditingName: boolean, selected: boolean): string {
  if (isEditingName || selected) return UML.primarySoft;
  return UML.surfaceMuted;
}

function getClassBoxNameSectionPadding(isEditingName: boolean): string {
  if (isEditingName) return '8px 12px';
  return '4px 8px';
}

function getClassBoxNameSectionStyle(
  nameSectionH: number,
  nameSectionBackground: string,
  nameSectionPadding: string,
): React.CSSProperties {
  return {
    height: nameSectionH,
    background: nameSectionBackground,
    borderBottom: `1.5px solid ${UML.border}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: nameSectionPadding,
    gap: 1,
    transition: 'height 0.22s ease, padding 0.22s ease',
  };
}

function getClassBoxNameSectionAriaLabel(cls: CLS, selected: boolean): string {
  if (selected) return `Class name: ${cls.name}. Press Enter to edit.`;
  return `Class name: ${cls.name}. Press Enter to select.`;
}

function handleClassBoxNameSectionKeyDown(
  e: React.KeyboardEvent,
  interactive: boolean,
  selected: boolean,
  edit: EditState | null,
  classId: string,
  onSelect: () => void,
  onStartEditName: () => void,
): void {
  if (!interactive) return;
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (shouldIgnoreClassBoxKeyboardEvent(e)) return;
  e.preventDefault();
  e.stopPropagation();
  if (!selected) {
    onSelect();
    return;
  }
  if (edit?.classId !== classId) {
    onStartEditName();
  }
}

function getClassBoxNameSectionInteractionProps(params: {
  interactive: boolean;
  selected: boolean;
  edit: EditState | null;
  classId: string;
  onSelect: () => void;
  onStartEditName: () => void;
}): Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onDoubleClick' | 'onClick' | 'onKeyDown'> {
  return {
    onDoubleClick: (e) => {
      e.stopPropagation();
      params.onStartEditName();
    },
    onClick: (e) => handleClassBoxNameSectionClick(
      e,
      params.interactive,
      params.selected,
      params.edit,
      params.classId,
      params.onSelect,
      params.onStartEditName,
    ),
    onKeyDown: (e) => handleClassBoxNameSectionKeyDown(
      e,
      params.interactive,
      params.selected,
      params.edit,
      params.classId,
      params.onSelect,
      params.onStartEditName,
    ),
  };
}

function startClassBoxDrag({
  e,
  cls,
  scale,
  dragRef,
  didDragRef,
  onDragStart,
  onMove,
  onDragEnd,
}: {
  e: React.MouseEvent;
  cls: CLS;
  scale: number;
  dragRef: ClassBoxDragPointRef;
  didDragRef: ClassBoxDidDragRef;
  onDragStart: () => void;
  onMove: (id: string, x: number, y: number) => void;
  onDragEnd: () => void;
}): void {
  const target = e.target as HTMLElement;
  if (target.closest('input, button, [data-no-drag], [data-reaction-port]')) return;
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
    globalThis.removeEventListener('mousemove', onMove2);
    globalThis.removeEventListener('mouseup', onUp);
  };
  globalThis.addEventListener('mousemove', onMove2);
  globalThis.addEventListener('mouseup', onUp);
}

function handleClassBoxSelectClick(
  e: React.MouseEvent,
  didDragRef: ClassBoxDidDragRef,
  onSelect: () => void,
): void {
  e.stopPropagation();
  if (didDragRef.current) {
    didDragRef.current = false;
    return;
  }
  onSelect();
}

function handleClassBoxNameSectionClick(
  e: React.MouseEvent,
  interactive: boolean,
  selected: boolean,
  edit: EditState | null,
  classId: string,
  onSelect: () => void,
  onStartEditName: () => void,
): void {
  e.stopPropagation();
  if (!interactive) return;
  if (!selected) {
    onSelect();
    return;
  }
  if (edit?.classId !== classId) {
    onStartEditName();
  }
}

function getAttrRowEdit(edit: EditState | null, attrId: string): EditState | null {
  if (edit?.kind !== 'attr' || edit.attrId !== attrId) return null;
  return edit;
}

function getOpRowEdit(edit: EditState | null, opId: string): EditState | null {
  if (edit?.kind !== 'op' || edit.opId !== opId) return null;
  return edit;
}

interface ClassBoxNameSectionProps {
  cls: CLS;
  edit: EditState | null;
  interactive: boolean;
  selected: boolean;
  isEditingName: boolean;
  nameSectionH: number;
  onSelect: () => void;
  onStartEditName: () => void;
  onSaveName: (name: string) => void;
  onCancelEdit: () => void;
  onEditChange: (e: EditState) => void;
}

const ClassBoxNameSection: React.FC<ClassBoxNameSectionProps> = ({
  cls, edit, interactive, selected, isEditingName, nameSectionH,
  onSelect, onStartEditName, onSaveName, onCancelEdit, onEditChange,
}) => {
  const isAbstractOrIface = cls.isAbstract || cls.isInterface;
  const isEditingThisName = edit?.kind === 'name' && edit.classId === cls.id;
  const stereotypeLabel = cls.isInterface ? 'interface' : 'abstract';
  const nameFontStyle = cls.isAbstract ? 'italic' : 'normal';
  const nameSectionBackground = getClassBoxNameSectionBackground(isEditingName, selected);
  const nameSectionPadding = getClassBoxNameSectionPadding(isEditingName);
  const nameSectionStyle = getClassBoxNameSectionStyle(nameSectionH, nameSectionBackground, nameSectionPadding);
  const nameSectionAriaLabel = getClassBoxNameSectionAriaLabel(cls, selected);
  const nameSectionInteractionProps = getClassBoxNameSectionInteractionProps({
    interactive,
    selected,
    edit,
    classId: cls.id,
    onSelect,
    onStartEditName,
  });

  const stereotype = isAbstractOrIface ? (
    <span style={{ fontSize: 10, color: '#444444', fontStyle: 'italic', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      «{stereotypeLabel}»
    </span>
  ) : null;

  if (isEditingThisName && edit?.kind === 'name') {
    return (
      <fieldset
        aria-label={`Editing class name: ${cls.name}`}
        style={{
          ...nameSectionStyle,
          border: 'none',
          margin: 0,
          minWidth: 0,
        }}
      >
        {stereotype}
        <input
          autoFocus
          value={edit.val}
          onChange={e => onEditChange({ ...edit, val: e.target.value })}
          onKeyDown={e => handleInlineEditKeyDown(
            e,
            () => onSaveName(edit.val),
            onCancelEdit,
          )}
          onBlur={() => onSaveName(edit.val)}
          onClick={e => e.stopPropagation()}
          aria-label={`Class name for ${cls.name}`}
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
      </fieldset>
    );
  }

  return (
    <button
      type="button"
      disabled={!interactive}
      aria-label={nameSectionAriaLabel}
      {...nameSectionInteractionProps}
      style={{
        ...nameSectionStyle,
        border: 'none',
        margin: 0,
        width: '100%',
        boxSizing: 'border-box',
        cursor: interactive ? 'pointer' : 'default',
        font: 'inherit',
        textAlign: 'center',
      }}
    >
      {stereotype}
      <span style={{
        fontWeight: 700,
        fontSize: 13,
        color: '#000000',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontStyle: nameFontStyle,
        textAlign: 'center',
        wordBreak: 'break-all',
      }}>
        {cls.name}
      </span>
    </button>
  );
};

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
  reactionsMode: boolean;
  onReactionPortMouseDown?: (e: React.MouseEvent, classId: string, side: ReactionPortSide) => void;
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
  cls, offsetX, offsetY, scale, selected, connectSource, interactive, edit, reactionsMode, onReactionPortMouseDown, onSelect, onDragStart, onMove, onDragEnd, onStartEditName, onSaveName,
  onStartEditAttr, onSaveAttr, onCancelEdit, onAddAttr, onDeleteAttr, onStartEditOp, onSaveOp, onAddOp, onDeleteOp, onDelete, onEditChange,
}) => {
  const dragRef: ClassBoxDragPointRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const didDragRef: ClassBoxDidDragRef = useRef(false);
  const [hoveredAttr, setHoveredAttr] = useState<string | null>(null);
  const [hoveredOp, setHoveredOp] = useState<string | null>(null);

  const attrTypeOptions = useMemo(
    () => buildAttributeTypeOptions(getEditAttrType(edit)),
    [edit],
  );

  const opReturnOptions = useMemo(
    () => buildOperationReturnTypeOptions(getEditOpReturnType(edit)),
    [edit],
  );

  const isEditingBox = isClassBoxEditing(edit, cls.id);
  const isEditingName = isClassEditingName(edit, cls.id);
  const displayW = isEditingBox ? EDIT_BW : BW;
  const nameSectionH = getClassBoxNameSectionHeight(cls, isEditingName);
  const sectionPadding = getClassBoxSectionPadding(isEditingBox);
  const wrapperStyle = getClassBoxWrapperStyle({ cls, offsetX, offsetY, displayW });
  const boxHighlighted = isClassBoxHighlighted(selected, connectSource);
  const boxBorder = getClassBoxBorder(selected, connectSource);
  const boxShadow = getClassBoxBoxShadow(isEditingBox, boxHighlighted);
  const boxZIndex = getClassBoxZIndex(isEditingBox, selected);
  const boxStyle = getClassBoxOuterStyle({ isEditingBox, selected, boxBorder, boxShadow, boxZIndex });
  const boxAriaLabel = getClassBoxAriaLabel(cls, selected, connectSource);

  const onBoxMouseDown = (e: React.MouseEvent) => {
    startClassBoxDrag({
      e,
      cls,
      scale,
      dragRef,
      didDragRef,
      onDragStart,
      onMove,
      onDragEnd,
    });
  };

  const boxInteractionProps = getClassBoxInteractionProps({
    interactive,
    selected,
    boxAriaLabel,
    didDragRef,
    onBoxMouseDown,
    onSelect,
  });

  return (
    <div style={wrapperStyle}>
      <div
        data-classbox
        {...boxInteractionProps}
        style={boxStyle}
      >
      <ClassBoxNameSection
        cls={cls}
        edit={edit}
        interactive={interactive}
        selected={selected}
        isEditingName={isEditingName}
        nameSectionH={nameSectionH}
        onSelect={onSelect}
        onStartEditName={onStartEditName}
        onSaveName={onSaveName}
        onCancelEdit={onCancelEdit}
        onEditChange={onEditChange}
      />

      {/* ── Attributes section ── */}
      <div style={{
        borderBottom: `1px solid ${UML.border}`,
        padding: sectionPadding,
        background: UML.surface,
        transition: 'padding 0.22s ease',
      }}>
        {cls.attributes.map(attr => (
          <AttrRow
            key={attr.id}
            attr={attr}
            typeOptions={attrTypeOptions}
            expanded={isEditingBox}
            editing={getAttrRowEdit(edit, attr.id)}
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
        padding: sectionPadding,
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
            editing={getOpRowEdit(edit, op.id)}
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
      {interactive && selected && (
        <button
          type="button"
          data-no-drag
          title="Delete class"
          aria-label={`Delete class ${cls.name}`}
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
      {reactionsMode && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          borderRadius: 6,
          border: '2px dashed rgba(168,85,247,0.5)',
          boxShadow: '0 0 8px rgba(168,85,247,0.2)',
          animation: 'reactionPulse 2s ease-in-out infinite',
        }}>
          <button
            type="button"
            aria-label={`Right reaction port for ${cls.name}`}
            data-reaction-port
            data-class-id={cls.id}
            data-port-side="right"
            onMouseDown={onReactionPortMouseDown
              ? (e) => onReactionPortMouseDown(e, cls.id, 'right')
              : undefined}
            style={{
            position: 'absolute',
            top: '50%',
            right: -7,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#a855f7',
            border: '2px solid #fff',
            transform: 'translateY(-50%)',
            boxShadow: '0 0 6px rgba(168,85,247,0.6)',
            pointerEvents: 'auto',
            cursor: 'crosshair',
            padding: 0,
          }} />
          <button
            type="button"
            aria-label={`Left reaction port for ${cls.name}`}
            data-reaction-port
            data-class-id={cls.id}
            data-port-side="left"
            onMouseDown={onReactionPortMouseDown
              ? (e) => onReactionPortMouseDown(e, cls.id, 'left')
              : undefined}
            style={{
            position: 'absolute',
            top: '50%',
            left: -7,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#a855f7',
            border: '2px solid #fff',
            transform: 'translateY(-50%)',
            boxShadow: '0 0 6px rgba(168,85,247,0.6)',
            pointerEvents: 'auto',
            cursor: 'crosshair',
            padding: 0,
          }} />
        </div>
      )}
    </div>
  );
};

// ── AttrRow ───────────────────────────────────────────────────────────────────

function getUmlEditFieldStyle(expanded: boolean): React.CSSProperties {
  if (!expanded) return attrFieldStyle;
  return {
    ...attrFieldStyle,
    fontSize: 13,
    padding: '4px 6px',
    borderRadius: 5,
    border: `2px solid ${UML.primaryBorder}`,
  };
}

function getUmlEditRowStyle(expanded: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: expanded ? 6 : 2,
    padding: expanded ? '6px 12px' : '1px 6px',
    minHeight: expanded ? EDIT_ATTR_ROW : ATTR_ROW,
    flexWrap: 'nowrap',
  };
}

function getEditSelectValue(options: string[], current: string, fallback: string): string {
  if (options.includes(current)) return current;
  return options[0] ?? fallback;
}

function getEditRowInputName(element: HTMLElement, fallback: string): string {
  const input = element.closest('div')?.querySelector('input') as HTMLInputElement | null;
  return input?.value ?? fallback;
}

function getUmlRowContainerStyle(hovered: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    padding: '0 6px',
    height: ATTR_ROW,
    background: hovered ? '#f8fafc' : 'transparent',
    gap: 3,
  };
}

function getUmlRowEditButtonStyle(): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    gap: 3,
    minWidth: 0,
    border: 'none',
    margin: 0,
    padding: 0,
    background: 'transparent',
    cursor: 'default',
    font: 'inherit',
    textAlign: 'left',
  };
}

function getUmlRowDeleteButtonStyle(hovered: boolean): React.CSSProperties {
  return {
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
  };
}

function handleUmlRowEditKeyDown(e: React.KeyboardEvent, onEdit: () => void): void {
  if (e.key !== 'Enter' && e.key !== 'F2') return;
  if (shouldIgnoreClassBoxKeyboardEvent(e)) return;
  e.preventDefault();
  onEdit();
}

interface UmlMemberRowDisplayProps {
  ariaLabel: string;
  hovered: boolean;
  showDelete: boolean;
  deleteTitle: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDoubleClick: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

const UmlMemberRowDisplay: React.FC<UmlMemberRowDisplayProps> = ({
  ariaLabel, hovered, showDelete, deleteTitle,
  onMouseEnter, onMouseLeave, onDoubleClick, onDelete, children,
}) => (
  <div style={getUmlRowContainerStyle(hovered)}>
    <button
      type="button"
      aria-label={ariaLabel}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
      onKeyDown={(e) => handleUmlRowEditKeyDown(e, onDoubleClick)}
      style={getUmlRowEditButtonStyle()}
    >
      {children}
    </button>
    {showDelete && (
      <button
        type="button"
        data-no-drag
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title={deleteTitle}
        aria-label={deleteTitle}
        style={getUmlRowDeleteButtonStyle(hovered)}
      >
        ✕
      </button>
    )}
  </div>
);

type AttrEditState = Extract<EditState, { kind: 'attr' }>;

interface AttrRowEditorProps {
  editing: AttrEditState;
  typeOptions: string[];
  expanded: boolean;
  onSave: (name: string, type: string, visibility: UMLVisibility) => void;
  onCancel: () => void;
  onEditChange: (name: string, type: string, visibility: UMLVisibility) => void;
}

const AttrRowEditor: React.FC<AttrRowEditorProps> = ({
  editing, typeOptions, expanded, onSave, onCancel, onEditChange,
}) => {
  const editFieldStyle = getUmlEditFieldStyle(expanded);
  const rowStyle = getUmlEditRowStyle(expanded);
  const selectValue = getEditSelectValue(typeOptions, editing.type, 'String');
  const visibilitySelectWidth = expanded ? 42 : 34;
  const nameInputMinWidth = expanded ? 72 : 40;
  const typeSelectWidth = expanded ? 96 : 76;

  const commitEdit = (name: string, type: string, visibility: UMLVisibility) => {
    onEditChange(name, type, visibility);
    onSave(name, type, visibility);
  };

  const handleVisibilityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const visibility = e.target.value as UMLVisibility;
    const name = getEditRowInputName(e.currentTarget, editing.name);
    commitEdit(name, editing.type, visibility);
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value;
    const name = getEditRowInputName(e.currentTarget, editing.name);
    commitEdit(name, type, editing.visibility);
  };

  return (
    <div style={rowStyle}>
      <select
        value={editing.visibility}
        onMouseDown={e => e.preventDefault()}
        onChange={handleVisibilityChange}
        style={{ ...editFieldStyle, width: visibilitySelectWidth, flexShrink: 0, padding: '2px 2px' }}
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
        onKeyDown={e => handleInlineEditKeyDown(
          e,
          () => onSave(editing.name, editing.type, editing.visibility),
          onCancel,
        )}
        style={{ ...editFieldStyle, flex: 1, minWidth: nameInputMinWidth }}
      />
      <span style={{ color: UML.textMuted, flexShrink: 0 }}>:</span>
      <select
        value={selectValue}
        onMouseDown={e => e.preventDefault()}
        onChange={handleTypeChange}
        onKeyDown={e => handleInlineEditKeyDown(
          e,
          () => onSave(editing.name, e.currentTarget.value, editing.visibility),
          onCancel,
        )}
        title="Attribute type (primitive only)"
        style={{ ...editFieldStyle, width: typeSelectWidth, color: UML.primary, fontWeight: 600 }}
      >
        {typeOptions.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  );
};

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
  if (editing?.kind === 'attr') {
    return (
      <AttrRowEditor
        editing={editing}
        typeOptions={typeOptions}
        expanded={expanded}
        onSave={onSave}
        onCancel={onCancel}
        onEditChange={onEditChange}
      />
    );
  }

  return (
    <UmlMemberRowDisplay
      ariaLabel={`Attribute ${attr.name}: ${normalizeAttributeTypeDisplay(attr.type)}. Press Enter to edit.`}
      hovered={hovered}
      showDelete={!!showDelete}
      deleteTitle="Delete attribute"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDoubleClick={onDoubleClick}
      onDelete={onDelete}
    >
      <span style={{ color: '#64748b', flexShrink: 0 }}>{attr.visibility ?? '+'}</span>
      <span style={{ color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {attr.name}
      </span>
      <span style={{ color: '#94a3b8', flexShrink: 0 }}>:</span>
      <span style={{ color: UML.primary, flexShrink: 0, fontWeight: 600 }}>{normalizeAttributeTypeDisplay(attr.type)}</span>
    </UmlMemberRowDisplay>
  );
};

// ── AddAttrRow ────────────────────────────────────────────────────────────────

function getUmlAddMemberRowStyle(hovered: boolean): React.CSSProperties {
  return {
    height: ADD_BTN_H,
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    gap: 4,
    cursor: 'pointer',
    color: hovered ? UML.primary : UML.textMuted,
    transition: 'color 0.1s',
    fontFamily: UML.fontSans,
    border: 'none',
    margin: 0,
    width: '100%',
    background: 'transparent',
    font: 'inherit',
    textAlign: 'left',
  };
}

const UmlAddMemberRow: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      data-no-drag
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={getUmlAddMemberRowStyle(hov)}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
      <span style={{ fontSize: 10 }}>{label}</span>
    </button>
  );
};

const AddAttrRow: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <UmlAddMemberRow label="Add attribute" onClick={onClick} />
);

// ── OpRow ─────────────────────────────────────────────────────────────────────

type OpEditState = Extract<EditState, { kind: 'op' }>;

interface OpRowEditorProps {
  editing: OpEditState;
  returnOptions: string[];
  expanded: boolean;
  onSave: (name: string, returnType: string, visibility: UMLVisibility) => void;
  onCancel: () => void;
  onEditChange: (name: string, returnType: string, visibility: UMLVisibility) => void;
}

const OpRowEditor: React.FC<OpRowEditorProps> = ({
  editing, returnOptions, expanded, onSave, onCancel, onEditChange,
}) => {
  const editFieldStyle = getUmlEditFieldStyle(expanded);
  const rowStyle = getUmlEditRowStyle(expanded);
  const selectValue = getEditSelectValue(returnOptions, editing.returnType, 'Void');
  const visibilitySelectWidth = expanded ? 42 : 34;
  const nameInputMinWidth = expanded ? 72 : 40;
  const returnTypeSelectWidth = expanded ? 86 : 68;

  const commitEdit = (name: string, returnType: string, visibility: UMLVisibility) => {
    onEditChange(name, returnType, visibility);
    onSave(name, returnType, visibility);
  };

  const handleVisibilityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const visibility = e.target.value as UMLVisibility;
    const name = getEditRowInputName(e.currentTarget, editing.name);
    commitEdit(name, editing.returnType, visibility);
  };

  const handleReturnTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const returnType = e.target.value;
    const name = getEditRowInputName(e.currentTarget, editing.name);
    commitEdit(name, returnType, editing.visibility);
  };

  return (
    <div style={rowStyle}>
      <select
        value={editing.visibility}
        onMouseDown={e => e.preventDefault()}
        onChange={handleVisibilityChange}
        style={{ ...editFieldStyle, width: visibilitySelectWidth, flexShrink: 0 }}
      >
        {UML_VISIBILITY_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <input
        autoFocus
        value={editing.name}
        onChange={e => onEditChange(e.target.value, editing.returnType, editing.visibility)}
        onBlur={e => onSave(e.currentTarget.value, editing.returnType, editing.visibility)}
        onKeyDown={e => handleInlineEditKeyDown(
          e,
          () => onSave(editing.name, editing.returnType, editing.visibility),
          onCancel,
        )}
        style={{ ...editFieldStyle, flex: 1, minWidth: nameInputMinWidth }}
      />
      <span style={{ color: UML.textMuted, flexShrink: 0 }}>() :</span>
      <select
        value={selectValue}
        onMouseDown={e => e.preventDefault()}
        onChange={handleReturnTypeChange}
        onKeyDown={e => handleInlineEditKeyDown(
          e,
          () => onSave(editing.name, e.currentTarget.value, editing.visibility),
          onCancel,
        )}
        style={{ ...editFieldStyle, width: returnTypeSelectWidth, color: UML.primary, fontWeight: 600 }}
      >
        {returnOptions.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  );
};

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
  if (editing?.kind === 'op') {
    return (
      <OpRowEditor
        editing={editing}
        returnOptions={returnOptions}
        expanded={expanded}
        onSave={onSave}
        onCancel={onCancel}
        onEditChange={onEditChange}
      />
    );
  }

  return (
    <UmlMemberRowDisplay
      ariaLabel={`Operation ${op.name}: ${normalizeOperationReturnType(op.returnType)}. Press Enter to edit.`}
      hovered={hovered}
      showDelete={!!showDelete}
      deleteTitle="Delete operation"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDoubleClick={onDoubleClick}
      onDelete={onDelete}
    >
      <span style={{ color: '#64748b', flexShrink: 0 }}>{op.visibility ?? '+'}</span>
      <span style={{ color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {op.name}()
      </span>
      <span style={{ color: '#94a3b8', flexShrink: 0 }}>:</span>
      <span style={{ color: UML.primary, flexShrink: 0, fontWeight: 600 }}>{normalizeOperationReturnType(op.returnType)}</span>
    </UmlMemberRowDisplay>
  );
};

const AddOpRow: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <UmlAddMemberRow label="Add operation" onClick={onClick} />
);

function PanelCheckboxField({
  id,
  label,
  checked,
  onChange,
  style,
}: Readonly<{
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  style?: React.CSSProperties;
}>) {
  return (
    <label htmlFor={id} style={style}>
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span>{label}</span>
    </label>
  );
}

function stopDiagramEventBubble(e: { stopPropagation(): void }): void {
  e.stopPropagation();
}

function handleDiagramEditPanelKeyDown(
  e: React.KeyboardEvent<HTMLDialogElement>,
  onClose: () => void,
): void {
  e.stopPropagation();
  if (e.key === 'Escape') onClose();
}

const DiagramEditPanelShell: React.FC<{
  panelDataAttr: 'class' | 'rel';
  ariaLabel: string;
  onClose: () => void;
  style: React.CSSProperties;
  children: React.ReactNode;
}> = ({ panelDataAttr, ariaLabel, onClose, style, children }) => {
  const panelRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const panelDataAttribute =
    panelDataAttr === 'class'
      ? { 'data-class-edit-panel': true as const }
      : { 'data-rel-edit-panel': true as const };

  return (
    <dialog
      ref={panelRef}
      {...panelDataAttribute}
      open
      aria-label={ariaLabel}
      style={{ ...style, margin: 0, padding: 0 }}
      onClick={stopDiagramEventBubble}
      onMouseDown={stopDiagramEventBubble}
      onKeyDown={e => handleDiagramEditPanelKeyDown(e, onClose)}
      onKeyUp={stopDiagramEventBubble}
    >
      {children}
    </dialog>
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
  <DiagramEditPanelShell
    panelDataAttr="class"
    ariaLabel={`Edit class ${cls.name}`}
    onClose={onClose}
    style={{
      position: 'absolute', top: DIAGRAM_HINT_TOP, left: 12, bottom: 12, zIndex: 35,
      width: 268, background: UML.surface, border: `1px solid ${UML.primaryBorder}`,
      borderRadius: 10, boxShadow: `0 8px 24px ${UML.primaryRing}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: UML.fontSans,
    }}
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
      <label htmlFor={`class-edit-name-${cls.id}`} style={panelLabelStyle}>Class name</label>
      <input
        id={`class-edit-name-${cls.id}`}
        value={cls.name}
        onChange={e => onUpdate({ name: e.target.value })}
        style={{ ...panelInputStyle, marginBottom: 14 }}
      />
      <PanelCheckboxField
        id={`class-edit-abstract-${cls.id}`}
        label="Abstract class"
        checked={cls.isAbstract}
        onChange={checked => onUpdate({ isAbstract: checked })}
        style={{ ...panelLabelStyle, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', fontSize: 12 }}
      />
      <PanelCheckboxField
        id={`class-edit-interface-${cls.id}`}
        label="Interface"
        checked={cls.isInterface}
        onChange={checked => onUpdate({ isInterface: checked })}
        style={{ ...panelLabelStyle, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', fontSize: 12, marginBottom: 14 }}
      />
      <label htmlFor={`class-edit-parent-${cls.id}`} style={panelLabelStyle}>Superclass (inheritance)</label>
      <select
        id={`class-edit-parent-${cls.id}`}
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
  </DiagramEditPanelShell>
);

function getDiagramToolButtonBackground(
  disabled: boolean,
  active: boolean,
  accent: boolean,
  hovered: boolean,
): string {
  if (disabled) return UML.surfaceMuted;
  if (active) return UML.primarySoft;
  if (accent && hovered) return UML.primarySoft;
  if (hovered) return '#f0fdfa';
  return UML.surface;
}

function getDiagramToolButtonColor(
  disabled: boolean,
  active: boolean,
  accent: boolean,
  hovered: boolean,
): string {
  if (disabled) return '#cbd5e1';
  if (active || accent) return UML.primary;
  if (hovered) return UML.ink;
  return UML.textMuted;
}

function getDiagramToolButtonBoxShadow(active: boolean, hovered: boolean, disabled: boolean): string {
  if (active || (hovered && !disabled)) return `0 0 0 2px ${UML.primaryRing}`;
  return 'none';
}

function getDiagramToolButtonStyle(params: {
  label?: string;
  active: boolean;
  disabled: boolean;
  accent: boolean;
  hovered: boolean;
}): React.CSSProperties {
  const hasLabel = Boolean(params.label);
  const background = getDiagramToolButtonBackground(
    params.disabled,
    params.active,
    params.accent,
    params.hovered,
  );
  const color = getDiagramToolButtonColor(
    params.disabled,
    params.active,
    params.accent,
    params.hovered,
  );
  const boxShadow = getDiagramToolButtonBoxShadow(
    params.active,
    params.hovered,
    params.disabled,
  );

  return {
    height: 34,
    minWidth: hasLabel ? 76 : 34,
    padding: hasLabel ? '0 10px' : 0,
    border: `1px solid ${params.active ? UML.primary : UML.border}`,
    borderRadius: 8,
    background,
    color,
    boxShadow,
    cursor: params.disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: UML.fontSans,
    transition: 'all 0.12s',
  };
}

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
  const buttonStyle = getDiagramToolButtonStyle({
    label,
    active,
    disabled,
    accent,
    hovered: hov,
  });

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={buttonStyle}
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

function getRelationshipEditPanelAriaLabel(rel: UMLRelationship): string {
  const base = `Edit ${rel.type} connection`;
  return rel.label ? `${base}: ${rel.label}` : base;
}

const RelationshipEditPanel: React.FC<{
  rel: UMLRelationship;
  classes: CLS[];
  onUpdate: (patch: Partial<UMLRelationship>) => void;
  onSwapEndpoints: () => void;
  onClose: () => void;
}> = ({ rel, classes, onUpdate, onSwapEndpoints, onClose }) => {
  return (
    <DiagramEditPanelShell
      panelDataAttr="rel"
      ariaLabel={getRelationshipEditPanelAriaLabel(rel)}
      onClose={onClose}
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
        <label htmlFor={`rel-edit-source-${rel.id}`} style={panelLabelStyle}>From class</label>
        <select
          id={`rel-edit-source-${rel.id}`}
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

        <label htmlFor={`rel-edit-target-${rel.id}`} style={panelLabelStyle}>To class</label>
        <select
          id={`rel-edit-target-${rel.id}`}
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

        <label htmlFor={`rel-edit-label-${rel.id}`} style={panelLabelStyle}>Connection name</label>
        <input
          id={`rel-edit-label-${rel.id}`}
          value={rel.label ?? ''}
          onChange={e => onUpdate({ label: e.target.value })}
          placeholder="e.g. manages, contains"
          style={{ ...panelInputStyle, marginBottom: 14 }}
        />

        <label htmlFor={`rel-edit-type-${rel.id}`} style={panelLabelStyle}>Type</label>
        <select
          id={`rel-edit-type-${rel.id}`}
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
            <label htmlFor={`rel-edit-source-mult-${rel.id}`} style={panelLabelStyle}>Source multiplicity</label>
            <select
              id={`rel-edit-source-mult-${rel.id}`}
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
            <label htmlFor={`rel-edit-target-mult-${rel.id}`} style={panelLabelStyle}>Target multiplicity</label>
            <select
              id={`rel-edit-target-mult-${rel.id}`}
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
    </DiagramEditPanelShell>
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
