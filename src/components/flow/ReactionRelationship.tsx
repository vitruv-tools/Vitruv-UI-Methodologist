import React, { useState, useCallback, useEffect, useRef } from 'react';
import { EdgeProps, Position, useReactFlow } from 'reactflow';

interface ReactionRelationshipData {
  label?: string;
  code?: string;
  onDoubleClick?: (edgeId: string) => void;
  routingStyle?: 'curved' | 'orthogonal';
  separation?: number;
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

interface PathSegment {
  start: { x: number; y: number };
  end: { x: number; y: number };
  isHorizontal: boolean;
  canDrag: boolean; // First and last segments can't be dragged
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
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Calculate offsets for parallel edges
  const sourceParallelCount = data?.sourceParallelCount ?? 1;
  const sourceParallelIndex = data?.sourceParallelIndex ?? 0;
  
  let sourceOffsetX = 0;
  let sourceOffsetY = 0;
  
  if (sourceParallelCount > 1) {
    const EDGE_SPACING = 25;
    const centerOffset = (sourceParallelCount - 1) / 2;
    const indexOffset = sourceParallelIndex - centerOffset;
    const offset = indexOffset * EDGE_SPACING;
    
    if (sourcePosition === Position.Top || sourcePosition === Position.Bottom) {
      sourceOffsetX = offset;
    } else {
      sourceOffsetY = offset;
    }
  }
  
  const targetParallelCount = data?.targetParallelCount ?? 1;
  const targetParallelIndex = data?.targetParallelIndex ?? 0;
  
  let targetOffsetX = 0;
  let targetOffsetY = 0;
  
  if (targetParallelCount > 1) {
    const EDGE_SPACING = 25;
    const centerOffset = (targetParallelCount - 1) / 2;
    const indexOffset = targetParallelIndex - centerOffset;
    const offset = indexOffset * EDGE_SPACING;
    
    if (targetPosition === Position.Top || targetPosition === Position.Bottom) {
      targetOffsetX = offset;
    } else {
      targetOffsetY = offset;
    }
  }

  const actualSourceX = sourceX + sourceOffsetX;
  const actualSourceY = sourceY + sourceOffsetY;
  const actualTargetX = targetX + targetOffsetX;
  const actualTargetY = targetY + targetOffsetY;

  const dx = actualTargetX - actualSourceX;
  const dy = actualTargetY - actualSourceY;

  let edgePath: string;
  let labelX: number;
  let labelY: number;
  let arrowX: number;
  let arrowY: number;
  let arrowAngle: number;
  let controlPoint: { x: number; y: number } | null = null;
  let segments: PathSegment[] = [];

  const getClosestHandle = useCallback((point: { x: number; y: number }, nodeId: string): HandlePosition | null => {
    if (!reactFlowInstance) return null;
    
    const node = reactFlowInstance.getNode(nodeId);
    if (!node) return null;

    const nodeX = node.position.x;
    const nodeY = node.position.y;
    const { width, height } = NODE_DIMENSIONS;

    const handles = {
      top: { x: nodeX + width / 2, y: nodeY },
      bottom: { x: nodeX + width / 2, y: nodeY + height },
      left: { x: nodeX, y: nodeY + height / 2 },
      right: { x: nodeX + width, y: nodeY + height / 2 },
    };

    let closestHandle: HandlePosition = 'right';
    let minDistance = Infinity;

    (Object.keys(handles) as HandlePosition[]).forEach(handle => {
      const handlePos = handles[handle];
      const distance = Math.sqrt(
        Math.pow(point.x - handlePos.x, 2) + Math.pow(point.y - handlePos.y, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestHandle = handle;
      }
    });

    return closestHandle;
  }, [reactFlowInstance]);
  
  if (data?.routingStyle === 'orthogonal') {
  const centerX = tempControlPoint?.x ?? data?.customControlPoint?.x ?? (actualSourceX + actualTargetX) / 2;
  const centerY = tempControlPoint?.y ?? data?.customControlPoint?.y ?? (actualSourceY + actualTargetY) / 2;

  let pathParts: string[] = [];

  if (sourcePosition === Position.Right || sourcePosition === Position.Left) {
    // Source horizontal -> vertical -> horizontal target
    pathParts.push(`M ${actualSourceX},${actualSourceY}`);
    pathParts.push(`L ${centerX},${actualSourceY}`);
    pathParts.push(`L ${centerX},${actualTargetY}`);
    pathParts.push(`L ${actualTargetX},${actualTargetY}`);
    
    // BUILD SEGMENTS ARRAY
    segments = [
      {
        start: { x: actualSourceX, y: actualSourceY },
        end: { x: centerX, y: actualSourceY },
        isHorizontal: true,
        canDrag: false // First segment
      },
      {
        start: { x: centerX, y: actualSourceY },
        end: { x: centerX, y: actualTargetY },
        isHorizontal: false,
        canDrag: true // Middle segment - draggable!
      },
      {
        start: { x: centerX, y: actualTargetY },
        end: { x: actualTargetX, y: actualTargetY },
        isHorizontal: true,
        canDrag: false // Last segment
      }
    ];
  } else {
    // Source vertical -> horizontal -> vertical target
    pathParts.push(`M ${actualSourceX},${actualSourceY}`);
    pathParts.push(`L ${actualSourceX},${centerY}`);
    pathParts.push(`L ${actualTargetX},${centerY}`);
    pathParts.push(`L ${actualTargetX},${actualTargetY}`);
    
    // BUILD SEGMENTS ARRAY
    segments = [
      {
        start: { x: actualSourceX, y: actualSourceY },
        end: { x: actualSourceX, y: centerY },
        isHorizontal: false,
        canDrag: false // First segment
      },
      {
        start: { x: actualSourceX, y: centerY },
        end: { x: actualTargetX, y: centerY },
        isHorizontal: true,
        canDrag: true // Middle segment - draggable!
      },
      {
        start: { x: actualTargetX, y: centerY },
        end: { x: actualTargetX, y: actualTargetY },
        isHorizontal: false,
        canDrag: false // Last segment
      }
    ];
  }

  edgePath = pathParts.join(' ');
  controlPoint = { x: centerX, y: centerY };
  labelX = centerX;
  labelY = centerY;
  
  arrowX = actualTargetX;
  arrowY = actualTargetY;
  
  if (targetPosition === Position.Top) {
    arrowAngle = 90;
  } else if (targetPosition === Position.Bottom) {
    arrowAngle = -90;
  } else if (targetPosition === Position.Left) {
    arrowAngle = 0;
  } else {
    arrowAngle = 180;
  }
} else {
    edgePath = `M ${actualSourceX},${actualSourceY} L ${actualTargetX},${actualTargetY}`;
    labelX = (actualSourceX + actualTargetX) / 2;
    labelY = (actualSourceY + actualTargetY) / 2;
    
    arrowX = actualTargetX;
    arrowY = actualTargetY;
    arrowAngle = Math.atan2(dy, dx) * (180 / Math.PI);
  }

  const handleSegmentDragStart = useCallback((e: React.PointerEvent, segmentIndex: number) => {
    e.stopPropagation();
    e.preventDefault();

    const targetEl = e.target as HTMLElement;
    if (targetEl.setPointerCapture) {
      try { targetEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }

    if (!reactFlowInstance) return;

    const flowPos = reactFlowInstance.screenToFlowPosition({
      x: (e as unknown as PointerEvent).clientX,
      y: (e as unknown as PointerEvent).clientY,
    });

    dragStartPosRef.current = flowPos;
    setIsDraggingSegment(true);
    setDraggedSegmentIndex(segmentIndex);
    
    if (controlPoint) {
      setTempControlPoint(controlPoint);
    }

    data?.onEdgeDragStart?.(id);
  }, [id, data, reactFlowInstance, controlPoint]);

const handleSegmentDrag = useCallback((e: PointerEvent) => {
  if (!isDraggingSegment || draggedSegmentIndex === null || !reactFlowInstance) return;

  const flowPos = reactFlowInstance.screenToFlowPosition({
    x: e.clientX,
    y: e.clientY,
  });

  const segment = segments[draggedSegmentIndex];
  if (!segment) return;

  if (!controlPoint) return;

  let newControlPoint = { ...controlPoint };

  // SNAPPING: Only allow movement in one direction
  if (segment.isHorizontal) {
    // Dragging horizontal segment - move vertically only
    newControlPoint.y = flowPos.y;
    // Keep X unchanged
  } else {
    // Dragging vertical segment - move horizontally only
    newControlPoint.x = flowPos.x;
    // Keep Y unchanged
  }

  setTempControlPoint(newControlPoint);
  data?.onEdgeDrag?.(id, newControlPoint);

  const newSourceHandle = getClosestHandle(newControlPoint, source);
  const newTargetHandle = getClosestHandle(newControlPoint, target);

  if (newSourceHandle && newTargetHandle) {
    if (newSourceHandle !== sourcePosition || newTargetHandle !== targetPosition) {
      data?.onHandleChange?.(id, newSourceHandle, newTargetHandle);
    }
  }

  data?.onReorderRequest?.(id, newControlPoint);
}, [isDraggingSegment, draggedSegmentIndex, id, reactFlowInstance, data, segments, controlPoint, getClosestHandle, source, target, sourcePosition, targetPosition]);





const handleSegmentDragEnd = useCallback((e: PointerEvent) => {
    if (!isDraggingSegment || !reactFlowInstance) return;

    const flowPos = reactFlowInstance.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    });

    if (tempControlPoint) {
      data?.onEdgeDragEnd?.(id, tempControlPoint);
    }

    setIsDraggingSegment(false);
    setDraggedSegmentIndex(null);
  }, [isDraggingSegment, id, reactFlowInstance, data, tempControlPoint]);

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
    if (data?.onDoubleClick) data.onDoubleClick(id);
  };

  const hasCode = data?.code && data.code.trim().length > 0;
  const edgeColor = style?.stroke || '#3b82f6';
  const edgeWidth = style?.strokeWidth || 2;

  return (
    <>
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

      <path
        id={id}
        style={{
          strokeWidth: selected ? `${Number(edgeWidth) + 2}px` : `${edgeWidth}px`,
          stroke: selected ? '#ef4444' : edgeColor,
          fill: 'none',
          cursor: 'pointer',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }}
        d={edgePath}
        onDoubleClick={handleDoubleClick}
      />

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

      {/* Draggable segments - only middle segments */}
      {selected && data?.routingStyle === 'orthogonal' && segments.map((segment, index) => {
        if (!segment.canDrag) return null;
        
        const segmentPath = `M ${segment.start.x},${segment.start.y} L ${segment.end.x},${segment.end.y}`;
        const isBeingDragged = isDraggingSegment && draggedSegmentIndex === index;
        
        return (
          <g key={`segment-${index}`}>
            {/* Invisible thick line for easier grabbing */}
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
            
            {/* Visual feedback */}
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

      {/* Center indicator on middle segment */}
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