import React from 'react';
import { EdgeProps } from 'reactflow';

interface UMLRelationshipData {
  label?: string;
  relationshipType: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
}

export function UMLRelationship({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps<UMLRelationshipData & { parallelIndex?: number; parallelCount?: number; routingStyle?: 'curved' | 'orthogonal'; separation?: number }>) {
  // Compute orthogonal (Manhattan) path with a bend and parallel offset
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.max(Math.hypot(dx, dy), 0.0001);
  const ux = dx / length;
  const uy = dy / length;
  // Perpendicular to the overall direction
  const px = -uy;
  const py = ux;
  const count = Math.max(1, (data as any)?.parallelCount ?? 1);
  const index = Math.max(0, (data as any)?.parallelIndex ?? 0);
  const separation = Math.max(12, Math.min(72, (data as any)?.separation ?? 36));
  // Stable tiny spread per edge id to avoid clustering at crossings
  const hash = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h;
  };
  const jitter = ((hash(id) % 5) - 2) * 4; // -8, -4, 0, 4, 8 px
  const centerIndex = (count - 1) / 2; // centers around 0
  const offsetMultiplier = (index - centerIndex);
  const offset = offsetMultiplier * separation + jitter;
  let edgePath: string;
  let labelX: number;
  let labelY: number;
  // For multiplicity placement we need segment directions
  let startSegDx = 0, startSegDy = 0, endSegDx = 0, endSegDy = 0;
  if ((data as any)?.routingStyle === 'orthogonal') {
    // 3-segment orthogonal
    const preferHorizontalFirst = Math.abs(dx) >= Math.abs(dy);
    let p1x = sourceX;
    let p1y = sourceY;
    let bendX: number;
    let bendY: number;
    // Extra fan-out near endpoints to reduce shared segments even across different pairs
    const fanStart = ((hash(id + '-s') % 9) - 4) * 6; // -24..24 px
    const fanEnd = ((hash(id + '-t') % 9) - 4) * 6;   // -24..24 px
    if (preferHorizontalFirst) {
      bendX = sourceX + dx / 2 + px * (offset + fanStart);
      bendY = sourceY + py * (offset + fanStart);
    } else {
      bendX = sourceX + px * (offset + fanStart);
      bendY = sourceY + dy / 2 + py * (offset + fanStart);
    }
    const p2x = bendX;
    const p2y = bendY;
    const p3x = preferHorizontalFirst ? bendX : targetX + px * (offset + fanEnd);
    const p3y = preferHorizontalFirst ? targetY + py * (offset + fanEnd) : bendY;
    const p4x = targetX;
    const p4y = targetY;
    edgePath = `M ${p1x},${p1y} L ${p2x},${p2y} L ${p3x},${p3y} L ${p4x},${p4y}`;
    labelX = (p2x + p3x) / 2;
    labelY = (p2y + p3y) / 2;
    startSegDx = p2x - p1x; startSegDy = p2y - p1y;
    endSegDx = p4x - p3x; endSegDy = p4y - p3y;
  } else {
    // Curved quadratic path
    const mx = (sourceX + targetX) / 2 + px * offset;
    const my = (sourceY + targetY) / 2 + py * offset;
    edgePath = `M ${sourceX},${sourceY} Q ${mx},${my} ${targetX},${targetY}`;
    labelX = mx;
    labelY = my;
    startSegDx = mx - sourceX; startSegDy = my - sourceY;
    endSegDx = targetX - mx; endSegDy = targetY - my;
  }

  const getRelationshipStyle = () => {
    const baseStyle = {
      strokeWidth: selected ? '4.5px' : '2.5px',
      stroke: selected ? '#ef4444' : '#374151',
      fill: 'none',
      opacity: selected ? '1' : '0.9',
    };

    switch (data?.relationshipType) {
      case 'inheritance':
        return {
          ...baseStyle,
          markerEnd: selected ? 'url(#arrowhead-inheritance-selected)' : 'url(#arrowhead-inheritance)',
        };
      case 'realization':
        return {
          ...baseStyle,
          strokeDasharray: '10,6',
          markerEnd: selected ? 'url(#arrowhead-realization-selected)' : 'url(#arrowhead-realization)',
        };
      case 'composition':
        return {
          ...baseStyle,
          // UML: filled diamond at the whole (source) end, no arrow at target
          markerStart: selected ? 'url(#diamond-composition-selected)' : 'url(#diamond-composition)',
        };
      case 'aggregation':
        return {
          ...baseStyle,
          // UML: hollow diamond at the whole (source) end, no arrow at target
          markerStart: selected ? 'url(#diamond-aggregation-selected)' : 'url(#diamond-aggregation)',
        };
      case 'association':
        return {
          ...baseStyle,
          // UML: plain solid line for association by default
        };
      case 'dependency':
        return {
          ...baseStyle,
          strokeDasharray: '8,5',
          // UML: dashed line with open arrow
          markerEnd: selected ? 'url(#arrowhead-open-dependency-selected)' : 'url(#arrowhead-open-dependency)',
        };
      default:
        return baseStyle;
    }
  };

  const getRelationshipLabel = () => {
    // Use only provided custom label; avoid non-UML icon placeholders
    return data?.label || '';
  };

  const connectionCount = Math.max(1, (data as any)?.parallelCount ?? 1);

  return (
    <>
      <defs>
        <marker
          id="arrowhead-inheritance"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffffff" stroke="#374151" strokeWidth="2" />
        </marker>
        <marker
          id="arrowhead-inheritance-selected"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffffff" stroke="#ef4444" strokeWidth="2" />
        </marker>
        
        <marker
          id="arrowhead-realization"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffffff" stroke="#374151" strokeWidth="2" />
        </marker>
        <marker
          id="arrowhead-realization-selected"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffffff" stroke="#ef4444" strokeWidth="2" />
        </marker>
        
        {/* Diamonds for aggregation/composition at source side */}
        <marker id="diamond-aggregation" viewBox="0 0 12 12" refX="1" refY="6" markerWidth="12" markerHeight="12" orient="auto">
          <path d="M 6 0 L 12 6 L 6 12 L 0 6 Z" fill="#ffffff" stroke="#374151" strokeWidth="2" />
        </marker>
        <marker id="diamond-aggregation-selected" viewBox="0 0 12 12" refX="1" refY="6" markerWidth="12" markerHeight="12" orient="auto">
          <path d="M 6 0 L 12 6 L 6 12 L 0 6 Z" fill="#ffffff" stroke="#ef4444" strokeWidth="2" />
        </marker>
        <marker id="diamond-composition" viewBox="0 0 12 12" refX="1" refY="6" markerWidth="12" markerHeight="12" orient="auto">
          <path d="M 6 0 L 12 6 L 6 12 L 0 6 Z" fill="#374151" />
        </marker>
        <marker id="diamond-composition-selected" viewBox="0 0 12 12" refX="1" refY="6" markerWidth="12" markerHeight="12" orient="auto">
          <path d="M 6 0 L 12 6 L 6 12 L 0 6 Z" fill="#ef4444" />
        </marker>
        
        <marker
          id="arrowhead-association"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#374151" />
        </marker>
        <marker
          id="arrowhead-association-selected"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
        </marker>
        
        {/* Open arrow for dependency */}
        <marker id="arrowhead-open-dependency" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="#374151" strokeWidth="2" />
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
          strokeWidth: selected ? 8 : 7,
          opacity: 0.95,
          fill: 'none',
          strokeLinecap: 'butt',
          strokeLinejoin: 'miter',
        }}
      />

      {/* Main edge stroke */}
      <path
        id={id}
        style={{
          ...getRelationshipStyle(),
          strokeLinecap: 'butt',
          strokeLinejoin: 'miter',
        }}
        d={edgePath}
        className="react-flow__edge-path"
      />

      <text
        x={labelX}
        y={labelY}
        className="react-flow__edge-text"
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
        {getRelationshipLabel()}
      </text>

      {/* Connection count badge: visible on selection to make relation more visible */}
      {selected && connectionCount > 1 && (
        <g>
          <rect
            x={labelX - 12}
            y={labelY - 24}
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
          x={(() => {
            const len = Math.max(Math.hypot(startSegDx, startSegDy), 0.0001);
            const sx = startSegDx / len;
            const sy = startSegDy / len;
            const nx = -sy;
            return sourceX + sx * 18 + nx * 16;
          })()}
          y={(() => {
            const len = Math.max(Math.hypot(startSegDx, startSegDy), 0.0001);
            const sx = startSegDx / len;
            const sy = startSegDy / len;
            const ny = sx;
            return sourceY + sy * 18 + ny * 16;
          })()}
          className="react-flow__edge-text"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: '13px',
            fontWeight: 800,
            fill: selected ? '#ef4444' : '#111827',
            stroke: '#ffffff',
            strokeWidth: 4,
            paintOrder: 'stroke fill',
            pointerEvents: 'none',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        >
          {String(data.sourceMultiplicity)}
        </text>
      )}

      {(data?.targetMultiplicity !== undefined && data?.targetMultiplicity !== null && data?.targetMultiplicity !== '') && (
        <text
          x={(() => {
            const len = Math.max(Math.hypot(endSegDx, endSegDy), 0.0001);
            const ex = endSegDx / len;
            const ey = endSegDy / len;
            const nx = -ey;
            return targetX - ex * 18 + nx * 16;
          })()}
          y={(() => {
            const len = Math.max(Math.hypot(endSegDx, endSegDy), 0.0001);
            const ex = endSegDx / len;
            const ey = endSegDy / len;
            const ny = ex;
            return targetY - ey * 18 + ny * 16;
          })()}
          className="react-flow__edge-text"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: '13px',
            fontWeight: 800,
            fill: selected ? '#ef4444' : '#111827',
            stroke: '#ffffff',
            strokeWidth: 4,
            paintOrder: 'stroke fill',
            pointerEvents: 'none',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        >
          {String(data.targetMultiplicity)}
        </text>
      )}
    </>
  );
}
