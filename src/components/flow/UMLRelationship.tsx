import React from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';
import { getEdgeColor } from '../../utils/edgeColorUtils';

interface UMLRelationshipData {
  label?: string;
  relationshipType: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  code?: string; // NEU: Code für diese Relation
  onDoubleClick?: (edgeId: string) => void; // NEU: Handler für Doppelklick
}

export function UMLRelationship({
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
}: EdgeProps<UMLRelationshipData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeColor = getEdgeColor(source, target);

  const markerTypes = [
    'inheritance',
    'realization',
    'composition',
    'aggregation',
    'association',
    'dependency',
  ];

  const getRelationshipStyle = () => {
    const baseStyle: React.CSSProperties = {
      strokeWidth: selected ? '3px' : '2px',
      stroke: edgeColor,
      fill: 'none',
      cursor: 'pointer', // NEU: Zeige an, dass Edge klickbar ist
    };

    const dashStyles: Record<string, string> = {
      realization: '5,5',
      dependency: '3,3',
    };

    return {
      ...baseStyle,
      strokeDasharray: dashStyles[data?.relationshipType || ''] || undefined,
      markerEnd: `url(#arrowhead-${data?.relationshipType}-${id})`,
    };
  };

  const relationshipSymbols: Record<string, string> = {
    inheritance: '▲',
    realization: '⟶',
    composition: '◆',
    aggregation: '◇',
    association: '↔',
    dependency: '⟶',
  };

  const getRelationshipLabel = () =>
    relationshipSymbols[data?.relationshipType || ''] || data?.label || '';

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 'bold',
    fill: edgeColor,
    cursor: 'pointer', // NEU
  };

  const multiplicityStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 'bold',
    fill: edgeColor,
  };

  // NEU: Handler für Doppelklick
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('🔥 Edge double-clicked:', id);
    console.log('🔥 data.onDoubleClick exists?', !!data?.onDoubleClick);
    if (data?.onDoubleClick) {
      console.log('🔥 Calling onDoubleClick with id:', id);
      data.onDoubleClick(id);
    }
  };

  // NEU: Code-Indikator wenn Code vorhanden
  const hasCode = data?.code && data.code.trim().length > 0;

  return (
    <>
      <defs>
        {markerTypes.map((type) => (
          <marker
            key={type}
            id={`arrowhead-${type}-${id}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColor} />
          </marker>
        ))}
      </defs>

      {/* NEU: Unsichtbare größere Klickfläche für bessere UX */}
      <path
        id={`${id}-clickarea`}
        style={{
          ...getRelationshipStyle(),
          strokeWidth: '20px',
          stroke: 'transparent',
          fill: 'none',
        }}
        d={edgePath}
        onDoubleClick={handleDoubleClick}
      />

      <path 
        id={id} 
        style={getRelationshipStyle()} 
        d={edgePath}
        onDoubleClick={handleDoubleClick}
      />

      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="middle"
        style={labelStyle}
        onDoubleClick={handleDoubleClick}
      >
        {getRelationshipLabel()}
      </text>

      {/* NEU: Code-Indikator - zeigt an, dass Code vorhanden ist */}
      {hasCode && (
        <g onDoubleClick={handleDoubleClick}>
          <circle
            cx={labelX + 20}
            cy={labelY - 15}
            r="8"
            fill="#0e639c"
            stroke="#fff"
            strokeWidth="1.5"
          />
          <text
            x={labelX + 20}
            y={labelY - 15}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize: '10px',
              fontWeight: 'bold',
              fill: '#fff',
              pointerEvents: 'none',
            }}
          >
            {'</>'}
          </text>
        </g>
      )}

      {data?.sourceMultiplicity && (
        <text
          x={sourceX + (sourceX < targetX ? -20 : 20)}
          y={sourceY + (sourceY < targetY ? -20 : 20)}
          textAnchor="middle"
          dominantBaseline="middle"
          style={multiplicityStyle}
        >
          {data.sourceMultiplicity}
        </text>
      )}

      {data?.targetMultiplicity && (
        <text
          x={targetX + (targetX < sourceX ? -20 : 20)}
          y={targetY + (targetY < sourceY ? -20 : 20)}
          textAnchor="middle"
          dominantBaseline="middle"
          style={multiplicityStyle}
        >
          {data.targetMultiplicity}
        </text>
      )}
    </>
  );
}