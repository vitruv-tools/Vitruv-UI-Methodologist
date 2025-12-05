import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { EdgeProps, Position, useReactFlow, useStore } from 'reactflow';

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

  // Subscribe to node selection changes using useStore
  // This ensures the edge re-renders when any node's selection state changes
  const nodeSelectionState = useStore((store) => {
    const nodes = Array.from(store.nodeInternals.values());
    const sourceNode = nodes.find(n => n.id === source);
    const targetNode = nodes.find(n => n.id === target);
    
    return {
      isSourceSelected: sourceNode?.selected || false,
      isTargetSelected: targetNode?.selected || false
    };
  });
  
  const { isSourceSelected, isTargetSelected } = nodeSelectionState;
  const isNodeSelected = isSourceSelected || isTargetSelected;
  
  // Edge should be highlighted if either the edge itself is selected OR any connected node is selected
  const isHighlighted = selected || isNodeSelected;

  const calculateParallelOffset = (
    parallelCount: number,
    parallelIndex: number,
    isVertical: boolean
  ): { offsetX: number; offsetY: number } => {
    if (parallelCount <= 1) return { offsetX: 0, offsetY: 0 };
    
    const centerOffset = (parallelCount - 1) / 2;
    const indexOffset = parallelIndex - centerOffset;
    const offset = indexOffset * EDGE_SPACING;
    
    return isVertical 
      ? { offsetX: 0, offsetY: offset }
      : { offsetX: offset, offsetY: 0 };
  };

  const sourceOffset = calculateParallelOffset(
    data?.sourceParallelCount ?? 1,
    data?.sourceParallelIndex ?? 0,
    sourcePosition === Position.Left || sourcePosition === Position.Right
  );

  const targetOffset = calculateParallelOffset(
    data?.targetParallelCount ?? 1,
    data?.targetParallelIndex ?? 0,
    targetPosition === Position.Left || targetPosition === Position.Right
  );

  const actualSourceX = sourceX + sourceOffset.offsetX;
  const actualSourceY = sourceY + sourceOffset.offsetY;
  const actualTargetX = targetX + targetOffset.offsetX;
  const actualTargetY = targetY + targetOffset.offsetY;

  const getClosestHandle = useCallback((point: { x: number; y: number }, nodeId: string): HandlePosition | null => {
    if (!reactFlowInstance) return null;
    
    const node = reactFlowInstance.getNode(nodeId);
    if (!node) return null;

    const { width, height } = NODE_DIMENSIONS;
    const handles = {
      top: { x: node.position.x + width / 2, y: node.position.y },
      bottom: { x: node.position.x + width / 2, y: node.position.y + height },
      left: { x: node.position.x, y: node.position.y + height / 2 },
      right: { x: node.position.x + width, y: node.position.y + height / 2 },
    };

    let closestHandle: HandlePosition = 'right';
    let minDistance = Infinity;

    (Object.keys(handles) as HandlePosition[]).forEach(handle => {
      const handlePos = handles[handle];
      const distance = Math.hypot(point.x - handlePos.x, point.y - handlePos.y);
      if (distance < minDistance) {
        minDistance = distance;
        closestHandle = handle;
      }
    });

    return closestHandle;
  }, [reactFlowInstance]);

  // Memoize path calculations
  const pathData = useMemo(() => {
    const centerX = tempControlPoint?.x ?? data?.customControlPoint?.x ?? (actualSourceX + actualTargetX) / 2;
    const centerY = tempControlPoint?.y ?? data?.customControlPoint?.y ?? (actualSourceY + actualTargetY) / 2;
    const dx = actualTargetX - actualSourceX;
    const dy = actualTargetY - actualSourceY;

    // Check if nodes are well-aligned for straight line
    const isAlignedHorizontally = Math.abs(dy) < 30; // Within 30px vertically
    const isAlignedVertically = Math.abs(dx) < 30; // Within 30px horizontally
    const useStraightLine = isAlignedHorizontally || isAlignedVertically;

    if (data?.routingStyle === 'orthogonal' && !useStraightLine) {
      const isSourceHorizontal = sourcePosition === Position.Right || sourcePosition === Position.Left;

      const edgePath = isSourceHorizontal
        ? `M ${actualSourceX},${actualSourceY} L ${centerX},${actualSourceY} L ${centerX},${actualTargetY} L ${actualTargetX},${actualTargetY}`
        : `M ${actualSourceX},${actualSourceY} L ${actualSourceX},${centerY} L ${actualTargetX},${centerY} L ${actualTargetX},${actualTargetY}`;

      const segments: PathSegment[] = isSourceHorizontal
        ? [
            { start: { x: actualSourceX, y: actualSourceY }, end: { x: centerX, y: actualSourceY }, isHorizontal: true, canDrag: false },
            { start: { x: centerX, y: actualSourceY }, end: { x: centerX, y: actualTargetY }, isHorizontal: false, canDrag: true },
            { start: { x: centerX, y: actualTargetY }, end: { x: actualTargetX, y: actualTargetY }, isHorizontal: true, canDrag: false }
          ]
        : [
            { start: { x: actualSourceX, y: actualSourceY }, end: { x: actualSourceX, y: centerY }, isHorizontal: false, canDrag: false },
            { start: { x: actualSourceX, y: centerY }, end: { x: actualTargetX, y: centerY }, isHorizontal: true, canDrag: true },
            { start: { x: actualTargetX, y: centerY }, end: { x: actualTargetX, y: actualTargetY }, isHorizontal: false, canDrag: false }
          ];

      const arrowAngles = { [Position.Top]: 90, [Position.Bottom]: -90, [Position.Left]: 0, [Position.Right]: 180 };

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

    // Use straight line when aligned or routing style is 'curved'
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

  const handleSegmentDragStart = useCallback((e: React.PointerEvent, segmentIndex: number) => {
    e.stopPropagation();
    e.preventDefault();

    const targetEl = e.target as HTMLElement;
    if (targetEl.setPointerCapture) {
      try { targetEl.setPointerCapture(e.pointerId); } catch {}
    }

    if (!reactFlowInstance || !controlPoint) return;

    setIsDraggingSegment(true);
    setDraggedSegmentIndex(segmentIndex);
    setTempControlPoint(controlPoint);
    data?.onEdgeDragStart?.(id);
  }, [id, data, reactFlowInstance, controlPoint]);

  const handleSegmentDrag = useCallback((e: PointerEvent) => {
    if (!isDraggingSegment || draggedSegmentIndex === null || !reactFlowInstance || !controlPoint) return;

    const flowPos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const segment = segments[draggedSegmentIndex];
    if (!segment) return;

    const newControlPoint = { ...controlPoint };
    if (segment.isHorizontal) {
      newControlPoint.y = flowPos.y;
    } else {
      newControlPoint.x = flowPos.x;
    }

    setTempControlPoint(newControlPoint);
    data?.onEdgeDrag?.(id, newControlPoint);

    const newSourceHandle = getClosestHandle(newControlPoint, source);
    const newTargetHandle = getClosestHandle(newControlPoint, target);

    if (newSourceHandle && newTargetHandle && 
        (newSourceHandle !== sourcePosition || newTargetHandle !== targetPosition)) {
      data?.onHandleChange?.(id, newSourceHandle, newTargetHandle);
    }

    data?.onReorderRequest?.(id, newControlPoint);
  }, [isDraggingSegment, draggedSegmentIndex, id, reactFlowInstance, data, segments, controlPoint, getClosestHandle, source, target, sourcePosition, targetPosition]);

  const handleSegmentDragEnd = useCallback((e: PointerEvent) => {
    if (!isDraggingSegment) return;

    if (tempControlPoint) {
      data?.onEdgeDragEnd?.(id, tempControlPoint);
    }

    setIsDraggingSegment(false);
    setDraggedSegmentIndex(null);
  }, [isDraggingSegment, id, data, tempControlPoint]);

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

  const [isHovered, setIsHovered] = React.useState(false);
  const hasCode = data?.code && data.code.trim().length > 0;
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Toggle selection by dispatching a custom event
    const event = new CustomEvent('edge-clicked', { 
      detail: { edgeId: id, currentlySelected: selected } 
    });
    globalThis.dispatchEvent(event);
  };
  const edgeColor = style?.stroke || '#3b82f6';
  const edgeWidth = style?.strokeWidth || 2;

  // Pre-compute style values to reduce cognitive complexity
  const getStateBasedColor = (defaultColor: string): string => {
    if (isHighlighted) return '#ef4444';
    if (isHovered) return '#f87171';
    return defaultColor;
  };

  const getMainStrokeWidth = (): string => {
    const baseWidth = Number(edgeWidth);
    if (isHighlighted) return `${baseWidth + 2}px`;
    if (isHovered) return `${baseWidth + 1}px`;
    return `${baseWidth}px`;
  };

  const activeColor = getStateBasedColor(edgeColor);
  const labelColor = getStateBasedColor('#1f2937');
  const codeIndicatorColor = getStateBasedColor('#0e639c');
  const isActive = isHighlighted || isHovered;
  const underlayWidth = isActive ? 8 : 7;
  const mainStrokeWidth = getMainStrokeWidth();
  const controlPointFill = isDraggingSegment ? '#3b82f6' : '#ffffff';
  const showOrthogonalControls = selected && data?.routingStyle === 'orthogonal';

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  return (
    <>
      <path
        id={`${id}-underlay`}
        d={edgePath}
        className="react-flow__edge-path"
        style={{
          stroke: '#ffffff',
          strokeWidth: underlayWidth,
          opacity: 0.95,
          fill: 'none',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          transition: 'stroke-width 0.2s ease',
        }}
      />

      <path
        id={`${id}-clickarea`}
        d={edgePath}
        style={{
          strokeWidth: '40px',
          stroke: 'transparent',
          fill: 'none',
          cursor: 'pointer',
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />

      <path
        id={id}
        style={{
          strokeWidth: mainStrokeWidth,
          stroke: activeColor,
          fill: 'none',
          cursor: 'pointer',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          transition: 'stroke 0.2s ease, stroke-width 0.2s ease',
        }}
        d={edgePath}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />

      <g transform={`translate(${arrowX}, ${arrowY}) rotate(${arrowAngle})`}>
        <polygon
          points="-10,-6 0,0 -10,6"
          fill={activeColor}
          stroke={activeColor}
          strokeWidth="1"
          style={{ 
            cursor: 'pointer',
            transition: 'fill 0.2s ease, stroke 0.2s ease'
          }}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
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
            fill: labelColor,
            stroke: '#ffffff',
            strokeWidth: 3.5,
            paintOrder: 'stroke fill',
            pointerEvents: 'none',
            transition: 'fill 0.2s ease',
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
            fill={codeIndicatorColor}
            stroke="#fff"
            strokeWidth="2"
            style={{
              transition: 'fill 0.2s ease',
            }}
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


      {showOrthogonalControls && segments.map((segment, index) => {
        if (!segment.canDrag) return null;
        
        const segmentPath = `M ${segment.start.x},${segment.start.y} L ${segment.end.x},${segment.end.y}`;
        const isBeingDragged = isDraggingSegment && draggedSegmentIndex === index;
        const segmentKey = `${id}-segment-${segment.start.x}-${segment.start.y}-${segment.end.x}-${segment.end.y}`;
        
        return (
          <g key={segmentKey}>
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
              onDoubleClick={handleDoubleClick}
            />
            
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

      {showOrthogonalControls && controlPoint && (
        <circle
          cx={controlPoint.x}
          cy={controlPoint.y}
          r="6"
          fill={controlPointFill}
          stroke={edgeColor}
          strokeWidth="2"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </>
  );
}