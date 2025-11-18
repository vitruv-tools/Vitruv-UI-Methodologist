import React from 'react';
import { EdgeProps } from 'reactflow';

interface ReactionRelationshipData {
  label?: string;
  code?: string;
  onDoubleClick?: (edgeId: string) => void;
  routingStyle?: 'curved' | 'orthogonal';
  separation?: number;
  parallelIndex?: number;
  parallelCount?: number;
}

export function ReactionRelationship({
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
}: EdgeProps<ReactionRelationshipData>) {
  // Compute orthogonal (Manhattan) path with a bend and parallel offset
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.max(Math.hypot(dx, dy), 0.0001);
  const ux = dx / length;
  const uy = dy / length;
  // Perpendicular to the overall direction
  const px = -uy;
  const py = ux;
  
  const count = Math.max(1, data?.parallelCount ?? 1);
  const index = Math.max(0, data?.parallelIndex ?? 0);
  const separation = Math.max(12, Math.min(72, data?.separation ?? 36));
  
  // Stable tiny spread per edge id to avoid clustering at crossings
  const hash = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h;
  };
  const centerIndex = (count - 1) / 2; // centers around 0
  const offset = 0;

  let edgePath: string;
  let labelX: number;
  let labelY: number;
  
  if (data?.routingStyle === 'orthogonal') {
    // 3-segment orthogonal
    const preferHorizontalFirst = Math.abs(dx) >= Math.abs(dy);
    let p1x = sourceX;
    let p1y = sourceY;
    let bendX: number;
    let bendY: number;
    
    // Extra fan-out near endpoints to reduce shared segments even across different pairs
    if (preferHorizontalFirst) {
      bendX = sourceX + dx / 2 + px * (offset);
      bendY = sourceY + py * (offset);
    } else {
      bendX = sourceX + px * (offset);
      bendY = sourceY + dy / 2 + py * (offset);
    }
    
    const p2x = bendX;
    const p2y = bendY;
    const p3x = preferHorizontalFirst ? bendX : targetX + px * (offset);
    const p3y = preferHorizontalFirst ? targetY + py * (offset) : bendY;
    const p4x = targetX;
    const p4y = targetY;
    
    edgePath = `M ${p1x},${p1y} L ${p2x},${p2y} L ${p3x},${p3y} L ${p4x},${p4y}`;
    labelX = (p2x + p3x) / 2;
    labelY = (p2y + p3y) / 2;
  } else {
    // Curved quadratic path
      edgePath = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
      labelX = (sourceX + targetX) / 2;
      labelY = (sourceY + targetY) / 2;
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('🔥 Reaction Edge double-clicked:', id);
    if (data?.onDoubleClick) {
      console.log('🔥 Calling onDoubleClick with id:', id);
      data.onDoubleClick(id);
    }
  };

  // Code-Indikator wenn Code vorhanden
  const hasCode = data?.code && data.code.trim().length > 0;
  
  // Edge color from style prop or default
  const edgeColor = style?.stroke || '#3b82f6';
  const edgeWidth = style?.strokeWidth || 2;
  
  const connectionCount = Math.max(1, data?.parallelCount ?? 1);

  return (
    <>
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
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }}
      />

      {/* Unsichtbare größere Klickfläche für bessere UX */}
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

      {/* Main edge stroke */}
      <path
        id={id}
        style={{
          strokeWidth: selected ? `${Number(edgeWidth) + 2}px` : `${edgeWidth}px`,
          stroke: selected ? '#ef4444' : edgeColor,
          fill: 'none',
          cursor: 'pointer',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          // KEIN Pfeil für Reaction Edges
        }}
        d={edgePath}
        onDoubleClick={handleDoubleClick}
      />

      {/* Label */}
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

      {/* Code-Indikator - zeigt an, dass Code vorhanden ist */}
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

      {/* Connection count badge: visible on selection to make relation more visible */}
      {selected && connectionCount > 1 && (
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
            {String(connectionCount)}
          </text>
        </g>
      )}
    </>
  );
}