import { useCallback, useMemo, useState } from 'react';
import {
  computeLineBridges,
  optimizeMultiplicityBadges,
  resolveMultiplicityBadgeCollisions,
  type LineBridge,
  type MultiplicityBadge,
  type Point,
} from '../utils/umlDiagramGeometry';
import {
  getUmlRelationDirectionMarkerSide,
} from '../components/canvas/UMLRelationVisuals';
import {
  buildUmlClassObstacleRects,
  getUmlMultiplicityPosition,
  getUmlRelationshipEndpoints,
  insetUmlRelationshipEndpoints,
  UML_MULTIPLICITY_ALONG_OFFSET,
  UML_MULTIPLICITY_BADGE_HALF_HEIGHT,
  UML_MULTIPLICITY_BADGE_HALF_WIDTH,
  UML_MULTIPLICITY_PERPENDICULAR_OFFSET,
  type UmlDiagramRelationshipLayout,
} from '../components/canvas/umlDiagramLayoutGeometry';
import type {
  UmlDiagramClass,
} from '../components/canvas/umlDiagramTypes';

export interface UmlRelationshipEdgeLayout {
  rel: UmlDiagramRelationshipLayout;
  p1: Point;
  p2: Point;
  drawP1: Point;
  drawP2: Point;
  bridges: LineBridge[];
}

interface UmlRelationshipEdgeGeometry {
  rel: UmlDiagramRelationshipLayout;
  p1: Point;
  p2: Point;
  drawP1: Point;
  drawP2: Point;
}

export interface UseUmlRelationshipLayersOptions {
  parallelRelationships: UmlDiagramRelationshipLayout[];
  classes: UmlDiagramClass[];
  offsetX: number;
  offsetY: number;
}

export interface UseUmlRelationshipLayersResult {
  edgeLayouts: UmlRelationshipEdgeLayout[];
  multiplicityBadges: MultiplicityBadge[];
  hoveredRelationshipId: string | null;
  handleRelationshipMouseEnter: (relationshipId: string) => void;
  handleRelationshipMouseLeave: () => void;
}

export function useUmlRelationshipLayers({
  parallelRelationships,
  classes,
  offsetX,
  offsetY,
}: UseUmlRelationshipLayersOptions): UseUmlRelationshipLayersResult {
  const [hoveredRelationshipId, setHoveredRelationshipId] = useState<
    string | null
  >(null);

  const edgeLayouts = useMemo(() => {
    const raw = parallelRelationships.flatMap<UmlRelationshipEdgeGeometry>(
      relationship => {
        const endpoints = getUmlRelationshipEndpoints(
          relationship,
          classes,
          offsetX,
          offsetY,
        );
        if (!endpoints) return [];
        const { drawP1, drawP2 } = insetUmlRelationshipEndpoints(
          endpoints.p1,
          endpoints.p2,
        );
        return [{
          rel: relationship,
          p1: endpoints.p1,
          p2: endpoints.p2,
          drawP1,
          drawP2,
        }];
      },
    );

    const bridges = computeLineBridges(raw.map(layout => ({
      id: layout.rel.id,
      drawP1: layout.drawP1,
      drawP2: layout.drawP2,
    })));

    return raw.map(layout => ({
      ...layout,
      bridges: bridges.get(layout.rel.id) ?? [],
    }));
  }, [parallelRelationships, classes, offsetX, offsetY]);

  const multiplicityBadges = useMemo(() => {
    const raw: MultiplicityBadge[] = [];
    for (const layout of edgeLayouts) {
      const { rel, p1, p2 } = layout;

      const markerSide = getUmlRelationDirectionMarkerSide(rel.type);

      if (rel.sourceMultiplicity) {
        const position = getUmlMultiplicityPosition(
          p1.x,
          p1.y,
          p2.x,
          p2.y,
          'start',
          markerSide === 'start',
        );
        raw.push({
          key: `${rel.id}-src`,
          relId: rel.id,
          end: 'start',
          anchorClassId: rel.sourceId,
          text: rel.sourceMultiplicity,
          ...position,
        });
      }
      if (rel.targetMultiplicity) {
        const position = getUmlMultiplicityPosition(
          p1.x,
          p1.y,
          p2.x,
          p2.y,
          'end',
          markerSide === 'end',
        );
        raw.push({
          key: `${rel.id}-tgt`,
          relId: rel.id,
          end: 'end',
          anchorClassId: rel.targetId,
          text: rel.targetMultiplicity,
          ...position,
        });
      }
    }
    const obstacles = buildUmlClassObstacleRects(
      classes,
      offsetX,
      offsetY,
    );
    return resolveMultiplicityBadgeCollisions(
      optimizeMultiplicityBadges(
        raw,
        UML_MULTIPLICITY_ALONG_OFFSET,
        UML_MULTIPLICITY_PERPENDICULAR_OFFSET,
      ),
      obstacles,
      UML_MULTIPLICITY_BADGE_HALF_WIDTH,
      UML_MULTIPLICITY_BADGE_HALF_HEIGHT,
    );
  }, [edgeLayouts, classes, offsetX, offsetY]);

  const handleRelationshipMouseEnter = useCallback(
    (relationshipId: string) => {
      setHoveredRelationshipId(relationshipId);
    },
    [],
  );

  const handleRelationshipMouseLeave = useCallback(() => {
    setHoveredRelationshipId(null);
  }, []);

  return {
    edgeLayouts,
    multiplicityBadges,
    hoveredRelationshipId,
    handleRelationshipMouseEnter,
    handleRelationshipMouseLeave,
  };
}
