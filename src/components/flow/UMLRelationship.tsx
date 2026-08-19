import React from 'react';
import { EdgeProps, EdgeLabelRenderer, useStore } from 'reactflow';
import { getBorderPoint } from '../../utils/reactionEdgeGeometry';

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
  expandedIntraModel?: boolean;
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

// Helper: Pure straight line (default — jjodel style), with optional parallel offset
function calculateStraightPath(params: PathParams & { parallelIndex?: number; parallelCount?: number; separation?: number }): PathResult {
  const { sourceX, sourceY, targetX, targetY, dx, dy, parallelIndex = 0, parallelCount = 1, separation = 14 } = params;
  const len = Math.max(Math.hypot(dx, dy), 0.0001);
  const nx = -dy / len;
  const ny = dx / len;
  const off = parallelCount > 1
    ? (parallelIndex - (parallelCount - 1) / 2) * separation
    : 0;
  const sx = sourceX + nx * off;
  const sy = sourceY + ny * off;
  const tx = targetX + nx * off;
  const ty = targetY + ny * off;
  return {
    edgePath: `M ${sx},${sy} L ${tx},${ty}`,
    labelX: (sx + tx) / 2,
    labelY: (sy + ty) / 2,
    startSegDx: tx - sx,
    startSegDy: ty - sy,
    endSegDx: tx - sx,
    endSegDy: ty - sy,
  };
}


// jjodel-style navy blue as the default edge color
const EDGE_DEFAULT = 'var(--v-uml-edge, #0c436e)';
const EDGE_SELECT  = '#ef4444';
const EDGE_SELECT_HOVER = '#f87171';
// Shorten the drawn line so endpoint markers sit on the visible segment (not under HTML nodes).
const EDGE_ENDPOINT_INSET = 8;
const MULT_ALONG_OFFSET = 28;
const MULT_PERP_OFFSET = 30;

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

type DirectionMarkerSide = 'start' | 'end';

function getDirectionMarkerSide(relationshipType?: string): DirectionMarkerSide | null {
  if (relationshipType === 'composition' || relationshipType === 'aggregation') return 'start';
  if (
    relationshipType === 'inheritance'
    || relationshipType === 'realization'
    || relationshipType === 'association'
    || relationshipType === 'dependency'
  ) {
    return 'end';
  }
  return null;
}

function directionMarkerContent(relationshipType: string, color: string): React.ReactNode {
  if (relationshipType === 'association') {
    return <path d="M 0 0 L 12 6 L 0 12 z" fill={color} />;
  }
  if (relationshipType === 'inheritance' || relationshipType === 'realization') {
    return <path d="M 0 0 L 12 6 L 0 12 z" fill="#ffffff" stroke={color} strokeWidth="1.5" />;
  }
  if (relationshipType === 'composition') {
    return <path d="M 7 1 L 13 7 L 7 13 L 1 7 Z" fill={color} />;
  }
  if (relationshipType === 'aggregation') {
    return <path d="M 7 1 L 13 7 L 7 13 L 1 7 Z" fill="#ffffff" stroke={color} strokeWidth="1.5" />;
  }
  if (relationshipType === 'dependency') {
    return (
      <path
        d="M 0 1 L 11 6 L 0 11"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  return null;
}

function directionMarkerViewBox(relationshipType: string): string {
  if (relationshipType === 'composition' || relationshipType === 'aggregation') {
    return '0 0 14 14';
  }
  return '0 0 12 12';
}

function directionMarkerSize(relationshipType: string): number {
  if (relationshipType === 'composition' || relationshipType === 'aggregation') {
    return 20;
  }
  return 18;
}

function directionMarkerAnchor(
  anchor: { x: number; y: number },
  ux: number,
  uy: number,
  side: DirectionMarkerSide,
  markerSize: number,
): { x: number; y: number } {
  const nudge = side === 'start' ? markerSize * 0.42 : -markerSize * 0.42;
  return {
    x: anchor.x + ux * nudge,
    y: anchor.y + uy * nudge,
  };
}

// Helper: Build relationship style object
function buildRelationshipStyle(
  strokeColor: string,
  strokeWidth: string,
  relationshipType?: string
): Record<string, string> {
  const baseStyle: Record<string, string> = {
    strokeWidth,
    stroke: strokeColor,
    fill: 'none',
    opacity: '0.9',
    cursor: 'pointer',
    transition: 'stroke 0.2s ease, stroke-width 0.2s ease',
  };

  if (relationshipType === 'realization') {
    return { ...baseStyle, strokeDasharray: '10,6' };
  }
  if (relationshipType === 'dependency') {
    return { ...baseStyle, strokeDasharray: '8,5' };
  }

  return baseStyle;
}

// Helper: Calculate multiplicity label position.
// Labels are offset along and perpendicular to the edge so they clear the line.
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
  const along = direction === 'start' ? MULT_ALONG_OFFSET : -MULT_ALONG_OFFSET;

  return {
    x: baseX + ux * along + nx * MULT_PERP_OFFSET,
    y: baseY + uy * along + ny * MULT_PERP_OFFSET,
  };
}

const MIDPOINT_GHOST_LABEL_CLEARANCE = 18;

/** Shift a midpoint name off the association ghost, preferring above the line. */
function offsetLabelAwayFromGhost(
  labelX: number,
  labelY: number,
  px: number,
  py: number,
  clearance = MIDPOINT_GHOST_LABEL_CLEARANCE,
): { x: number; y: number } {
  let nx = px;
  let ny = py;
  if (ny > 0.01 || (Math.abs(ny) <= 0.01 && nx > 0)) {
    nx = -px;
    ny = -py;
  }
  return { x: labelX + nx * clearance, y: labelY + ny * clearance };
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
      // Changing this key forces edge re-render when nodes move
      posKey: `${src?.positionAbsolute?.x ?? 0},${src?.positionAbsolute?.y ?? 0},${tgt?.positionAbsolute?.x ?? 0},${tgt?.positionAbsolute?.y ?? 0},${src?.width ?? 0},${src?.height ?? 0},${tgt?.width ?? 0},${tgt?.height ?? 0}`,
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
  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = dx / length;
  const count = Math.max(1, data?.parallelCount ?? 1);
  const endpointInset = Math.min(EDGE_ENDPOINT_INSET, Math.max(0, length / 2 - 8));
  const drawSourceX = finalSourceX + ux * endpointInset;
  const drawSourceY = finalSourceY + uy * endpointInset;
  const drawTargetX = finalTargetX - ux * endpointInset;
  const drawTargetY = finalTargetY - uy * endpointInset;

  const controlPoint = data?.customControlPoint;
  const distance = Math.hypot(dx, dy);

  // Routing: bezier when user has dragged a control point, straight line otherwise.
  const pathResult: PathResult = controlPoint
    ? calculateControlPointPath({
        sourceX: drawSourceX, sourceY: drawSourceY,
        targetX: drawTargetX, targetY: drawTargetY,
        dx, dy, px, py, distance, controlPoint,
        count, id,
      })
    : calculateStraightPath({
        sourceX: drawSourceX, sourceY: drawSourceY,
        targetX: drawTargetX, targetY: drawTargetY,
        dx, dy, px, py, distance,
        count, id,
        parallelIndex: data?.parallelIndex ?? 0,
        parallelCount: data?.parallelCount ?? count,
        separation: data?.separation ?? 16,
      });
  
  const { edgePath, labelX, labelY, startSegDx, startSegDy, endSegDx, endSegDy } = pathResult;

  // marker types are described via ids in <defs> below

  const getRelationshipStyle = (useHighlight: boolean = isHighlighted) => {
    const strokeColor = getHighlightColor(useHighlight, isHovered);
    const strokeWidth = getStrokeWidth(useHighlight, isHovered);
    const relationshipType = data?.relationshipType;

    return buildRelationshipStyle(strokeColor, strokeWidth, relationshipType);
  };

  const directionMarkerSide = getDirectionMarkerSide(data?.relationshipType);
  const directionMarkerColor = getHighlightColor(isHighlighted, isHovered);
  const directionMarkerAngle = Math.atan2(dy, dx) * (180 / Math.PI);
  const directionMarkerLineAnchor = directionMarkerSide
    ? {
        x: directionMarkerSide === 'start' ? drawSourceX : drawTargetX,
        y: directionMarkerSide === 'start' ? drawSourceY : drawTargetY,
      }
    : null;
  const directionMarkerPos = directionMarkerSide && directionMarkerLineAnchor && data?.relationshipType
    ? directionMarkerAnchor(
        directionMarkerLineAnchor,
        ux,
        uy,
        directionMarkerSide,
        directionMarkerSize(data.relationshipType),
      )
    : null;
  const directionMarkerRotation = directionMarkerAngle;
  const directionMarkerGraphic = data?.relationshipType
    ? directionMarkerContent(data.relationshipType, directionMarkerColor)
    : null;

  const getRelationshipLabel = () => {
    // Use only provided custom label; avoid non-UML icon placeholders
    return data?.label || '';
  };

  const relationshipLabel = getRelationshipLabel();
  const liftNameOffGhost = data?.expandedIntraModel === true
    && data?.relationshipType !== 'inheritance'
    && relationshipLabel.length > 0;
  const namePos = liftNameOffGhost
    ? offsetLabelAwayFromGhost(labelX, labelY, px, py)
    : { x: labelX, y: labelY };


  return (
    <>
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

      {!liftNameOffGhost && (
      <text
        x={namePos.x}
        y={namePos.y}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontSize: '11px',
          fontWeight: 600,
          fill: getHighlightColor(isHighlighted, isHovered),
          stroke: '#ffffff',
          strokeWidth: 3,
          paintOrder: 'stroke fill',
          pointerEvents: 'none',
          fontFamily: `'Segoe UI', system-ui, sans-serif`,
          transition: 'fill 0.2s ease',
        }}
      >
        {relationshipLabel}
      </text>
      )}


      {/* Multiplicity badges are rendered via EdgeLabelRenderer (below) so they
          always appear above node boxes — nothing to render in the SVG layer here */}

      {/* Direction markers are rendered in EdgeLabelRenderer so arrows/diamonds stay
          visible above HTML node boxes without requiring hover. */}
      <EdgeLabelRenderer>
        {liftNameOffGhost && (
          <div
            data-testid={`${id}-association-name`}
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${namePos.x}px, ${namePos.y}px)`,
              pointerEvents: 'none',
              zIndex: 1002,
              background: 'rgba(255,255,255,0.94)',
              borderRadius: 4,
              padding: '0 5px',
              fontSize: 11,
              fontWeight: 600,
              color: getHighlightColor(isHighlighted, isHovered),
              fontFamily: `'Segoe UI', system-ui, sans-serif`,
              lineHeight: '18px',
              whiteSpace: 'nowrap',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.9)',
            }}
          >
            {relationshipLabel}
          </div>
        )}
        {directionMarkerSide && data?.relationshipType && directionMarkerGraphic && directionMarkerPos && (
          <div
            key={`${id}-direction-marker`}
            data-testid={`${id}-direction-marker`}
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${directionMarkerPos.x}px, ${directionMarkerPos.y}px) rotate(${directionMarkerRotation}deg)`,
              pointerEvents: 'none',
              zIndex: 1001,
              lineHeight: 0,
            }}
          >
            <svg
              width={directionMarkerSize(data.relationshipType)}
              height={directionMarkerSize(data.relationshipType)}
              viewBox={directionMarkerViewBox(data.relationshipType)}
              overflow="visible"
              aria-hidden
            >
              {directionMarkerGraphic}
            </svg>
          </div>
        )}

        {/* Multiplicity badges — always painted above every node box */}
        {(data?.sourceMultiplicity !== undefined && data?.sourceMultiplicity !== null && data?.sourceMultiplicity !== '') && (() => {
          const srcMult = String(data.sourceMultiplicity);
          const sp = calculateMultiplicityPosition(finalSourceX, finalSourceY, startSegDx, startSegDy, 'start');
          const edgeColor = getHighlightColor(isHighlighted, isHovered);
          return (
            <div
              key={`${id}-src-mult`}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${sp.x}px, ${sp.y}px)`,
                pointerEvents: 'auto',
                cursor: 'pointer',
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
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${tp.x}px, ${tp.y}px)`,
                pointerEvents: 'auto',
                cursor: 'pointer',
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
