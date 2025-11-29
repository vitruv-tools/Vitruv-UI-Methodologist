import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { EdgeProps, Position, useReactFlow } from 'reactflow';

interface ReactionRelationshipData {
  label?: string;
  code?: string;
  onDoubleClick?: (edgeId: string) => void;
  routingStyle?: 'curved' | 'orthogonal';
  sourceParallelIndex?: number;
  sourceParallelCount?: number;
  targetParallelIndex?: number;
  targetParallelCount?: number;
  customControlPoint?: { x: number; y: number };
  onEdgeDragStart?: (edgeId: string) => void;
  onEdgeDrag?: (edgeId: string, point: { x: number; y: number }) => void;
  onEdgeDragEnd?: (edgeId: string, point: { x: number; y: number }) => void;
  onHandleChange?: (edgeId: string, sourceHandle: string, targetHandle: string) => void;
  onReorderRequest?: (edgeId: string, controlPoint: { x: number; y: number }) => void;
}

type HandlePosition = 'top' | 'bottom' | 'left' | 'right';

const NODE_DIMENSIONS = { width: 220, height: 180 };
const EDGE_SPACING = 25;

interface PathSegment {
  start: { x: number; y: number };
  end: { x: number; y: number };
  isHorizontal: boolean;
  canDrag: boolean;
}

export function ReactionRelationship({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  style,
}: EdgeProps<ReactionRelationshipData>) {
  
  const reactFlowInstance = useReactFlow();
  const [isDraggingSegment, setIsDraggingSegment] = useState(false);
  const [draggedSegmentIndex, setDraggedSegmentIndex] = useState<number | null>(null);
  const [tempControlPoint, setTempControlPoint] = useState<{ x: number; y: number } | null>(null);

  

  /**
   * Calculates the offset for parallel edges to distribute them evenly.
   *
   * @param parallelCount - Total number of parallel edges
   * @param parallelIndex - Index of the current edge (0-based)
   * @param isVertical - Whether the layout is vertical
   * @returns Object with X and Y offset for positioning
   */
  const calculateParallelOffset = (
    parallelCount: number,
    parallelIndex: number,
    isVertical: boolean
  ): { offsetX: number; offsetY: number } => {
    if (parallelCount <= 1) return { offsetX: 0, offsetY: 0 };

    // Compute distance from the center
    const centerOffset = (parallelCount - 1) / 2;
    const indexOffset = parallelIndex - centerOffset;
    const offset = indexOffset * EDGE_SPACING;

    // Apply offset based on orientation
    return isVertical
      ? { offsetX: 0, offsetY: offset }
      : { offsetX: offset, offsetY: 0 };
  };



  // Calculate offset for the source edge based on its parallel index and orientation
  const sourceOffset = calculateParallelOffset(
    data?.sourceParallelCount ?? 1, // Total parallel edges at source (default: 1)
    data?.sourceParallelIndex ?? 0, // Current edge index at source (default: 0)
    sourcePosition === Position.Left || sourcePosition === Position.Right // Vertical if source is left/right
  );

  // Calculate offset for the target edge based on its parallel index and orientation
  const targetOffset = calculateParallelOffset(
    data?.targetParallelCount ?? 1, // Total parallel edges at target (default: 1)
    data?.targetParallelIndex ?? 0, // Current edge index at target (default: 0)
    targetPosition === Position.Left || targetPosition === Position.Right // Vertical if target is left/right
  );


  const actualSourceX = sourceX + sourceOffset.offsetX;
  const actualSourceY = sourceY + sourceOffset.offsetY;
  const actualTargetX = targetX + targetOffset.offsetX;
  const actualTargetY = targetY + targetOffset.offsetY;


  /**
   * Finds the closest handle (top, bottom, left, right) on a node to a given point.
   *
   * @param point - The reference point
   * @param nodeId - The ID of the node to check
   * @returns The closest handle position or null if node not found
   */
  const getClosestHandle = useCallback(
    (point: Readonly<{ x: number; y: number }>, nodeId: string): HandlePosition | null => {
      if (!reactFlowInstance) return null;

      const node = reactFlowInstance.getNode(nodeId);
      if (!node) return null;

      const { width, height } = NODE_DIMENSIONS;

      // Predefined handle positions for clarity and type safety
      const handlePositions: Record<HandlePosition, { x: number; y: number }> = {
        top:    { x: node.position.x + width / 2, y: node.position.y },
        bottom: { x: node.position.x + width / 2, y: node.position.y + height },
        left:   { x: node.position.x,             y: node.position.y + height / 2 },
        right:  { x: node.position.x + width,     y: node.position.y + height / 2 },
      };

      let closestHandle: HandlePosition = 'right';
      let minDistanceSquared = Number.POSITIVE_INFINITY;

      // Iterate over handles and compute squared distance (faster than Math.hypot)
      for (const handle of ['top', 'bottom', 'left', 'right'] as const) {
        const pos = handlePositions[handle];
        const dx = point.x - pos.x;
        const dy = point.y - pos.y;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared < minDistanceSquared) {
          minDistanceSquared = distanceSquared;
          closestHandle = handle;
        }
      }

      return closestHandle;
    },
    [reactFlowInstance]
  );



/**
 * Memoized calculation of edge path, label position, arrow angle, and segments.
 */
const pathData = useMemo(() => {
  // Determine control point (temporary > custom > midpoint)
  const centerX = tempControlPoint?.x ?? data?.customControlPoint?.x ?? (actualSourceX + actualTargetX) / 2;
  const centerY = tempControlPoint?.y ?? data?.customControlPoint?.y ?? (actualSourceY + actualTargetY) / 2;

  const dx = actualTargetX - actualSourceX;
  const dy = actualTargetY - actualSourceY;

  // Orthogonal routing style
  if (data?.routingStyle === 'orthogonal') {
    const isSourceHorizontal = sourcePosition === Position.Right || sourcePosition === Position.Left;

    // Build edge path string
    const edgePath = isSourceHorizontal
      ? `M ${actualSourceX},${actualSourceY} L ${centerX},${actualSourceY} L ${centerX},${actualTargetY} L ${actualTargetX},${actualTargetY}`
      : `M ${actualSourceX},${actualSourceY} L ${actualSourceX},${centerY} L ${actualTargetX},${centerY} L ${actualTargetX},${actualTargetY}`;

    // Define path segments for interaction
    const segments: PathSegment[] = isSourceHorizontal
      ? [
          { start: { x: actualSourceX, y: actualSourceY }, end: { x: centerX, y: actualSourceY }, isHorizontal: true, canDrag: false },
          { start: { x: centerX, y: actualSourceY }, end: { x: centerX, y: actualTargetY }, isHorizontal: false, canDrag: true },
          { start: { x: centerX, y: actualTargetY }, end: { x: actualTargetX, y: actualTargetY }, isHorizontal: true, canDrag: false },
        ]
      : [
          { start: { x: actualSourceX, y: actualSourceY }, end: { x: actualSourceX, y: centerY }, isHorizontal: false, canDrag: false },
          { start: { x: actualSourceX, y: centerY }, end: { x: actualTargetX, y: centerY }, isHorizontal: true, canDrag: true },
          { start: { x: actualTargetX, y: centerY }, end: { x: actualTargetX, y: actualTargetY }, isHorizontal: false, canDrag: false },
        ];

    // Arrow angle mapping for orthogonal edges
    const arrowAngles: Record<Position, number> = {
      [Position.Top]: 90,
      [Position.Bottom]: -90,
      [Position.Left]: 0,
      [Position.Right]: 180,
    };

    return {
      edgePath,
      labelX: centerX,
      labelY: centerY,
      arrowX: actualTargetX,
      arrowY: actualTargetY,
      arrowAngle: arrowAngles[targetPosition] ?? 0,
      controlPoint: { x: centerX, y: centerY },
      segments,
    };
  }

  // Default: straight line routing
  return {
    edgePath: `M ${actualSourceX},${actualSourceY} L ${actualTargetX},${actualTargetY}`,
    labelX: (actualSourceX + actualTargetX) / 2,
    labelY: (actualSourceY + actualTargetY) / 2,
    arrowX: actualTargetX,
    arrowY: actualTargetY,
    arrowAngle: Math.atan2(dy, dx) * (180 / Math.PI),
    controlPoint: null,
    segments: [],
  };
}, [
  actualSourceX,
  actualSourceY,
  actualTargetX,
  actualTargetY,
  data?.routingStyle,
  data?.customControlPoint,
  tempControlPoint,
  sourcePosition,
  targetPosition,
]);


  const { edgePath, labelX, labelY, arrowX, arrowY, arrowAngle, controlPoint, segments } = pathData;

 
/**
 * Handles the start of a segment drag operation.
 *
 * @param e - Pointer event triggered on drag start
 * @param segmentIndex - Index of the segment being dragged
 */
const handleSegmentDragStart = useCallback(
  (e: React.PointerEvent, segmentIndex: number) => {
    // Prevent default behavior and stop event bubbling
    e.stopPropagation();
    e.preventDefault();

    // Attempt to capture the pointer for consistent drag events
    const targetEl = e.target as HTMLElement;
    if (targetEl.setPointerCapture) {
      try {
        targetEl.setPointerCapture(e.pointerId);
      } catch {
        // Ignore errors (e.g., unsupported browsers)
      }
    }

    // Ensure required state and instance are available
    if (!reactFlowInstance || !controlPoint) return;

    // Update drag state
    setIsDraggingSegment(true);
    setDraggedSegmentIndex(segmentIndex);
    setTempControlPoint(controlPoint);

    // Trigger optional callback for drag start
    data?.onEdgeDragStart?.(id);
  },
  [id, data, reactFlowInstance, controlPoint]
);


/**
 * Handles segment dragging by updating the control point and related edge state.
 *
 * @param e - Pointer event during drag
 */
const handleSegmentDrag = useCallback(
  (e: PointerEvent) => {
    if (!isDraggingSegment || draggedSegmentIndex === null || !reactFlowInstance || !controlPoint) return;

    // Convert screen coordinates to flow coordinates
    const flowPos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });

    const segment = segments[draggedSegmentIndex];
    if (!segment) return;

    // Update control point based on segment orientation
    const newControlPoint = { ...controlPoint };
    if (segment.isHorizontal) {
      newControlPoint.y = flowPos.y;
    } else {
      newControlPoint.x = flowPos.x;
    }

    // Update temporary control point and trigger callbacks
    setTempControlPoint(newControlPoint);
    data?.onEdgeDrag?.(id, newControlPoint);

    // Check if handle positions need to change
    const newSourceHandle = getClosestHandle(newControlPoint, source);
    const newTargetHandle = getClosestHandle(newControlPoint, target);

    if (
      newSourceHandle &&
      newTargetHandle &&
      (newSourceHandle !== sourcePosition || newTargetHandle !== targetPosition)
    ) {
      data?.onHandleChange?.(id, newSourceHandle, newTargetHandle);
    }

    // Notify reorder request
    data?.onReorderRequest?.(id, newControlPoint);
  },
  [
    isDraggingSegment,
    draggedSegmentIndex,
    id,
    reactFlowInstance,
    data,
    segments,
    controlPoint,
    getClosestHandle,
    source,
    target,
    sourcePosition,
    targetPosition,
  ]
);

/**
 * Handles the end of a segment drag operation.
 *
 * @param e - Pointer event triggered on drag end
 */
const handleSegmentDragEnd = useCallback(
  (e: PointerEvent) => {
    if (!isDraggingSegment) return;

    // Trigger drag end callback if control point exists
    if (tempControlPoint) {
      data?.onEdgeDragEnd?.(id, tempControlPoint);
    }

    // Reset drag state
    setIsDraggingSegment(false);
    setDraggedSegmentIndex(null);
  },
  [isDraggingSegment, id, data, tempControlPoint]
);

/**
 * Attach and clean up global pointer event listeners during drag.
 */
useEffect(() => {
  if (!isDraggingSegment) return;

  document.addEventListener('pointermove', handleSegmentDrag);
  document.addEventListener('pointerup', handleSegmentDragEnd);

  return () => {
    document.removeEventListener('pointermove', handleSegmentDrag);
    document.removeEventListener('pointerup', handleSegmentDragEnd);
  };
}, [isDraggingSegment, handleSegmentDrag, handleSegmentDragEnd]);


  useEffect(() => {
    if (!selected) {
      setTempControlPoint(null);
    }
  }, [selected]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    data?.onDoubleClick?.(id);
  };

  const hasCode = data?.code && data.code.trim().length > 0;
  const edgeColor = style?.stroke || '#3b82f6';
  const edgeWidth = style?.strokeWidth || 2;
  const sourceParallelCount = data?.sourceParallelCount ?? 1;
  const targetParallelCount = data?.targetParallelCount ?? 1;


return (
  <>
    {/* Underlay path for visual thickness */}
    <path
      id={`${id}-underlay`}
      d={edgePath}
      className="react-flow__edge-path"
      style={{
        stroke: '#ffffff',
        strokeWidth: selected ? 8 : 7,
        opacity: 0.95,
        fill: 'none',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
    />

    {/* Invisible click area for better interaction */}
    <path
      id={`${id}-clickarea`}
      d={edgePath}
      style={{
        strokeWidth: '20px',
        stroke: 'transparent',
        fill: 'none',
        cursor: 'pointer',
      }}
      onDoubleClick={handleDoubleClick}
    />

    {/* Main edge path */}
    <path
      id={id}
      d={edgePath}
      style={{
        strokeWidth: selected ? `${Number(edgeWidth) + 2}px` : `${edgeWidth}px`,
        stroke: selected ? '#ef4444' : edgeColor,
        fill: 'none',
        cursor: 'pointer',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
      onDoubleClick={handleDoubleClick}
    />

    {/* Arrow marker */}
    <g transform={`translate(${arrowX}, ${arrowY}) rotate(${arrowAngle})`}>
      <polygon
        points="-10,-6 0,0 -10,6"
        fill={selected ? '#ef4444' : edgeColor}
        stroke={selected ? '#ef4444' : edgeColor}
        strokeWidth="1"
        style={{ cursor: 'pointer' }}
        onDoubleClick={handleDoubleClick}
      />
    </g>

    {/* Edge label */}
    {data?.label && (
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontSize: '12px',
          fontWeight: 700,
          fill: selected ? '#ef4444' : '#1f2937',
          stroke: '#ffffff',
          strokeWidth: 3.5,
          paintOrder: 'stroke fill',
          pointerEvents: 'none',
        }}
      >
        {data.label}
      </text>
    )}

    {/* Code indicator */}
    {hasCode && (
      <g onDoubleClick={handleDoubleClick} style={{ cursor: 'pointer' }}>
        <circle
          cx={labelX + 20}
          cy={labelY - 15}
          r="10"
          fill={selected ? '#ef4444' : '#0e639c'}
          stroke="#fff"
          strokeWidth="2"
        />
        <text
          x={labelX + 20}
          y={labelY - 15}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: '11px',
            fontWeight: 'bold',
            fill: '#fff',
            pointerEvents: 'none',
          }}
        >
          {'</>'}
        </text>
      </g>
    )}

    {/* Parallel edge count indicator */}
    {selected && (sourceParallelCount > 1 || targetParallelCount > 1) && (
      <g>
        <rect
          x={labelX - 12}
          y={labelY + 8}
          rx={6}
          ry={6}
          width={24}
          height={16}
          fill="#ef4444"
          stroke="#ffffff"
          strokeWidth={2}
        />
        <text
          x={labelX}
          y={labelY + 16}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: '10px',
            fontWeight: 800,
            fill: '#ffffff',
            pointerEvents: 'none',
          }}
        >
          {String(Math.max(sourceParallelCount, targetParallelCount))}
        </text>
      </g>
    )}

    {/* Draggable segments for orthogonal routing */}
    {selected && data?.routingStyle === 'orthogonal' &&
      segments.map((segment, index) => {
        if (!segment.canDrag) return null;

        const segmentPath = `M ${segment.start.x},${segment.start.y} L ${segment.end.x},${segment.end.y}`;
        const isBeingDragged = isDraggingSegment && draggedSegmentIndex === index;

        return (
          <g key={`segment-${index}`}>
            {/* Invisible drag area */}
            <path
              d={segmentPath}
              style={{
                strokeWidth: '16px',
                stroke: 'transparent',
                fill: 'none',
                cursor: segment.isHorizontal ? 'ns-resize' : 'ew-resize',
                pointerEvents: 'all',
              }}
              onPointerDown={(e) => handleSegmentDragStart(e, index)}
            />

            {/* Visual segment indicator */}
            <path
              d={segmentPath}
              style={{
                strokeWidth: isBeingDragged ? '4px' : '3px',
                stroke: isBeingDragged ? '#3b82f6' : edgeColor,
                strokeDasharray: '5,5',
                opacity: 0.6,
                pointerEvents: 'none',
              }}
            />
          </g>
        );
      })}

    {/* Control point indicator */}
    {selected && data?.routingStyle === 'orthogonal' && controlPoint && (
      <circle
        cx={controlPoint.x}
        cy={controlPoint.y}
        r="6"
        fill={isDraggingSegment ? '#3b82f6' : '#ffffff'}
        stroke={edgeColor}
        strokeWidth="2"
        style={{ pointerEvents: 'none' }}
      />
    )}
  </>
);

}