import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ReactionEdge } from '../../types/reactions';
import type { MultiplicityBadge } from '../../utils/umlDiagramGeometry';
import type {
  UmlRelationshipEdgeLayout,
} from '../../hooks/useUmlRelationshipLayers';
import {
  getUmlRelationEdgeState,
  UMLMultiplicityBadge,
  UMLRelationDirectionMarker,
  UMLRelationHitTarget,
  UMLRelationLine,
  UML_REACTION_EDGE_COLORS,
  UML_RELATION_EDGE_COLORS,
} from './UMLRelationVisuals';

export interface UMLRelationshipBaseLayerProps {
  totalWidth: number;
  totalHeight: number;
  edgeLayouts: UmlRelationshipEdgeLayout[];
  reactionEdgeById: Map<string, ReactionEdge>;
  selectedRelationshipId: string | null;
  hoveredRelationshipId: string | null;
  onBackgroundClick: () => void;
}

export const UMLRelationshipBaseLayer = ({
  totalWidth,
  totalHeight,
  edgeLayouts,
  reactionEdgeById,
  selectedRelationshipId,
  hoveredRelationshipId,
  onBackgroundClick,
}: UMLRelationshipBaseLayerProps) => (
  <svg
    data-testid="uml-relationship-base-layer"
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: totalWidth,
      height: totalHeight,
      overflow: 'visible',
    }}
    onClick={onBackgroundClick}
  >
    {edgeLayouts.map(layout => {
      const { rel, p1, p2, drawP1, drawP2, bridges } = layout;
      const reactionEdge = reactionEdgeById.get(rel.id);
      const state = getUmlRelationEdgeState(
        selectedRelationshipId === rel.id,
        hoveredRelationshipId === rel.id,
      );

      return (
        <UMLRelationLine
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
);

export interface UMLRelationshipOverlayLayersProps {
  totalWidth: number;
  totalHeight: number;
  edgeLayouts: UmlRelationshipEdgeLayout[];
  multiplicityBadges: MultiplicityBadge[];
  reactionEdgeById: Map<string, ReactionEdge>;
  selectedRelationshipId: string | null;
  hoveredRelationshipId: string | null;
  onRelationshipClick: (
    relationshipId: string,
    event: ReactMouseEvent,
  ) => void;
  onRelationshipMouseEnter: (relationshipId: string) => void;
  onRelationshipMouseLeave: () => void;
}

export const UMLRelationshipOverlayLayers = ({
  totalWidth,
  totalHeight,
  edgeLayouts,
  multiplicityBadges,
  reactionEdgeById,
  selectedRelationshipId,
  hoveredRelationshipId,
  onRelationshipClick,
  onRelationshipMouseEnter,
  onRelationshipMouseLeave,
}: UMLRelationshipOverlayLayersProps) => (
  <>
    <svg
      data-rel-hit-layer
      data-testid="uml-relationship-hit-layer"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: totalWidth,
        height: totalHeight,
        overflow: 'visible',
        zIndex: 6,
        pointerEvents: 'none',
      }}
    >
      {edgeLayouts.map(layout => {
        const { rel, drawP1, drawP2, bridges } = layout;
        return (
          <UMLRelationHitTarget
            key={`hit-${rel.id}`}
            relId={rel.id}
            drawP1={drawP1}
            drawP2={drawP2}
            bridges={bridges}
            onRelClick={event => onRelationshipClick(rel.id, event)}
            onMouseEnter={() => onRelationshipMouseEnter(rel.id)}
            onMouseLeave={onRelationshipMouseLeave}
          />
        );
      })}
    </svg>

    <svg
      data-mult-badge-layer
      data-testid="uml-relationship-multiplicity-layer"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: totalWidth,
        height: totalHeight,
        overflow: 'visible',
        zIndex: 22,
        pointerEvents: 'none',
      }}
    >
      {multiplicityBadges.map(badge => {
        const state = getUmlRelationEdgeState(
          selectedRelationshipId === badge.relId,
          hoveredRelationshipId === badge.relId,
        );
        return (
          <UMLMultiplicityBadge
            key={badge.key}
            badge={badge}
            strokeColor={UML_RELATION_EDGE_COLORS[state]}
          />
        );
      })}
    </svg>

    {edgeLayouts.map(layout => {
      const { rel, p1, p2 } = layout;
      const reactionEdge = reactionEdgeById.get(rel.id);
      const state = getUmlRelationEdgeState(
        selectedRelationshipId === rel.id,
        hoveredRelationshipId === rel.id,
      );
      const color = reactionEdge
        ? UML_REACTION_EDGE_COLORS[state]
        : UML_RELATION_EDGE_COLORS[state];

      return (
        <UMLRelationDirectionMarker
          key={`${rel.id}-direction`}
          rel={rel}
          reactionEdge={reactionEdge}
          lineStart={p1}
          lineEnd={p2}
          color={color}
          onRelClick={event => onRelationshipClick(rel.id, event)}
          onMouseEnter={() => onRelationshipMouseEnter(rel.id)}
          onMouseLeave={onRelationshipMouseLeave}
        />
      );
    })}
  </>
);
