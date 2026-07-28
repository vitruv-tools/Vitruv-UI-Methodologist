import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import type { ReactionEdge } from '../../types/reactions';
import type { UMLRelationship } from '../../utils/ecoreToUml';
import {
  bridgedLinePathD,
  type LineBridge,
  type MultiplicityBadge,
  type Point,
} from '../../utils/umlDiagramGeometry';

export type UmlRelationEdgeState = 'default' | 'hovered' | 'selected';

export function getUmlRelationEdgeState(
  isSelected: boolean,
  isHovered: boolean,
): UmlRelationEdgeState {
  if (isSelected) return 'selected';
  if (isHovered) return 'hovered';
  return 'default';
}

export const UML_RELATION_EDGE_COLORS: Record<UmlRelationEdgeState, string> = {
  default: '#0c436e',
  hovered: '#f87171',
  selected: '#ef4444',
};

export const UML_REACTION_EDGE_COLORS: Record<UmlRelationEdgeState, string> = {
  default: '#a855f7',
  hovered: '#9333ea',
  selected: '#7e22ce',
};

export const UML_RELATION_EDGE_WIDTHS: Record<UmlRelationEdgeState, number> = {
  default: 1.5,
  hovered: 2.5,
  selected: 3,
};

export type UmlRelationDirectionMarkerSide = 'start' | 'end';

export function getUmlRelationDirectionMarkerSide(
  type: UMLRelationship['type'],
): UmlRelationDirectionMarkerSide | null {
  if (type === 'composition') return 'start';
  if (type === 'inheritance' || type === 'association') return 'end';
  return null;
}

function getReactionArrowSvg(color: string): ReactNode {
  return <path d="M 0 0 L 12 6 L 0 12 z" fill={color} />;
}

function getDirectionMarkerSvg(
  type: UMLRelationship['type'],
  color: string,
): ReactNode {
  if (type === 'association') {
    return <path d="M 0 0 L 12 6 L 0 12 z" fill={color} />;
  }
  if (type === 'inheritance') {
    return (
      <path
        d="M 0 0 L 12 6 L 0 12 z"
        fill="#ffffff"
        stroke={color}
        strokeWidth="1.5"
      />
    );
  }
  if (type === 'composition') {
    return <path d="M 7 1 L 13 7 L 7 13 L 1 7 Z" fill={color} />;
  }
  return null;
}

function getDirectionMarkerViewBox(type: UMLRelationship['type']): string {
  return type === 'composition' ? '0 0 14 14' : '0 0 12 12';
}

function getDirectionMarkerSize(type: UMLRelationship['type']): number {
  return type === 'composition' ? 20 : 18;
}

function getDirectionMarkerAnchor(anchor: Point): Point {
  return anchor;
}

export interface UMLRelationLineProps {
  rel: UMLRelationship;
  p1: Point;
  p2: Point;
  drawP1: Point;
  drawP2: Point;
  bridges: LineBridge[];
  state: UmlRelationEdgeState;
  reactionEdge?: ReactionEdge;
}

export const UMLRelationLine = ({
  rel,
  p1,
  p2,
  drawP1,
  drawP2,
  bridges,
  state,
  reactionEdge,
}: UMLRelationLineProps) => {
  const strokeColor = reactionEdge
    ? UML_REACTION_EDGE_COLORS[state]
    : UML_RELATION_EDGE_COLORS[state];
  const strokeWidth = UML_RELATION_EDGE_WIDTHS[state];
  const haloPath = bridgedLinePathD(drawP1, drawP2, bridges);
  const midpointX = (p1.x + p2.x) / 2;
  const midpointY = (p1.y + p2.y) / 2;

  return (
    <g data-rel-line data-testid="uml-relation-line" style={{ pointerEvents: 'none' }}>
      <path
        d={haloPath}
        fill="none"
        stroke="#ffffff"
        strokeWidth={strokeWidth + 4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={haloPath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {rel.label && (
        <text
          x={midpointX}
          y={midpointY - 5}
          textAnchor="middle"
          fontSize="10"
          fill={strokeColor}
          stroke="#ffffff"
          strokeWidth={3}
          paintOrder="stroke fill"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          pointerEvents="none"
        >
          {rel.label}
        </text>
      )}
    </g>
  );
};

export interface UMLRelationHitTargetProps {
  relId: string;
  drawP1: Point;
  drawP2: Point;
  bridges: LineBridge[];
  onRelClick: (event: ReactMouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/** Wide invisible stroke above class boxes — fixes clicks blocked by class z-order. */
export const UMLRelationHitTarget = ({
  relId,
  drawP1,
  drawP2,
  bridges,
  onRelClick,
  onMouseEnter,
  onMouseLeave,
}: UMLRelationHitTargetProps) => {
  const path = bridgedLinePathD(drawP1, drawP2, bridges);

  return (
    <path
      data-rel-hit-line
      data-rel-id={relId}
      data-testid="uml-relation-hit-target"
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

export interface UMLMultiplicityBadgeProps {
  badge: MultiplicityBadge;
  strokeColor: string;
}

export const UMLMultiplicityBadge = ({
  badge,
  strokeColor,
}: UMLMultiplicityBadgeProps) => (
  <g data-mult-badge data-testid="uml-multiplicity-badge" pointerEvents="none">
    <rect
      x={badge.x - 18}
      y={badge.y - 12}
      width={36}
      height={24}
      rx={4}
      fill="#ffffff"
      stroke={strokeColor}
      strokeWidth={1.5}
    />
    <text
      x={badge.x}
      y={badge.y + 4}
      textAnchor="middle"
      fontSize="13"
      fontWeight={700}
      fill={strokeColor}
      fontFamily="ui-monospace, Consolas, monospace"
    >
      {badge.text}
    </text>
  </g>
);

export interface UMLRelationDirectionMarkerProps {
  rel: UMLRelationship;
  lineStart: Point;
  lineEnd: Point;
  color: string;
  reactionEdge?: ReactionEdge;
  onRelClick: (event: ReactMouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const UMLRelationDirectionMarker = ({
  rel,
  lineStart,
  lineEnd,
  color,
  reactionEdge,
  onRelClick,
  onMouseEnter,
  onMouseLeave,
}: UMLRelationDirectionMarkerProps) => {
  const deltaX = lineEnd.x - lineStart.x;
  const deltaY = lineEnd.y - lineStart.y;
  const baseRotation = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

  const renderMarker = (
    side: UmlRelationDirectionMarkerSide,
    graphic: ReactNode,
    rotation: number,
    markerKey: string,
  ) => {
    const lineAnchor = side === 'start' ? lineStart : lineEnd;
    const { x, y } = getDirectionMarkerAnchor(lineAnchor);
    const markerSize = reactionEdge ? 18 : getDirectionMarkerSize(rel.type);
    const viewBox = reactionEdge ? '0 0 12 12' : getDirectionMarkerViewBox(rel.type);

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
    const arrow = getReactionArrowSvg(color);
    const markers = reactionEdge.config.bidirectional
      ? [
          { side: 'start' as const, rotation: baseRotation + 180, key: 'start' },
          { side: 'end' as const, rotation: baseRotation, key: 'end' },
        ]
      : [{ side: 'end' as const, rotation: baseRotation, key: 'end' }];

    return (
      <>
        {markers.map(marker =>
          renderMarker(marker.side, arrow, marker.rotation, `${rel.id}-${marker.key}`),
        )}
      </>
    );
  }

  const side = getUmlRelationDirectionMarkerSide(rel.type);
  const graphic = getDirectionMarkerSvg(rel.type, color);
  if (!side || !graphic) return null;

  return renderMarker(side, graphic, baseRotation, rel.id);
};
