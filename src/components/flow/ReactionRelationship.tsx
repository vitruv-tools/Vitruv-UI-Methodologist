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
  const [isDraggingEdge, setIsDraggingEdge] = useState(false);
  const [tempControlPoint, setTempControlPoint] = useState<{ x: number; y: number } | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Calculate offset for source handle
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
  
  // Calculate offset for target handle
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

  const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  // Helper: Calculate closest handle to a point
  const getClosestHandle = useCallback((point: { x: number; y: number }, nodeId: string): HandlePosition | null => {
    if (!reactFlowInstance) return null;
    
    const node = reactFlowInstance.getNode(nodeId);
    if (!node) return null;

    const nodeX = node.position.x;
    const nodeY = node.position.y;
    const { width, height } = NODE_DIMENSIONS;

    // Handle center positions
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
    const defaultBendX = actualSourceX + dx / 2;
    const defaultBendY = actualSourceY + dy / 2;

    let bendPointCandidate = data?.customControlPoint || { x: defaultBendX, y: defaultBendY };

    if (tempControlPoint) {
      bendPointCandidate = tempControlPoint;
    }

    let p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number, p4x: number, p4y: number;

    if (sourcePosition === Position.Right || sourcePosition === Position.Left) {
      p1x = actualSourceX;
      p1y = actualSourceY;
      p2x = bendPointCandidate.x;
      p2y = actualSourceY;
      p3x = bendPointCandidate.x;
      p3y = actualTargetY;
      p4x = actualTargetX;
      p4y = actualTargetY;
    } else {
      p1x = actualSourceX;
      p1y = actualSourceY;
      p2x = actualSourceX;
      p2y = bendPointCandidate.y;
      p3x = actualTargetX;
      p3y = bendPointCandidate.y;
      p4x = actualTargetX;
      p4y = actualTargetY;
    }

    const SNAP_THRESHOLD = 30;
    if (isDraggingEdge) {
      if (Math.abs(bendPointCandidate.x - actualSourceX) < SNAP_THRESHOLD) {
        bendPointCandidate = { ...bendPointCandidate, x: actualSourceX };
      } else if (Math.abs(bendPointCandidate.x - actualTargetX) < SNAP_THRESHOLD) {
        bendPointCandidate = { ...bendPointCandidate, x: actualTargetX };
      }
      if (Math.abs(bendPointCandidate.y - actualSourceY) < SNAP_THRESHOLD) {
        bendPointCandidate = { ...bendPointCandidate, y: actualSourceY };
      } else if (Math.abs(bendPointCandidate.y - actualTargetY) < SNAP_THRESHOLD) {
        bendPointCandidate = { ...bendPointCandidate, y: actualTargetY };
      }
      if (sourcePosition === Position.Right || sourcePosition === Position.Left) {
        p2x = bendPointCandidate.x;
        p3x = bendPointCandidate.x;
      } else {
        p2y = bendPointCandidate.y;
        p3y = bendPointCandidate.y;
      }
    } else {
      const mid = midpoint({ x: p2x, y: p2y }, { x: p3x, y: p3y });
      bendPointCandidate = mid;
      if (sourcePosition === Position.Right || sourcePosition === Position.Left) {
        p2x = bendPointCandidate.x;
        p3x = bendPointCandidate.x;
      } else {
        p2y = bendPointCandidate.y;
        p3y = bendPointCandidate.y;
      }
    }

    controlPoint = bendPointCandidate;

    edgePath = `M ${p1x},${p1y} L ${p2x},${p2y} L ${p3x},${p3y} L ${p4x},${p4y}`;
    
    labelX = (p2x + p3x) / 2;
    labelY = (p2y + p3y) / 2;
    
    arrowX = actualTargetX;
    arrowY = actualTargetY;
    
    if (targetPosition === Position.Top) {
      arrowAngle = 90;
    } else if (targetPosition === Position.Bottom) {
      arrowAngle = -90;
    } else if (targetPosition === Position.Left) {
      arrowAngle = 0;
    } else if (targetPosition === Position.Right) {
      arrowAngle = 180;
    } else {
      const finalDx = p4x - p3x;
      const finalDy = p4y - p3y;
      arrowAngle = Math.atan2(finalDy, finalDx) * (180 / Math.PI);
    }
  } else {
    edgePath = `M ${actualSourceX},${actualSourceY} L ${actualTargetX},${actualTargetY}`;
    labelX = (actualSourceX + actualTargetX) / 2;
    labelY = (actualSourceY + actualTargetY) / 2;
    
    arrowX = actualTargetX;
    arrowY = actualTargetY;
    arrowAngle = Math.atan2(dy, dx) * (180 / Math.PI);
  }

  const handleControlPointDragStart = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const targetEl = e.target as HTMLElement;
    if (targetEl.setPointerCapture) {
      try { targetEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }

    if (!reactFlowInstance) {
      setIsDraggingEdge(false);
      return;
    }

    const flowPos = reactFlowInstance.screenToFlowPosition({
      x: (e as unknown as PointerEvent).clientX,
      y: (e as unknown as PointerEvent).clientY,
    });

    if (controlPoint) {
      dragOffsetRef.current = {
        x: controlPoint.x - flowPos.x,
        y: controlPoint.y - flowPos.y,
      };
      setTempControlPoint(controlPoint);
    } else {
      dragOffsetRef.current = { x: 0, y: 0 };
      setTempControlPoint({ x: flowPos.x, y: flowPos.y });
    }

    setIsDraggingEdge(true);
    data?.onEdgeDragStart?.(id);
  }, [id, data, reactFlowInstance, controlPoint]);

  const handleControlPointDrag = useCallback((e: PointerEvent) => {
    if (!isDraggingEdge || !reactFlowInstance) return;

    const flowPos = reactFlowInstance.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    });

    const newPos = {
      x: flowPos.x + dragOffsetRef.current.x,
      y: flowPos.y + dragOffsetRef.current.y,
    };

    setTempControlPoint(newPos);
    data?.onEdgeDrag?.(id, newPos);

    // Check for handle changes
    const newSourceHandle = getClosestHandle(newPos, source);
    const newTargetHandle = getClosestHandle(newPos, target);

    if (newSourceHandle && newTargetHandle) {
      if (newSourceHandle !== sourcePosition || newTargetHandle !== targetPosition) {
        data?.onHandleChange?.(id, newSourceHandle, newTargetHandle);
      }
    }

    // Request reordering
    data?.onReorderRequest?.(id, newPos);
  }, [isDraggingEdge, id, reactFlowInstance, data, getClosestHandle, source, target, sourcePosition, targetPosition]);

  const handleControlPointDragEnd = useCallback((e: PointerEvent) => {
    if (!isDraggingEdge || !reactFlowInstance) return;

    const flowPos = reactFlowInstance.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    });

    const finalPos = {
      x: flowPos.x + dragOffsetRef.current.x,
      y: flowPos.y + dragOffsetRef.current.y,
    };

    data?.onEdgeDragEnd?.(id, finalPos);

    setIsDraggingEdge(false);
    setTempControlPoint(finalPos);
  }, [isDraggingEdge, id, reactFlowInstance, data]);

  useEffect(() => {
    if (!isDraggingEdge) return;

    document.addEventListener('pointermove', handleControlPointDrag);
    document.addEventListener('pointerup', handleControlPointDragEnd);

    return () => {
      document.removeEventListener('pointermove', handleControlPointDrag);
      document.removeEventListener('pointerup', handleControlPointDragEnd);
    };
  }, [isDraggingEdge, handleControlPointDrag, handleControlPointDragEnd]);

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

      {selected && data?.routingStyle === 'orthogonal' && controlPoint && (
        <g>
          <circle
            cx={controlPoint.x}
            cy={controlPoint.y}
            r="10"
            fill={isDraggingEdge ? '#3b82f6' : '#ffffff'}
            stroke={edgeColor}
            strokeWidth="3"
            style={{ cursor: 'move', pointerEvents: 'all' }}
            onPointerDown={handleControlPointDragStart}
          />
          {!isDraggingEdge && (
            <circle
              cx={controlPoint.x}
              cy={controlPoint.y}
              r="4"
              fill={edgeColor}
              style={{ pointerEvents: 'none' }}
            />
          )}
        </g>
      )}
    </>
  );
}