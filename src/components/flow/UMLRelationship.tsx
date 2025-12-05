import React from 'react';
import { EdgeProps, useStore } from 'reactflow';

interface UMLRelationshipData {
  label?: string;
  relationshipType: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  routingStyle?: 'curved' | 'orthogonal';
  separation?: number;
  parallelIndex?: number;
  parallelCount?: number;
  customControlPoint?: { x: number; y: number };
  onUpdateControlPoint?: (edgeId: string, point: { x: number; y: number } | null) => void;
  mergePoint?: { x: number; y: number; mergeGroupId?: string };
  hasMerge?: boolean;
  isFirstInMergeGroup?: boolean;
  mergeGroupSourceNodes?: string[];
  hoveredMergeGroup?: string | null;
  onMergeGroupHover?: (groupId: string | null) => void;
}

interface PathResult {
  edgePath: string;
  sharedSegmentPath: string;
  labelX: number;
  labelY: number;
  startSegDx: number;
  startSegDy: number;
  endSegDx: number;
  endSegDy: number;
}

interface PathParams {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  dx: number;
  dy: number;
  px: number;
  py: number;
  distance: number;
  controlPoint?: { x: number; y: number };
  mergePoint?: { x: number; y: number; mergeGroupId?: string };
  hasMerge?: boolean;
  isFirstInMergeGroup?: boolean;
  count: number;
  id: string;
}

// Helper: Calculate path for merged edges
function calculateMergedPath(params: PathParams): PathResult {
  const { sourceX, sourceY, targetX, targetY, mergePoint, isFirstInMergeGroup, id } = params;
  
  const edgePath = `M ${sourceX},${sourceY} L ${mergePoint!.x},${mergePoint!.y}`;
  let sharedSegmentPath = '';
  
  console.log(`🔷 Edge ${id}: hasMerge=true, isFirst=${isFirstInMergeGroup}`);
  
  if (isFirstInMergeGroup === true) {
    sharedSegmentPath = `M ${mergePoint!.x},${mergePoint!.y} L ${targetX},${targetY}`;
    console.log(`✅ Drawing shared segment (edge: ${id})`);
  } else {
    console.log(`❌ NOT drawing shared segment (edge: ${id})`);
  }
  
  return {
    edgePath,
    sharedSegmentPath,
    labelX: mergePoint!.x,
    labelY: mergePoint!.y,
    startSegDx: mergePoint!.x - sourceX,
    startSegDy: mergePoint!.y - sourceY,
    endSegDx: targetX - mergePoint!.x,
    endSegDy: targetY - mergePoint!.y,
  };
}

// Helper: Calculate path with custom control point
function calculateControlPointPath(params: PathParams): PathResult {
  const { sourceX, sourceY, targetX, targetY, controlPoint } = params;
  const cp = controlPoint!;
  
  return {
    edgePath: `M ${sourceX},${sourceY} Q ${cp.x},${cp.y} ${targetX},${targetY}`,
    sharedSegmentPath: '',
    labelX: cp.x,
    labelY: cp.y,
    startSegDx: cp.x - sourceX,
    startSegDy: cp.y - sourceY,
    endSegDx: targetX - cp.x,
    endSegDy: targetY - cp.y,
  };
}

// Helper: Calculate straight line path
function calculateStraightPath(params: PathParams): PathResult {
  const { sourceX, sourceY, targetX, targetY, dx, dy } = params;
  
  return {
    edgePath: `M ${sourceX},${sourceY} L ${targetX},${targetY}`,
    sharedSegmentPath: '',
    labelX: (sourceX + targetX) / 2,
    labelY: (sourceY + targetY) / 2,
    startSegDx: dx,
    startSegDy: dy,
    endSegDx: dx,
    endSegDy: dy,
  };
}

// Helper: Calculate smooth curve path
function calculateCurvePath(params: PathParams): PathResult {
  const { sourceX, sourceY, targetX, targetY, px, py, distance } = params;
  const curveFactor = Math.min(distance * 0.25, 120);
  const cpX = (sourceX + targetX) / 2 + px * curveFactor;
  const cpY = (sourceY + targetY) / 2 + py * curveFactor;
  
  return {
    edgePath: `M ${sourceX},${sourceY} Q ${cpX},${cpY} ${targetX},${targetY}`,
    sharedSegmentPath: '',
    labelX: cpX,
    labelY: cpY,
    startSegDx: cpX - sourceX,
    startSegDy: cpY - sourceY,
    endSegDx: targetX - cpX,
    endSegDy: targetY - cpY,
  };
}

// Helper: Calculate orthogonal (angled) path
function calculateOrthogonalPath(params: PathParams): PathResult {
  const { sourceX, sourceY, targetX, targetY, dx, dy } = params;
  const preferHorizontalFirst = Math.abs(dx) >= Math.abs(dy);
  
  if (preferHorizontalFirst) {
    const bendX = sourceX + dx * 0.6;
    const bendY = sourceY;
    return {
      edgePath: `M ${sourceX},${sourceY} L ${bendX},${bendY} L ${bendX},${targetY} L ${targetX},${targetY}`,
      sharedSegmentPath: '',
      labelX: (sourceX + targetX) / 2,
      labelY: (sourceY + targetY) / 2,
      startSegDx: bendX - sourceX,
      startSegDy: 0,
      endSegDx: 0,
      endSegDy: targetY - bendY,
    };
  }
  
  const bendX = sourceX;
  const bendY = sourceY + dy * 0.6;
  return {
    edgePath: `M ${sourceX},${sourceY} L ${bendX},${bendY} L ${targetX},${bendY} L ${targetX},${targetY}`,
    sharedSegmentPath: '',
    labelX: (sourceX + targetX) / 2,
    labelY: (sourceY + targetY) / 2,
    startSegDx: 0,
    startSegDy: bendY - sourceY,
    endSegDx: targetX - bendX,
    endSegDy: 0,
  };
}

// Main path calculation function
function calculateEdgePath(params: PathParams): PathResult {
  const { controlPoint, hasMerge, mergePoint, count, distance, dx, dy } = params;
  
  // PRIORITY 0: Use merge point if edges are merged
  if (hasMerge && mergePoint) {
    return calculateMergedPath(params);
  }
  
  // PRIORITY 1: Custom control point
  if (controlPoint) {
    return calculateControlPointPath(params);
  }
  
  // PRIORITY 2: Straight line (strongly preferred)
  const isAlignedHorizontally = Math.abs(dy) < 150;
  const isAlignedVertically = Math.abs(dx) < 150;
  const isReasonableDistance = distance < 800;
  const useStraightLine = count === 1 && (isAlignedHorizontally || isAlignedVertically || isReasonableDistance);
  
  if (useStraightLine) {
    return calculateStraightPath(params);
  }
  
  // PRIORITY 3: Smooth curve for very long distances
  if (count === 1 && distance > 500) {
    return calculateCurvePath(params);
  }
  
  // FALLBACK: Orthogonal path
  return calculateOrthogonalPath(params);
}

// Helper: Get highlight color based on state
function getHighlightColor(isHighlighted: boolean, isHovered: boolean): string {
  if (isHighlighted) return '#ef4444';
  if (isHovered) return '#f87171';
  return '#374151';
}

// Helper: Get stroke width based on state
function getStrokeWidth(isHighlighted: boolean, isHovered: boolean): string {
  if (isHighlighted) return '3.5px';
  if (isHovered) return '3px';
  return '2.5px';
}

// Helper: Get marker suffix based on state
function getMarkerSuffix(isHighlighted: boolean, isHovered: boolean): string {
  if (isHighlighted) return '-selected';
  if (isHovered) return '-hover';
  return '';
}

// Helper: Build relationship style object
function buildRelationshipStyle(
  strokeColor: string,
  strokeWidth: string,
  markerSuffix: string,
  relationshipType?: string
): Record<string, string> {
  const baseStyle = {
    strokeWidth,
    stroke: strokeColor,
    fill: 'none',
    opacity: '0.9',
    cursor: 'pointer',
    transition: 'stroke 0.2s ease, stroke-width 0.2s ease',
  };

  if (relationshipType === 'inheritance') {
    return { ...baseStyle, markerEnd: `url(#arrowhead-inheritance${markerSuffix})` };
  }
  if (relationshipType === 'realization') {
    return { ...baseStyle, strokeDasharray: '10,6', markerEnd: `url(#arrowhead-realization${markerSuffix})` };
  }
  if (relationshipType === 'composition') {
    return { ...baseStyle, markerStart: `url(#diamond-composition${markerSuffix})` };
  }
  if (relationshipType === 'aggregation') {
    return { ...baseStyle, markerStart: `url(#diamond-aggregation${markerSuffix})` };
  }
  if (relationshipType === 'dependency') {
    return { ...baseStyle, strokeDasharray: '8,5', markerEnd: `url(#arrowhead-open-dependency${markerSuffix})` };
  }
  
  return baseStyle;
}

// Helper: Calculate multiplicity label position
function calculateMultiplicityPosition(
  baseX: number,
  baseY: number,
  segDx: number,
  segDy: number,
  direction: 'start' | 'end'
): { x: number; y: number } {
  const len = Math.max(Math.hypot(segDx, segDy), 0.0001);
  const ux = segDx / len;
  const uy = segDy / len;
  const nx = -uy;
  const ny = ux;
  const offset = direction === 'start' ? 18 : -18;
  
  return {
    x: baseX + ux * offset + nx * 16,
    y: baseY + uy * offset + ny * 16,
  };
}

export function UMLRelationship({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
  style,
}: EdgeProps<UMLRelationshipData>) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isControlHovered, setIsControlHovered] = React.useState(false);
  
  // Subscribe to node selection changes using useStore
  // This ensures the edge re-renders when any node's selection state changes
  const mergeGroupSourceNodes = data?.mergeGroupSourceNodes || [];
  const nodeSelectionState = useStore((store) => {
    const nodes = Array.from(store.nodeInternals.values());
    const sourceNode = nodes.find(n => n.id === source);
    const targetNode = nodes.find(n => n.id === target);
    const mergeGroupNodes = mergeGroupSourceNodes.map(nodeId => 
      nodes.find(n => n.id === nodeId)
    );
    
    return {
      isSourceSelected: sourceNode?.selected || false,
      isTargetSelected: targetNode?.selected || false,
      isMergeGroupNodeSelected: mergeGroupNodes.some(n => n?.selected || false)
    };
  });
  
  const { isSourceSelected, isTargetSelected, isMergeGroupNodeSelected } = nodeSelectionState;
  
  // Check if this edge's merge group is currently being hovered
  const mergeGroupId = data?.mergePoint?.mergeGroupId;
  const isMergeGroupHovered = !!(mergeGroupId && data?.hoveredMergeGroup === mergeGroupId);
  
  // Logic for highlighting:
  // 1. Individual edge (source to merge point) is red if: 
  //    - edge selected OR source node selected OR target node selected OR merge group hovered
  const isIndividualEdgeHighlighted: boolean = !!(selected || isSourceSelected || isTargetSelected || isMergeGroupHovered);
  
  // 2. MERGE DOT LOGIC: Merge dot is red if ANY node that has a connection through it is selected
  //    OR if the merge group is being hovered
  //    This includes: current source, target, any other source node in the merge group, OR hover
  const isMergeDotRed: boolean = data?.hasMerge 
    ? !!(isSourceSelected || isTargetSelected || isMergeGroupNodeSelected || isMergeGroupHovered)
    : isIndividualEdgeHighlighted;
  
  // 3. SHARED SEGMENT LOGIC: Shared segment is red if merge dot is red
  //    When merge dot is red, everything after it (to target) must be red
  const isSharedSegmentHighlighted: boolean = isMergeDotRed;
  
  // For the main edge path (source to merge), use individual edge highlighting
  const isHighlighted: boolean = isIndividualEdgeHighlighted;
  
  // Debug logging for merged edges
  if (data?.hasMerge) {
    console.log(`🔍 Edge ${id.slice(-8)} (source: ${source.slice(-6)}, target: ${target.slice(-6)}):`, {
      isFirstInMergeGroup: data?.isFirstInMergeGroup,
      mergeGroupSourceNodes,
      isSourceSelected,
      isTargetSelected,
      isMergeGroupNodeSelected,
      '→ isMergeDotRed': isMergeDotRed,
      '→ isSharedSegmentHighlighted': isSharedSegmentHighlighted,
      '→ isIndividualEdgeHighlighted': isIndividualEdgeHighlighted
    });
  }
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Toggle selection by dispatching a custom event
    const event = new CustomEvent('edge-clicked', { 
      detail: { edgeId: id, currentlySelected: selected } 
    });
    globalThis.dispatchEvent(event);
  };

  const handleControlPointDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Dispatch event to update control point
      const event = new CustomEvent('uml-edge-control-drag', {
        detail: { edgeId: id, x: e.clientX, y: e.clientY }
      });
      globalThis.dispatchEvent(event);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, id]);

  // Handle double-click to reset control point
  const handleControlPointDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(false);
    const event = new CustomEvent('uml-edge-control-drop', {
      detail: { edgeId: id, point: null }
    });
    globalThis.dispatchEvent(event);
  };
  
  // Compute orthogonal (Manhattan) path with a bend and parallel offset
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.max(Math.hypot(dx, dy), 0.0001);
  const uy = dy / length;
  // Perpendicular to the overall direction
  const px = -uy;
  const py = dx / length;
  const count = Math.max(1, data?.parallelCount ?? 1);
  
  // Use custom control point if set
  const controlPoint = data?.customControlPoint;
  const mergePoint = data?.mergePoint;
  const hasMerge = data?.hasMerge;
  const isFirstInMergeGroup = data?.isFirstInMergeGroup;
  
  const distance = Math.hypot(dx, dy);
  
  // Calculate path using helper function
  const pathResult = calculateEdgePath({
    sourceX, sourceY, targetX, targetY,
    dx, dy, px, py, distance,
    controlPoint, mergePoint, hasMerge, isFirstInMergeGroup,
    count, id,
  });
  
  const { edgePath, sharedSegmentPath, labelX, labelY, startSegDx, startSegDy, endSegDx, endSegDy } = pathResult;

  // marker types are described via ids in <defs> below

  const getRelationshipStyle = (useHighlight: boolean = isHighlighted) => {
    const strokeColor = getHighlightColor(useHighlight, isHovered);
    const strokeWidth = getStrokeWidth(useHighlight, isHovered);
    const markerSuffix = getMarkerSuffix(useHighlight, isHovered);
    const relationshipType = data?.relationshipType;
    
    return buildRelationshipStyle(strokeColor, strokeWidth, markerSuffix, relationshipType);
  };

  const getRelationshipLabel = () => {
    // Use only provided custom label; avoid non-UML icon placeholders
    return data?.label || '';
  };

  const connectionCount = Math.max(1, data?.parallelCount ?? 1);

  return (
    <>
      <defs>
        {/* Normal markers */}
        <marker id="arrowhead-inheritance" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffffff" stroke="#374151" strokeWidth="2" />
        </marker>
        <marker id="arrowhead-inheritance-hover" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffffff" stroke="#f87171" strokeWidth="2" />
        </marker>
        <marker id="arrowhead-inheritance-selected" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffffff" stroke="#ef4444" strokeWidth="2" />
        </marker>
        
        <marker id="arrowhead-realization" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffffff" stroke="#374151" strokeWidth="2" />
        </marker>
        <marker id="arrowhead-realization-hover" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffffff" stroke="#f87171" strokeWidth="2" />
        </marker>
        <marker id="arrowhead-realization-selected" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffffff" stroke="#ef4444" strokeWidth="2" />
        </marker>
        
        {/* Diamonds for aggregation/composition at source side */}
        <marker id="diamond-aggregation" viewBox="0 0 12 12" refX="1" refY="6" markerWidth="12" markerHeight="12" orient="auto">
          <path d="M 6 0 L 12 6 L 6 12 L 0 6 Z" fill="#ffffff" stroke="#374151" strokeWidth="2" />
        </marker>
        <marker id="diamond-aggregation-hover" viewBox="0 0 12 12" refX="1" refY="6" markerWidth="12" markerHeight="12" orient="auto">
          <path d="M 6 0 L 12 6 L 6 12 L 0 6 Z" fill="#ffffff" stroke="#f87171" strokeWidth="2" />
        </marker>
        <marker id="diamond-aggregation-selected" viewBox="0 0 12 12" refX="1" refY="6" markerWidth="12" markerHeight="12" orient="auto">
          <path d="M 6 0 L 12 6 L 6 12 L 0 6 Z" fill="#ffffff" stroke="#ef4444" strokeWidth="2" />
        </marker>
        
        <marker id="diamond-composition" viewBox="0 0 12 12" refX="1" refY="6" markerWidth="12" markerHeight="12" orient="auto">
          <path d="M 6 0 L 12 6 L 6 12 L 0 6 Z" fill="#374151" />
        </marker>
        <marker id="diamond-composition-hover" viewBox="0 0 12 12" refX="1" refY="6" markerWidth="12" markerHeight="12" orient="auto">
          <path d="M 6 0 L 12 6 L 6 12 L 0 6 Z" fill="#f87171" />
        </marker>
        <marker id="diamond-composition-selected" viewBox="0 0 12 12" refX="1" refY="6" markerWidth="12" markerHeight="12" orient="auto">
          <path d="M 6 0 L 12 6 L 6 12 L 0 6 Z" fill="#ef4444" />
        </marker>
        
        <marker id="arrowhead-association" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#374151" />
        </marker>
        
        {/* Open arrow for dependency */}
        <marker id="arrowhead-open-dependency" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="#374151" strokeWidth="2" />
        </marker>
        <marker id="arrowhead-open-dependency-hover" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="#f87171" strokeWidth="2" />
        </marker>
        <marker id="arrowhead-open-dependency-selected" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="#ef4444" strokeWidth="2" />
        </marker>
      </defs>

      {/* Underlay halo to improve visibility at crossings */}
      <path
        id={`${id}-underlay`}
        d={edgePath}
        className="react-flow__edge-path"
        style={{
          stroke: '#ffffff',
          strokeWidth: (isHighlighted || isHovered) ? 8 : 7,
          opacity: 0.95,
          fill: 'none',
          strokeLinecap: 'butt',
          strokeLinejoin: 'miter',
          transition: 'stroke-width 0.2s ease',
        }}
      />

      {/* Transparent click area for better selection */}
      <path
        id={`${id}-clickarea`}
        d={edgePath}
        style={{
          strokeWidth: '25px',
          stroke: 'transparent',
          fill: 'none',
          cursor: 'pointer',
        }}
        onClick={handleClick}
        onMouseEnter={() => {
          setIsHovered(true);
          // If this edge is part of a merge group, notify parent to highlight entire group
          if (mergeGroupId && data?.onMergeGroupHover) {
            data.onMergeGroupHover(mergeGroupId);
          }
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          // Clear merge group hover
          if (mergeGroupId && data?.onMergeGroupHover) {
            data.onMergeGroupHover(null);
          }
        }}
      />

      {/* Main edge stroke */}
      <path
        id={id}
        style={{
          ...getRelationshipStyle(),
          strokeLinecap: 'butt',
          strokeLinejoin: 'miter',
          // Remove markers from individual branches when merged
          ...(hasMerge && { markerEnd: 'none', markerStart: 'none' })
        }}
        d={edgePath}
        onClick={handleClick}
        onMouseEnter={() => {
          setIsHovered(true);
          // If this edge is part of a merge group, notify parent to highlight entire group
          if (mergeGroupId && data?.onMergeGroupHover) {
            data.onMergeGroupHover(mergeGroupId);
          }
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          // Clear merge group hover
          if (mergeGroupId && data?.onMergeGroupHover) {
            data.onMergeGroupHover(null);
          }
        }}
      />

      {/* Shared segment for merged edges (ONLY rendered by first edge) */}
      {(sharedSegmentPath && isFirstInMergeGroup === true) && (
        <>
          {console.log(`🎨 RENDERING SHARED SEGMENT for edge ${id.slice(-8)}:`, {
            isMergeDotRed,
            isSharedSegmentHighlighted,
            color: isSharedSegmentHighlighted ? 'RED (#ef4444)' : 'BLACK (#374151)'
          })}
          {/* Underlay for shared segment */}
          <path
            id={`${id}-shared-underlay`}
            d={sharedSegmentPath}
            style={{
              stroke: '#ffffff',
              strokeWidth: (isSharedSegmentHighlighted || isHovered) ? 8 : 7,
              opacity: 0.95,
              fill: 'none',
              strokeLinecap: 'butt',
              strokeLinejoin: 'miter',
              transition: 'stroke-width 0.2s ease',
            }}
          />
          
          {/* Shared segment main stroke with marker - use shared segment highlighting */}
          <path
            id={`${id}-shared`}
            d={sharedSegmentPath}
            style={{
              ...getRelationshipStyle(isSharedSegmentHighlighted),
              strokeLinecap: 'butt',
              strokeLinejoin: 'miter',
            }}
            onClick={handleClick}
            onMouseEnter={() => {
              setIsHovered(true);
              // If this edge is part of a merge group, notify parent to highlight entire group
              if (mergeGroupId && data?.onMergeGroupHover) {
                data.onMergeGroupHover(mergeGroupId);
              }
            }}
            onMouseLeave={() => {
              setIsHovered(false);
              // Clear merge group hover
              if (mergeGroupId && data?.onMergeGroupHover) {
                data.onMergeGroupHover(null);
              }
            }}
          />
        </>
      )}

      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontSize: '12px',
          fontWeight: 700,
          fill: '#1f2937',
          stroke: '#ffffff',
          strokeWidth: 3.5,
          paintOrder: 'stroke fill',
          pointerEvents: 'none',
        }}
      >
        {getRelationshipLabel()}
      </text>

      {/* Connection count badge - changes color when hovering/selecting the line */}
      {connectionCount > 1 && (
        <g>
          <rect
            x={labelX - 12}
            y={labelY - 24}
            rx={6}
            ry={6}
            width={24}
            height={16}
            fill={getHighlightColor(isMergeDotRed, isHovered)}
            stroke="#ffffff"
            strokeWidth={2}
            style={{
              transition: 'fill 0.2s ease',
            }}
          />
          <text
            x={labelX}
            y={labelY - 16}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize: '10px',
              fontWeight: 800,
              fill: '#ffffff',
              pointerEvents: 'none',
            }}
          >
            {String(connectionCount)}
          </text>
        </g>
      )}

      {(data?.sourceMultiplicity !== undefined && data?.sourceMultiplicity !== null && data?.sourceMultiplicity !== '') && (
        <text
          x={calculateMultiplicityPosition(sourceX, sourceY, startSegDx, startSegDy, 'start').x}
          y={calculateMultiplicityPosition(sourceX, sourceY, startSegDx, startSegDy, 'start').y}
          className="react-flow__edge-text"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: '13px',
            fontWeight: 800,
            fill: getHighlightColor(isHighlighted, isHovered),
            stroke: '#ffffff',
            strokeWidth: 4,
            paintOrder: 'stroke fill',
            pointerEvents: 'none',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            transition: 'fill 0.2s ease',
          }}
        >
          {String(data.sourceMultiplicity)}
        </text>
      )}

      {(data?.targetMultiplicity !== undefined && data?.targetMultiplicity !== null && data?.targetMultiplicity !== '') && (
        <text
          x={calculateMultiplicityPosition(targetX, targetY, endSegDx, endSegDy, 'end').x}
          y={calculateMultiplicityPosition(targetX, targetY, endSegDx, endSegDy, 'end').y}
          className="react-flow__edge-text"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: '13px',
            fontWeight: 800,
            fill: getHighlightColor(isHighlighted, isHovered),
            stroke: '#ffffff',
            strokeWidth: 4,
            paintOrder: 'stroke fill',
            pointerEvents: 'none',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            transition: 'fill 0.2s ease',
          }}
        >
          {String(data.targetMultiplicity)}
        </text>
      )}

      {/* Draggable control point handle when selected */}
      {selected && (
        <g>
          {/* Control point position - use existing or calculate default */}
          {(() => {
            const cpX = controlPoint?.x || labelX;
            const cpY = controlPoint?.y || labelY;
            
            return (
              <>
                {/* Guide lines showing the curve */}
                <line
                  x1={sourceX}
                  y1={sourceY}
                  x2={cpX}
                  y2={cpY}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="5,5"
                  opacity="0.5"
                  pointerEvents="none"
                />
                <line
                  x1={cpX}
                  y1={cpY}
                  x2={targetX}
                  y2={targetY}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="5,5"
                  opacity="0.5"
                  pointerEvents="none"
                />
                
                {/* Extra large invisible hit area for easy dragging */}
                <circle
                  cx={cpX}
                  cy={cpY}
                  r="35"
                  fill="transparent"
                  style={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                  }}
                  onMouseDown={handleControlPointDragStart}
                  onDoubleClick={handleControlPointDoubleClick}
                  onMouseEnter={() => setIsControlHovered(true)}
                  onMouseLeave={() => setIsControlHovered(false)}
                />
                
                {/* Visual control point - much bigger with hover effect */}
                <circle
                  cx={cpX}
                  cy={cpY}
                  r={isControlHovered || isDragging ? "20" : "16"}
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="4"
                  style={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                    filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.3))',
                    transition: 'r 0.2s ease',
                  }}
                  onMouseDown={handleControlPointDragStart}
                  onDoubleClick={handleControlPointDoubleClick}
                  onMouseEnter={() => setIsControlHovered(true)}
                  onMouseLeave={() => setIsControlHovered(false)}
                />
                <circle
                  cx={cpX}
                  cy={cpY}
                  r={isControlHovered || isDragging ? "8" : "6"}
                  fill="#ffffff"
                  pointerEvents="none"
                  style={{
                    transition: 'r 0.2s ease',
                  }}
                />
                
                {/* Hint text */}
                <text
                  x={cpX}
                  y={cpY - 28}
                  textAnchor="middle"
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    fill: '#ef4444',
                    stroke: '#ffffff',
                    strokeWidth: 4,
                    paintOrder: 'stroke fill',
                    pointerEvents: 'none',
                  }}
                >
                  DRAG HERE • Double-click to reset
                </text>
              </>
            );
          })()}
        </g>
      )}

      {/* Merge point indicator */}
      {hasMerge && mergePoint && (
        <g>
          {/* Larger invisible hit area for merge point */}
          <circle
            cx={mergePoint.x}
            cy={mergePoint.y}
            r="15"
            fill="transparent"
            style={{
              cursor: 'pointer',
            }}
            onMouseEnter={() => {
              setIsHovered(true);
              // Highlight entire merge group when hovering over merge point
              if (mergeGroupId && data?.onMergeGroupHover) {
                data.onMergeGroupHover(mergeGroupId);
              }
            }}
            onMouseLeave={() => {
              setIsHovered(false);
              // Clear merge group hover
              if (mergeGroupId && data?.onMergeGroupHover) {
                data.onMergeGroupHover(null);
              }
            }}
          />
          {/* Visual merge point dot */}
          <circle
            cx={mergePoint.x}
            cy={mergePoint.y}
            r="5"
            fill={getHighlightColor(isMergeDotRed, isHovered)}
            stroke="#ffffff"
            strokeWidth="2"
            style={{
              transition: 'fill 0.2s ease',
              pointerEvents: 'none',
            }}
          />
        </g>
      )}
    </>
  );
}