import type { UMLRelationship } from '../../utils/ecoreToUml';
import type { AxisRect } from '../../utils/umlDiagramGeometry';
import {
  UML_CLASS_ADD_MEMBER_ROW_HEIGHT,
  UML_CLASS_BOX_WIDTH,
  UML_CLASS_EMPTY_OPERATION_SECTION_HEIGHT,
  UML_CLASS_MEMBER_SECTION_PADDING,
  UML_CLASS_MEMBER_ROW_HEIGHT,
  UML_CLASS_NAME_SECTION_HEIGHT,
  UML_CLASS_STEREOTYPE_SECTION_HEIGHT,
} from './umlDiagramClassMetrics';
import type { UmlDiagramClass } from './umlDiagramTypes';

export const UML_DIAGRAM_CANVAS_PADDING = 480;
export const UML_MULTIPLICITY_ALONG_OFFSET = 52;
export const UML_MULTIPLICITY_PERPENDICULAR_OFFSET = 10;
export const UML_MULTIPLICITY_BADGE_HALF_WIDTH = 18;
export const UML_MULTIPLICITY_BADGE_HALF_HEIGHT = 12;

const UML_RELATIONSHIP_ENDPOINT_INSET = 10;
const UML_DIRECTION_MARKER_MULTIPLICITY_OFFSET = 18;
const UML_MULTIPLICITY_CLASS_CLEARANCE = 8;
const UML_PARALLEL_RELATIONSHIP_SEPARATION = 14;

export interface UmlDiagramPoint {
  x: number;
  y: number;
}

export interface UmlDiagramLayoutMetrics {
  totalW: number;
  totalH: number;
  offsetX: number;
  offsetY: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type UmlDiagramRelationshipLayout = UMLRelationship & {
  parallelIndex?: number;
  parallelCount?: number;
};

export interface UmlMultiplicityPosition extends UmlDiagramPoint {
  anchorX: number;
  anchorY: number;
  lineUx: number;
  lineUy: number;
  nx: number;
  ny: number;
  lineLength: number;
}

export function getUmlClassBoxHeight(
  classItem: UmlDiagramClass,
): number {
  const nameSectionHeight = classItem.isAbstract || classItem.isInterface
    ? UML_CLASS_STEREOTYPE_SECTION_HEIGHT
    : UML_CLASS_NAME_SECTION_HEIGHT;
  const attributeSectionHeight = classItem.attributes.length
    * UML_CLASS_MEMBER_ROW_HEIGHT
    + UML_CLASS_MEMBER_SECTION_PADDING
    + UML_CLASS_ADD_MEMBER_ROW_HEIGHT;
  const operationSectionHeight = classItem.operations.length
    * UML_CLASS_MEMBER_ROW_HEIGHT
    + (
      classItem.operations.length > 0
        ? UML_CLASS_MEMBER_SECTION_PADDING
        : 0
    )
    + UML_CLASS_ADD_MEMBER_ROW_HEIGHT;
  const methodSectionHeight = Math.max(
    UML_CLASS_EMPTY_OPERATION_SECTION_HEIGHT,
    operationSectionHeight,
  );
  return nameSectionHeight
    + 1
    + attributeSectionHeight
    + 1
    + methodSectionHeight;
}

export function getUmlDiagramLayoutMetrics(
  classes: readonly UmlDiagramClass[],
  frozenOffset?: { offsetX: number; offsetY: number } | null,
): UmlDiagramLayoutMetrics {
  if (classes.length === 0) {
    return {
      totalW: 1200,
      totalH: 900,
      offsetX: UML_DIAGRAM_CANVAS_PADDING,
      offsetY: UML_DIAGRAM_CANVAS_PADDING,
      minX: 0,
      minY: 0,
      maxX: 700,
      maxY: 400,
    };
  }
  const minX = Math.min(...classes.map(classItem => classItem.x));
  const minY = Math.min(...classes.map(classItem => classItem.y));
  const maxX = Math.max(
    ...classes.map(classItem => classItem.x + UML_CLASS_BOX_WIDTH),
  );
  const maxY = Math.max(
    ...classes.map(
      classItem => classItem.y + getUmlClassBoxHeight(classItem),
    ),
  );
  const offsetX = frozenOffset?.offsetX
    ?? UML_DIAGRAM_CANVAS_PADDING - minX;
  const offsetY = frozenOffset?.offsetY
    ?? UML_DIAGRAM_CANVAS_PADDING - minY;
  const displayedMinX = minX + offsetX;
  const displayedMinY = minY + offsetY;
  const displayedMaxX = maxX + offsetX;
  const displayedMaxY = maxY + offsetY;
  return {
    totalW: Math.max(
      displayedMaxX + UML_DIAGRAM_CANVAS_PADDING,
      displayedMaxX
        - displayedMinX
        + UML_DIAGRAM_CANVAS_PADDING * 2,
    ),
    totalH: Math.max(
      displayedMaxY + UML_DIAGRAM_CANVAS_PADDING,
      displayedMaxY
        - displayedMinY
        + UML_DIAGRAM_CANVAS_PADDING * 2,
    ),
    offsetX,
    offsetY,
    minX,
    minY,
    maxX,
    maxY,
  };
}

export function getUmlClassBoxEdgeIntersectionPoint(
  boxX: number,
  boxY: number,
  boxHeight: number,
  targetX: number,
  targetY: number,
): UmlDiagramPoint {
  const centerX = boxX + UML_CLASS_BOX_WIDTH / 2;
  const centerY = boxY + boxHeight / 2;
  const dx = targetX - centerX;
  const dy = targetY - centerY;
  if (!dx && !dy) return { x: centerX, y: centerY };
  const halfWidth = UML_CLASS_BOX_WIDTH / 2;
  const halfHeight = boxHeight / 2;
  const distance = Math.abs(dx) * halfHeight > Math.abs(dy) * halfWidth
    ? halfWidth / Math.abs(dx)
    : halfHeight / Math.abs(dy);
  return {
    x: centerX + dx * distance,
    y: centerY + dy * distance,
  };
}

export function offsetParallelUmlRelationshipEndpoints(
  firstPoint: UmlDiagramPoint,
  secondPoint: UmlDiagramPoint,
  parallelIndex: number,
  parallelCount: number,
): { p1: UmlDiagramPoint; p2: UmlDiagramPoint } {
  if (parallelCount <= 1) {
    return { p1: firstPoint, p2: secondPoint };
  }
  const lineLength = Math.max(
    Math.hypot(
      secondPoint.x - firstPoint.x,
      secondPoint.y - firstPoint.y,
    ),
    0.0001,
  );
  const offset = (
    parallelIndex - (parallelCount - 1) / 2
  ) * UML_PARALLEL_RELATIONSHIP_SEPARATION;
  const normalX = -(secondPoint.y - firstPoint.y) / lineLength;
  const normalY = (secondPoint.x - firstPoint.x) / lineLength;
  return {
    p1: {
      x: firstPoint.x + normalX * offset,
      y: firstPoint.y + normalY * offset,
    },
    p2: {
      x: secondPoint.x + normalX * offset,
      y: secondPoint.y + normalY * offset,
    },
  };
}

export function getUmlRelationshipEndpoints(
  relationship: UmlDiagramRelationshipLayout,
  classes: readonly UmlDiagramClass[],
  offsetX: number,
  offsetY: number,
): { p1: UmlDiagramPoint; p2: UmlDiagramPoint } | null {
  const sourceClass = classes.find(
    classItem => classItem.id === relationship.sourceId,
  );
  const targetClass = classes.find(
    classItem => classItem.id === relationship.targetId,
  );
  if (!sourceClass || !targetClass) return null;

  const sourceHeight = getUmlClassBoxHeight(sourceClass);
  const targetHeight = getUmlClassBoxHeight(targetClass);
  const sourceX = sourceClass.x + offsetX;
  const sourceY = sourceClass.y + offsetY;
  const targetX = targetClass.x + offsetX;
  const targetY = targetClass.y + offsetY;
  const firstPoint = getUmlClassBoxEdgeIntersectionPoint(
    sourceX,
    sourceY,
    sourceHeight,
    targetX + UML_CLASS_BOX_WIDTH / 2,
    targetY + targetHeight / 2,
  );
  const secondPoint = getUmlClassBoxEdgeIntersectionPoint(
    targetX,
    targetY,
    targetHeight,
    sourceX + UML_CLASS_BOX_WIDTH / 2,
    sourceY + sourceHeight / 2,
  );
  return offsetParallelUmlRelationshipEndpoints(
    firstPoint,
    secondPoint,
    relationship.parallelIndex ?? 0,
    relationship.parallelCount ?? 1,
  );
}

export function insetUmlRelationshipEndpoints(
  firstPoint: UmlDiagramPoint,
  secondPoint: UmlDiagramPoint,
): {
  drawP1: UmlDiagramPoint;
  drawP2: UmlDiagramPoint;
  ux: number;
  uy: number;
} {
  const dx = secondPoint.x - firstPoint.x;
  const dy = secondPoint.y - firstPoint.y;
  const lineLength = Math.max(Math.hypot(dx, dy), 0.0001);
  const unitX = dx / lineLength;
  const unitY = dy / lineLength;
  const inset = Math.min(
    UML_RELATIONSHIP_ENDPOINT_INSET,
    Math.max(0, lineLength / 2 - 8),
  );
  return {
    drawP1: {
      x: firstPoint.x + unitX * inset,
      y: firstPoint.y + unitY * inset,
    },
    drawP2: {
      x: secondPoint.x - unitX * inset,
      y: secondPoint.y - unitY * inset,
    },
    ux: unitX,
    uy: unitY,
  };
}

export function getUmlMultiplicityPosition(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  end: 'start' | 'end',
  hasDirectionMarker = false,
): UmlMultiplicityPosition {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lineLength = Math.max(Math.hypot(dx, dy), 0.0001);
  const lineUx = dx / lineLength;
  const lineUy = dy / lineLength;
  const normalX = -lineUy;
  const normalY = lineUx;
  const markerExtra = hasDirectionMarker
    ? UML_DIRECTION_MARKER_MULTIPLICITY_OFFSET
    : 0;
  const idealAlong = UML_MULTIPLICITY_ALONG_OFFSET + markerExtra;
  const maxAlong = Math.max(
    26,
    (
      lineLength
      - UML_MULTIPLICITY_BADGE_HALF_HEIGHT * 2
      - 10
    ) / 2,
  );
  const alongMagnitude = Math.min(idealAlong, maxAlong);
  const along = end === 'start' ? alongMagnitude : -alongMagnitude;
  const anchorX = end === 'start' ? x1 : x2;
  const anchorY = end === 'start' ? y1 : y2;
  const perpendicularOffset = lineLength < 120
    ? UML_MULTIPLICITY_PERPENDICULAR_OFFSET
      + Math.min(28, (120 - lineLength) * 0.35)
    : UML_MULTIPLICITY_PERPENDICULAR_OFFSET;
  return {
    anchorX,
    anchorY,
    lineUx,
    lineUy,
    nx: normalX,
    ny: normalY,
    lineLength,
    x: anchorX
      + lineUx * along
      + normalX * perpendicularOffset,
    y: anchorY
      + lineUy * along
      + normalY * perpendicularOffset,
  };
}

export function buildUmlClassObstacleRects(
  classes: readonly UmlDiagramClass[],
  offsetX: number,
  offsetY: number,
): AxisRect[] {
  return classes.map(classItem => ({
    left: classItem.x + offsetX - UML_MULTIPLICITY_CLASS_CLEARANCE,
    top: classItem.y + offsetY - UML_MULTIPLICITY_CLASS_CLEARANCE,
    right: classItem.x
      + offsetX
      + UML_CLASS_BOX_WIDTH
      + UML_MULTIPLICITY_CLASS_CLEARANCE,
    bottom: classItem.y
      + offsetY
      + getUmlClassBoxHeight(classItem)
      + UML_MULTIPLICITY_CLASS_CLEARANCE,
  }));
}
