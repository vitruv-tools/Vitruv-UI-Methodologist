export type Point = Readonly<{ x: number; y: number }>;

export enum HandlePosition {
  Top = 'top',
  Bottom = 'bottom',
  Left = 'left',
  Right = 'right',
}

export enum RoutingStyle {
  Curved = 'curved',
  Orthogonal = 'orthogonal',
}

export interface PathSegment {
  readonly start: Point;
  readonly end: Point;
  readonly isHorizontal: boolean;
  readonly canDrag: boolean;
}

export interface ReactionRelationshipData {
  label?: string;
  code?: string;
  routingStyle?: RoutingStyle;
  sourceParallelIndex?: number;
  sourceParallelCount?: number;
  targetParallelIndex?: number;
  targetParallelCount?: number;
  customControlPoint?: Point;

  // Event handlers
  onDoubleClick?: (edgeId: string) => void;
  onEdgeDragStart?: (edgeId: string) => void;
  onEdgeDrag?: (edgeId: string, point: Point) => void;
  onEdgeDragEnd?: (edgeId: string, point: Point) => void;
  onHandleChange?: (edgeId: string, sourceHandle: string, targetHandle: string) => void;
  onReorderRequest?: (edgeId: string, controlPoint: Point) => void;
}

export const NODE_DIMENSIONS = { width: 220, height: 180 } as const;
export const EDGE_SPACING = 25 as const;
