import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { EdgeLabelRenderer, EdgeProps, Position, useReactFlow, useStore } from 'reactflow';
import {
  EOBJECT_DEFAULT_WIDTH,
  FINE_REACTION_ARROW_LENGTH,
  FINE_REACTION_SEPARATION,
  GHOST_NODE_SIZE,
  fineReactionPathD,
  layoutFineReactionChord,
  reactionArrowAngleDeg,
  shortenSegmentEnd,
} from '../../utils/reactionEdgeGeometry';
import {
  buildReactionEndpoint,
  ecoreFileRect,
  isRoutableNode,
  nodeWorldRect,
  pickSideFromPoint,
  polylinePathD,
  routeOrthogonalAStar,
} from './flowCanvasAStarRouter';
interface ReactionRelationshipData {
  label?: string;
  code?: string;
  onDoubleClick?: (edgeId: string) => void;
  routingStyle?: 'curved' | 'orthogonal';
  fineGranular?: boolean;
  sourceHandleId?: string | null;
  targetHandleId?: string | null;
  parallelIndex?: number;
  parallelCount?: number;
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
  readOnly?: boolean;
  routeWaypoints?: Array<{ x: number; y: number }>;
}

type HandlePosition = 'top' | 'bottom' | 'left' | 'right';

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

  const isFineGranular = data?.fineGranular === true;
  const sourceHandle = data?.sourceHandleId;
  const targetHandle = data?.targetHandleId;

  const live = useStore((store) => {
    const sourceNode = store.nodeInternals.get(source);
    const targetNode = store.nodeInternals.get(target);
    const obstacles: Array<{ x: number; y: number; width: number; height: number }> = [];
    store.nodeInternals.forEach((node) => {
      if (node.id === source || node.id === target || !isRoutableNode(node)) return;
      const rect = nodeWorldRect(node);
      if (rect) obstacles.push(rect);
    });
    const existing: Array<Array<{ x: number; y: number }>> = [];
    for (const edge of store.edges ?? []) {
      if (edge.id === id) continue;
      const points = edge.data?.routeWaypoints;
      if (Array.isArray(points) && points.length > 1) existing.push(points);
    }
    return {
      srcNode: sourceNode ?? null,
      tgtNode: targetNode ?? null,
      isSourceSelected: sourceNode?.selected || false,
      isTargetSelected: targetNode?.selected || false,
      srcAbsX: sourceNode?.positionAbsolute?.x ?? sourceNode?.position?.x ?? sourceX,
      srcAbsY: sourceNode?.positionAbsolute?.y ?? sourceNode?.position?.y ?? sourceY,
      srcW: sourceNode?.type === 'ghost'
        ? (sourceNode.width ?? GHOST_NODE_SIZE)
        : (sourceNode?.width ?? EOBJECT_DEFAULT_WIDTH),
      srcH: sourceNode?.type === 'ghost'
        ? (sourceNode.height ?? GHOST_NODE_SIZE)
        : (sourceNode?.height ?? undefined),
      srcGhost: sourceNode?.type === 'ghost',
      srcAttrs: sourceNode?.data?.attributes,
      srcBox: sourceNode && isRoutableNode(sourceNode) ? nodeWorldRect(sourceNode) : null,
      srcEcore: sourceNode?.type === 'ecoreFile' ? ecoreFileRect(sourceNode) : null,
      tgtAbsX: targetNode?.positionAbsolute?.x ?? targetNode?.position?.x ?? targetX,
      tgtAbsY: targetNode?.positionAbsolute?.y ?? targetNode?.position?.y ?? targetY,
      tgtW: targetNode?.type === 'ghost'
        ? (targetNode.width ?? GHOST_NODE_SIZE)
        : (targetNode?.width ?? EOBJECT_DEFAULT_WIDTH),
      tgtH: targetNode?.type === 'ghost'
        ? (targetNode.height ?? GHOST_NODE_SIZE)
        : (targetNode?.height ?? undefined),
      tgtGhost: targetNode?.type === 'ghost',
      tgtAttrs: targetNode?.data?.attributes,
      tgtBox: targetNode && isRoutableNode(targetNode) ? nodeWorldRect(targetNode) : null,
      tgtEcore: targetNode?.type === 'ecoreFile' ? ecoreFileRect(targetNode) : null,
      obstacles,
      existing,
    };
  });

  const { isSourceSelected, isTargetSelected } = live;
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

    const box = nodeWorldRect(node) ?? ecoreFileRect(node);
    return pickSideFromPoint(box, point);
  }, [reactFlowInstance]);

  const buildOrthogonalDraw = (
    routedPoints: Array<{ x: number; y: number }>,
  ) => {
    const points = routedPoints;
    const tip = points[points.length - 1];
    const lastStart = points[points.length - 2] ?? tip;
    const lineEnd = shortenSegmentEnd(lastStart, tip, FINE_REACTION_ARROW_LENGTH);
    const drawPoints = [...points.slice(0, -1), lineEnd];
    const elbow = drawPoints[Math.floor(drawPoints.length / 2)];
    const segments: PathSegment[] = drawPoints.slice(0, -1).map((segStart, index) => {
      const end = drawPoints[index + 1];
      return {
        start: segStart,
        end,
        isHorizontal: Math.abs(segStart.y - end.y) < 1.5,
        canDrag: index > 0 && index < drawPoints.length - 2,
      };
    });
    return {
      edgePath: polylinePathD(drawPoints),
      labelX: elbow.x,
      labelY: elbow.y,
      arrowX: tip.x,
      arrowY: tip.y,
      arrowAngle: reactionArrowAngleDeg(lastStart, tip),
      controlPoint: { x: elbow.x, y: elbow.y },
      segments,
      overlayArrow: false,
      routing: 'orthogonal' as const,
    };
  };

  // Memoize path calculations
  const pathData = useMemo(() => {
    if (isFineGranular) {
      const srcEp = live.srcNode && isRoutableNode(live.srcNode)
        ? buildReactionEndpoint(live.srcNode, sourceHandle, 'source')
        : null;
      const tgtEp = live.tgtNode && isRoutableNode(live.tgtNode)
        ? buildReactionEndpoint(live.tgtNode, targetHandle, 'target')
        : null;
      const fineRoute = (via?: { x: number; y: number }) => {
        if (!srcEp || !tgtEp) return null;
        return routeOrthogonalAStar({
          source: srcEp.rect,
          target: tgtEp.rect,
          obstacles: live.obstacles,
          existing: live.existing,
          via,
          cursor: via,
          lockSourceHandle: srcEp.pin ? srcEp.lockSide : undefined,
          lockTargetHandle: tgtEp.pin ? tgtEp.lockSide : undefined,
          sourcePortT: srcEp.portT,
          targetPortT: tgtEp.portT,
          sourceAnchor: srcEp.anchor,
          targetAnchor: tgtEp.anchor,
        }).points;
      };
      const routedPoints = tempControlPoint
        ? fineRoute(tempControlPoint)
        : (data?.routeWaypoints && data.routeWaypoints.length > 1
          ? data.routeWaypoints
          : fineRoute());
      if (routedPoints && routedPoints.length > 1) {
        return buildOrthogonalDraw(routedPoints);
      }
      const chord = layoutFineReactionChord({
        source: {
          x: live.srcAbsX,
          y: live.srcAbsY,
          width: live.srcW,
          height: live.srcH,
          attributes: live.srcAttrs,
          isGhost: live.srcGhost,
        },
        target: {
          x: live.tgtAbsX,
          y: live.tgtAbsY,
          width: live.tgtW,
          height: live.tgtH,
          attributes: live.tgtAttrs,
          isGhost: live.tgtGhost,
        },
        sourceHandle,
        targetHandle,
        parallelIndex: data?.parallelIndex ?? 0,
        parallelCount: data?.parallelCount ?? 1,
        separation: data?.separation ?? FINE_REACTION_SEPARATION,
      });
      return {
        edgePath: fineReactionPathD(chord),
        labelX: (chord.drawP1.x + chord.drawP2.x) / 2,
        labelY: (chord.drawP1.y + chord.drawP2.y) / 2,
        arrowX: chord.p2.x,
        arrowY: chord.p2.y,
        arrowAngle: chord.arrowAngle,
        controlPoint: null,
        segments: [] as PathSegment[],
        overlayArrow: true,
        routing: 'chord' as const,
      };
    }

    const centerX = tempControlPoint?.x ?? data?.customControlPoint?.x ?? (actualSourceX + actualTargetX) / 2;
    const centerY = tempControlPoint?.y ?? data?.customControlPoint?.y ?? (actualSourceY + actualTargetY) / 2;

    if (data?.routingStyle === 'orthogonal') {
      const routedPoints = tempControlPoint && (live.srcBox || live.srcEcore) && (live.tgtBox || live.tgtEcore)
        ? routeOrthogonalAStar({
          source: live.srcBox ?? live.srcEcore!,
          target: live.tgtBox ?? live.tgtEcore!,
          obstacles: live.obstacles,
          existing: live.existing,
          via: tempControlPoint,
          cursor: tempControlPoint,
        }).points
        : (data.routeWaypoints && data.routeWaypoints.length > 1 ? data.routeWaypoints : null);

      if (routedPoints && routedPoints.length > 1) {
        return buildOrthogonalDraw(routedPoints);
      }
      const isSourceHorizontal = sourcePosition === Position.Right || sourcePosition === Position.Left;
      const tip = { x: actualTargetX, y: actualTargetY };
      const lastStart = isSourceHorizontal
        ? { x: centerX, y: actualTargetY }
        : { x: actualTargetX, y: centerY };
      const lineEnd = shortenSegmentEnd(lastStart, tip, FINE_REACTION_ARROW_LENGTH);

      const edgePath = isSourceHorizontal
        ? `M ${actualSourceX},${actualSourceY} L ${centerX},${actualSourceY} L ${centerX},${actualTargetY} L ${lineEnd.x},${lineEnd.y}`
        : `M ${actualSourceX},${actualSourceY} L ${actualSourceX},${centerY} L ${actualTargetX},${centerY} L ${lineEnd.x},${lineEnd.y}`;

      const segments: PathSegment[] = isSourceHorizontal
        ? [
            { start: { x: actualSourceX, y: actualSourceY }, end: { x: centerX, y: actualSourceY }, isHorizontal: true, canDrag: false },
            { start: { x: centerX, y: actualSourceY }, end: { x: centerX, y: actualTargetY }, isHorizontal: false, canDrag: true },
            { start: { x: lastStart.x, y: lastStart.y }, end: lineEnd, isHorizontal: true, canDrag: false }
          ]
        : [
            { start: { x: actualSourceX, y: actualSourceY }, end: { x: actualSourceX, y: centerY }, isHorizontal: false, canDrag: false },
            { start: { x: actualSourceX, y: centerY }, end: { x: actualTargetX, y: centerY }, isHorizontal: true, canDrag: true },
            { start: { x: lastStart.x, y: lastStart.y }, end: lineEnd, isHorizontal: false, canDrag: false }
          ];

      return {
        edgePath,
        labelX: centerX,
        labelY: centerY,
        arrowX: tip.x,
        arrowY: tip.y,
        arrowAngle: reactionArrowAngleDeg(lastStart, tip),
        controlPoint: { x: centerX, y: centerY },
        segments,
        overlayArrow: false,
        routing: 'orthogonal' as const,
      };
    }

    // Use straight line when aligned or routing style is 'curved'
    const tip = { x: actualTargetX, y: actualTargetY };
    const start = { x: actualSourceX, y: actualSourceY };
    const lineEnd = shortenSegmentEnd(start, tip, FINE_REACTION_ARROW_LENGTH);
    return {
      edgePath: `M ${actualSourceX},${actualSourceY} L ${lineEnd.x},${lineEnd.y}`,
      labelX: (actualSourceX + actualTargetX) / 2,
      labelY: (actualSourceY + actualTargetY) / 2,
      arrowX: tip.x,
      arrowY: tip.y,
      arrowAngle: reactionArrowAngleDeg(start, tip),
      controlPoint: null,
      segments: [],
      overlayArrow: false,
      routing: 'straight' as const,
    };
  }, [
    isFineGranular,
    live.srcAbsX,
    live.srcAbsY,
    live.srcW,
    live.srcH,
    live.srcGhost,
    live.srcAttrs,
    live.tgtAbsX,
    live.tgtAbsY,
    live.tgtW,
    live.tgtH,
    live.tgtGhost,
    live.tgtAttrs,
    live.srcEcore,
    live.tgtEcore,
    live.srcBox,
    live.tgtBox,
    live.srcNode,
    live.tgtNode,
    live.obstacles,
    live.existing,
    sourceHandle,
    targetHandle,
    data?.parallelIndex,
    data?.parallelCount,
    data?.separation,
    actualSourceX,
    actualSourceY,
    actualTargetX,
    actualTargetY,
    data?.routingStyle,
    data?.customControlPoint,
    data?.routeWaypoints,
    tempControlPoint,
    sourcePosition,
  ]);

  const { edgePath, labelX, labelY, arrowX, arrowY, arrowAngle, controlPoint, segments, overlayArrow, routing } = pathData;

  const handleSegmentDragStart = useCallback((e: React.PointerEvent, segmentIndex: number) => {
    if (data?.readOnly) return;
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
  const showOrthogonalControls = selected && data?.routingStyle === 'orthogonal' && !data?.readOnly;

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
        data-routing={routing}
        className="reaction-line"
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

      {!overlayArrow && (
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
      )}

      {overlayArrow && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            data-testid={`${id}-arrow`}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: `translate(${arrowX}px, ${arrowY}px) rotate(${arrowAngle}deg)`,
              transformOrigin: '0 0',
              pointerEvents: 'none',
              zIndex: 1001,
              lineHeight: 0,
            }}
          >
            <svg
              width="1"
              height="1"
              overflow="visible"
              aria-hidden
              style={{ display: 'block', overflow: 'visible' }}
            >
              <polygon points="-10,-5 0,0 -10,5" fill={activeColor} stroke={activeColor} strokeWidth="1" />
            </svg>
          </div>
        </EdgeLabelRenderer>
      )}

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