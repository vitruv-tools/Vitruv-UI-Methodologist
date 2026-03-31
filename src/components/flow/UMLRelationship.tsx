import React from 'react';
import { EdgeProps, EdgeLabelRenderer, useStore } from 'reactflow';

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

// Helper: Quadratic bezier when user has manually dragged the control point
function calculateControlPointPath(params: PathParams): PathResult {
  const { sourceX, sourceY, targetX, targetY, controlPoint } = params;
  const cp = controlPoint!;
  return {
    edgePath: `M ${sourceX},${sourceY} Q ${cp.x},${cp.y} ${targetX},${targetY}`,
    labelX: cp.x,
    labelY: cp.y,
    startSegDx: cp.x - sourceX,
    startSegDy: cp.y - sourceY,
    endSegDx: targetX - cp.x,
    endSegDy: targetY - cp.y,
  };
}

// Helper: Pure straight line (default — jjodel style)
function calculateStraightPath(params: PathParams): PathResult {
  const { sourceX, sourceY, targetX, targetY, dx, dy } = params;
  return {
    edgePath: `M ${sourceX},${sourceY} L ${targetX},${targetY}`,
    labelX: (sourceX + targetX) / 2,
    labelY: (sourceY + targetY) / 2,
    startSegDx: dx,
    startSegDy: dy,
    endSegDx: dx,
    endSegDy: dy,
  };
}


// jjodel-style navy blue as the default edge color
const EDGE_DEFAULT = '#0c436e';
const EDGE_SELECT  = '#ef4444';
const EDGE_SELECT_HOVER = '#f87171';

// ─────────────────────────────────────────────────────────────────────────────
// Border-intersection: given a node's center + dimensions and the direction
// toward the other endpoint, returns the exact point on the box boundary.
// This is what makes connections spread across the border (like jjodel) instead
// of all converging at a single fixed handle.
// ─────────────────────────────────────────────────────────────────────────────
function getBorderPoint(
  cx: number, cy: number,
  nodeW: number, nodeH: number,
  towardX: number, towardY: number
): { x: number; y: number } {
  const hw = nodeW / 2;
  const hh = nodeH / 2;
  const dx = towardX - cx;
  const dy = towardY - cy;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx + hw, y: cy };
  const scaleX = Math.abs(dx) > 0.001 ? hw / Math.abs(dx) : Infinity;
  const scaleY = Math.abs(dy) > 0.001 ? hh / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}


// Helper: Get highlight color based on state
function getHighlightColor(isHighlighted: boolean, isHovered: boolean): string {
  if (isHighlighted) return EDGE_SELECT;
  if (isHovered) return EDGE_SELECT_HOVER;
  return EDGE_DEFAULT;
}

// Helper: Get stroke width based on state
function getStrokeWidth(isHighlighted: boolean, isHovered: boolean): string {
  if (isHighlighted) return '3px';
  if (isHovered) return '2.5px';
  return '1.5px';
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

// Helper: Calculate multiplicity label position.
// Labels are placed 26 px along the edge from the endpoint and 20 px
// perpendicular to it so they never sit on top of the line.
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
  const along = direction === 'start' ? 26 : -26;

  return {
    x: baseX + ux * along + nx * 20,
    y: baseY + uy * along + ny * 20,
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

  // Edge is highlighted when selected or hovered — simple, no merge state
  const isHighlighted: boolean = !!(selected || isHovered);
  
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
  
  // ── Border-intersection connection points ────────────────────────────────
  // Read actual node bounding boxes so each edge attaches at the exact point
  // where the center-to-center line crosses the box border (jjodel style).
  const nodeBounds = useStore((store) => {
    const src = store.nodeInternals.get(source);
    const tgt = store.nodeInternals.get(target);
    return {
      srcAbsX: src?.positionAbsolute?.x ?? sourceX,
      srcAbsY: src?.positionAbsolute?.y ?? sourceY,
      srcW:    src?.width  ?? 190,
      srcH:    src?.height ?? 80,
      tgtAbsX: tgt?.positionAbsolute?.x ?? targetX,
      tgtAbsY: tgt?.positionAbsolute?.y ?? targetY,
      tgtW:    tgt?.width  ?? 190,
      tgtH:    tgt?.height ?? 80,
    };
  });

  const srcCx = nodeBounds.srcAbsX + nodeBounds.srcW / 2;
  const srcCy = nodeBounds.srcAbsY + nodeBounds.srcH / 2;
  const tgtCx = nodeBounds.tgtAbsX + nodeBounds.tgtW / 2;
  const tgtCy = nodeBounds.tgtAbsY + nodeBounds.tgtH / 2;

  // ── Connection points: exact border intersection (jjodel style) ──────────
  const srcBorder = getBorderPoint(srcCx, srcCy, nodeBounds.srcW, nodeBounds.srcH, tgtCx, tgtCy);
  const tgtBorder = getBorderPoint(tgtCx, tgtCy, nodeBounds.tgtW, nodeBounds.tgtH, srcCx, srcCy);
  const finalSourceX = srcBorder.x;
  const finalSourceY = srcBorder.y;
  const finalTargetX = tgtBorder.x;
  const finalTargetY = tgtBorder.y;
  // ─────────────────────────────────────────────────────────────────────────

  const dx = finalTargetX - finalSourceX;
  const dy = finalTargetY - finalSourceY;
  const length = Math.max(Math.hypot(dx, dy), 0.0001);
  const uy = dy / length;
  const px = -uy;
  const py = dx / length;
  const count = Math.max(1, data?.parallelCount ?? 1);

  const controlPoint = data?.customControlPoint;
  const distance = Math.hypot(dx, dy);

  // Routing: bezier when user has dragged a control point, straight line otherwise.
  const pathResult: PathResult = controlPoint
    ? calculateControlPointPath({
        sourceX: finalSourceX, sourceY: finalSourceY,
        targetX: finalTargetX, targetY: finalTargetY,
        dx, dy, px, py, distance, controlPoint,
        count, id,
      })
    : calculateStraightPath({
        sourceX: finalSourceX, sourceY: finalSourceY,
        targetX: finalTargetX, targetY: finalTargetY,
        dx, dy, px, py, distance,
        count, id,
      });
  
  const { edgePath, labelX, labelY, startSegDx, startSegDy, endSegDx, endSegDy } = pathResult;

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


  return (
    <>
      <defs>
        {/* Inheritance — hollow equilateral triangle, navy default */}
        <marker id="arrowhead-inheritance" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="13" markerHeight="13" orient="auto">
          <path d="M 0 0 L 12 6 L 0 12 z" fill="#ffffff" stroke={EDGE_DEFAULT} strokeWidth="1.5" />
        </marker>
        <marker id="arrowhead-inheritance-hover" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="13" markerHeight="13" orient="auto">
          <path d="M 0 0 L 12 6 L 0 12 z" fill="#ffffff" stroke={EDGE_SELECT_HOVER} strokeWidth="1.5" />
        </marker>
        <marker id="arrowhead-inheritance-selected" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="13" markerHeight="13" orient="auto">
          <path d="M 0 0 L 12 6 L 0 12 z" fill="#ffffff" stroke={EDGE_SELECT} strokeWidth="1.5" />
        </marker>

        {/* Realization — hollow triangle + dashed line */}
        <marker id="arrowhead-realization" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="13" markerHeight="13" orient="auto">
          <path d="M 0 0 L 12 6 L 0 12 z" fill="#ffffff" stroke={EDGE_DEFAULT} strokeWidth="1.5" />
        </marker>
        <marker id="arrowhead-realization-hover" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="13" markerHeight="13" orient="auto">
          <path d="M 0 0 L 12 6 L 0 12 z" fill="#ffffff" stroke={EDGE_SELECT_HOVER} strokeWidth="1.5" />
        </marker>
        <marker id="arrowhead-realization-selected" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="13" markerHeight="13" orient="auto">
          <path d="M 0 0 L 12 6 L 0 12 z" fill="#ffffff" stroke={EDGE_SELECT} strokeWidth="1.5" />
        </marker>

        {/* Aggregation — hollow diamond */}
        <marker id="diamond-aggregation" viewBox="0 0 14 14" refX="1" refY="7" markerWidth="22" markerHeight="22" orient="auto">
          <path d="M 7 1 L 13 7 L 7 13 L 1 7 Z" fill="#ffffff" stroke={EDGE_DEFAULT} strokeWidth="1.5" />
        </marker>
        <marker id="diamond-aggregation-hover" viewBox="0 0 14 14" refX="1" refY="7" markerWidth="22" markerHeight="22" orient="auto">
          <path d="M 7 1 L 13 7 L 7 13 L 1 7 Z" fill="#ffffff" stroke={EDGE_SELECT_HOVER} strokeWidth="1.5" />
        </marker>
        <marker id="diamond-aggregation-selected" viewBox="0 0 14 14" refX="1" refY="7" markerWidth="22" markerHeight="22" orient="auto">
          <path d="M 7 1 L 13 7 L 7 13 L 1 7 Z" fill="#ffffff" stroke={EDGE_SELECT} strokeWidth="1.5" />
        </marker>

        {/* Composition — filled navy diamond */}
        <marker id="diamond-composition" viewBox="0 0 14 14" refX="1" refY="7" markerWidth="22" markerHeight="22" orient="auto">
          <path d="M 7 1 L 13 7 L 7 13 L 1 7 Z" fill={EDGE_DEFAULT} stroke={EDGE_DEFAULT} strokeWidth="1" />
        </marker>
        <marker id="diamond-composition-hover" viewBox="0 0 14 14" refX="1" refY="7" markerWidth="22" markerHeight="22" orient="auto">
          <path d="M 7 1 L 13 7 L 7 13 L 1 7 Z" fill={EDGE_SELECT_HOVER} />
        </marker>
        <marker id="diamond-composition-selected" viewBox="0 0 14 14" refX="1" refY="7" markerWidth="22" markerHeight="22" orient="auto">
          <path d="M 7 1 L 13 7 L 7 13 L 1 7 Z" fill={EDGE_SELECT} />
        </marker>

        {/* Association — filled navy arrowhead */}
        <marker id="arrowhead-association" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="13" markerHeight="13" orient="auto">
          <path d="M 0 0 L 12 6 L 0 12 z" fill={EDGE_DEFAULT} />
        </marker>

        {/* Dependency — open V arrow */}
        <marker id="arrowhead-open-dependency" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="13" markerHeight="13" orient="auto">
          <path d="M 0 1 L 11 6 L 0 11" fill="none" stroke={EDGE_DEFAULT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
        <marker id="arrowhead-open-dependency-hover" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="13" markerHeight="13" orient="auto">
          <path d="M 0 1 L 11 6 L 0 11" fill="none" stroke={EDGE_SELECT_HOVER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
        <marker id="arrowhead-open-dependency-selected" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="13" markerHeight="13" orient="auto">
          <path d="M 0 1 L 11 6 L 0 11" fill="none" stroke={EDGE_SELECT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>

      {/* White underlay halo so lines don't bleed into each other at crossings */}
      <path
        id={`${id}-underlay`}
        d={edgePath}
        className="react-flow__edge-path"
        style={{
          stroke: '#ffffff',
          strokeWidth: (isHighlighted || isHovered) ? 6 : 5,
          opacity: 0.92,
          fill: 'none',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          transition: 'stroke-width 0.15s ease',
        }}
      />

      {/* Transparent wide click / hover area */}
      <path
        id={`${id}-clickarea`}
        d={edgePath}
        style={{ strokeWidth: '20px', stroke: 'transparent', fill: 'none', cursor: 'pointer' }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Main edge stroke — pure straight line, jjodel style */}
      <path
        id={id}
        style={{ ...getRelationshipStyle(), strokeLinecap: 'round', strokeLinejoin: 'round' }}
        d={edgePath}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontSize: '11px',
          fontWeight: 600,
          fill: EDGE_DEFAULT,
          stroke: '#ffffff',
          strokeWidth: 3,
          paintOrder: 'stroke fill',
          pointerEvents: 'none',
          fontFamily: `'Segoe UI', system-ui, sans-serif`,
        }}
      >
        {getRelationshipLabel()}
      </text>


      {/* Multiplicity badges are rendered via EdgeLabelRenderer (below) so they
          always appear above node boxes — nothing to render in the SVG layer here */}

      {/* ── Multiplicity badges — rendered in EdgeLabelRenderer so they are
          always painted above every node box (React Flow's HTML overlay layer) */}
      <EdgeLabelRenderer>
        {(data?.sourceMultiplicity !== undefined && data?.sourceMultiplicity !== null && data?.sourceMultiplicity !== '') && (() => {
          const srcMult = String(data.sourceMultiplicity);
          const sp = calculateMultiplicityPosition(finalSourceX, finalSourceY, startSegDx, startSegDy, 'start');
          const edgeColor = getHighlightColor(isHighlighted, isHovered);
          return (
            <div
              key={`${id}-src-mult`}
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${sp.x}px, ${sp.y}px)`,
                pointerEvents: 'none',
                zIndex: 1000,
                background: 'white',
                border: `1.5px solid ${edgeColor}`,
                borderRadius: '4px',
                padding: '1px 6px',
                fontSize: '14px',
                fontWeight: 700,
                color: edgeColor,
                fontFamily: 'ui-monospace, Consolas, "Courier New", monospace',
                whiteSpace: 'nowrap',
                lineHeight: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                transition: 'color 0.2s ease, border-color 0.2s ease',
              }}
            >
              {srcMult}
            </div>
          );
        })()}

        {(data?.targetMultiplicity !== undefined && data?.targetMultiplicity !== null && data?.targetMultiplicity !== '') && (() => {
          const tgtMult = String(data.targetMultiplicity);
          const tp = calculateMultiplicityPosition(finalTargetX, finalTargetY, endSegDx, endSegDy, 'end');
          const edgeColor = getHighlightColor(isHighlighted, isHovered);
          return (
            <div
              key={`${id}-tgt-mult`}
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${tp.x}px, ${tp.y}px)`,
                pointerEvents: 'none',
                zIndex: 1000,
                background: 'white',
                border: `1.5px solid ${edgeColor}`,
                borderRadius: '4px',
                padding: '1px 6px',
                fontSize: '14px',
                fontWeight: 700,
                color: edgeColor,
                fontFamily: 'ui-monospace, Consolas, "Courier New", monospace',
                whiteSpace: 'nowrap',
                lineHeight: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                transition: 'color 0.2s ease, border-color 0.2s ease',
              }}
            >
              {tgtMult}
            </div>
          );
        })()}
      </EdgeLabelRenderer>

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
                  x1={finalSourceX}
                  y1={finalSourceY}
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
                  x2={finalTargetX}
                  y2={finalTargetY}
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

    </>
  );
}
