import React from 'react';
import { EdgeProps, Position } from 'reactflow';

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
  sourcePosition,
  targetPosition,
  data,
  selected,
  style,
}: EdgeProps<ReactionRelationshipData>) {
  
  // Calculate offset for multiple edges on the same side
  const parallelCount = data?.parallelCount ?? 1;
  const parallelIndex = data?.parallelIndex ?? 0;
  
  let sourceOffsetX = 0;
  let sourceOffsetY = 0;
  let targetOffsetX = 0;
  let targetOffsetY = 0;
  
  if (parallelCount > 1) {
    const EDGE_SPACING = 25;
    const centerOffset = (parallelCount - 1) / 2;
    const indexOffset = parallelIndex - centerOffset;
    const offset = indexOffset * EDGE_SPACING;
    
    // Apply offset based on handle position
    if (sourcePosition === Position.Top || sourcePosition === Position.Bottom) {
      sourceOffsetX = offset;
    } else {
      sourceOffsetY = offset;
    }
    
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
  
  if (data?.routingStyle === 'orthogonal') {
    const preferHorizontalFirst = Math.abs(dx) >= Math.abs(dy);
    
    let bendX: number;
    let bendY: number;
    
    if (preferHorizontalFirst) {
      bendX = actualSourceX + dx / 2;
      bendY = actualSourceY;
    } else {
      bendX = actualSourceX;
      bendY = actualSourceY + dy / 2;
    }
    
    const p2x = bendX;
    const p2y = bendY;
    const p3x = preferHorizontalFirst ? bendX : actualTargetX;
    const p3y = preferHorizontalFirst ? actualTargetY : bendY;
    
    edgePath = `M ${actualSourceX},${actualSourceY} L ${p2x},${p2y} L ${p3x},${p3y} L ${actualTargetX},${actualTargetY}`;
    labelX = (p2x + p3x) / 2;
    labelY = (p2y + p3y) / 2;
    
    arrowX = actualTargetX;
    arrowY = actualTargetY;
    
    const finalDx = actualTargetX - p3x;
    const finalDy = actualTargetY - p3y;
    arrowAngle = Math.atan2(finalDy, finalDx) * (180 / Math.PI);
  } else {
    edgePath = `M ${actualSourceX},${actualSourceY} L ${actualTargetX},${actualTargetY}`;
    labelX = (actualSourceX + actualTargetX) / 2;
    labelY = (actualSourceY + actualTargetY) / 2;
    
    arrowX = actualTargetX;
    arrowY = actualTargetY;
    arrowAngle = Math.atan2(dy, dx) * (180 / Math.PI);
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('🔥 Reaction Edge double-clicked:', id);
    if (data?.onDoubleClick) {
      console.log('🔥 Calling onDoubleClick with id:', id);
      data.onDoubleClick(id);
    }
  };

  const hasCode = data?.code && data.code.trim().length > 0;
  const edgeColor = style?.stroke || '#3b82f6';
  const edgeWidth = style?.strokeWidth || 2;

  return (
    <>
      {/* Underlay halo for visibility */}
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

      {/* Invisible larger click area */}
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
        }}
        d={edgePath}
        onDoubleClick={handleDoubleClick}
      />

      {/* Arrow marker at the end */}
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

      {/* Code indicator badge */}
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

      {/* Connection count badge on selection */}
      {selected && parallelCount > 1 && (
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
            {String(parallelCount)}
          </text>
        </g>
      )}
    </>
  );
}