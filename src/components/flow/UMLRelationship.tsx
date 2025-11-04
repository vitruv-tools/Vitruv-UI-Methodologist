import React from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';
import { getEdgeColor } from '../../utils/edgeColorUtils';

interface UMLRelationshipData {
  label?: string;
  relationshipType: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
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

  // Get consistent color for this node pair
  // Get consistent color for this node pair
const edgeColor = getEdgeColor(source, target);
console.log('🎨 Edge Color:', edgeColor, 'for', source, '->', target); // ← FÜGE DIESE ZEILE HINZU

  const getRelationshipStyle = () => {
    const baseStyle = {
      strokeWidth: selected ? '3px' : '2px',
      stroke: edgeColor, // Use the assigned color
      fill: 'none',
    };

    switch (data?.relationshipType) {
      case 'inheritance':
        return {
          ...baseStyle,
          markerEnd: `url(#arrowhead-inheritance-${id})`,
        };
      case 'realization':
        return {
          ...baseStyle,
          strokeDasharray: '5,5',
          markerEnd: `url(#arrowhead-realization-${id})`,
        };
      case 'composition':
        return {
          ...baseStyle,
          markerEnd: `url(#arrowhead-composition-${id})`,
        };
      case 'aggregation':
        return {
          ...baseStyle,
          markerEnd: `url(#arrowhead-aggregation-${id})`,
        };
      case 'association':
        return {
          ...baseStyle,
          markerEnd: `url(#arrowhead-association-${id})`,
        };
      case 'dependency':
        return {
          ...baseStyle,
          strokeDasharray: '3,3',
          markerEnd: `url(#arrowhead-dependency-${id})`,
        };
      default:
        return baseStyle;
    }
  };

  const getRelationshipLabel = () => {
    switch (data?.relationshipType) {
      case 'inheritance':
        return '▲';
      case 'realization':
        return '⟶';
      case 'composition':
        return '◆';
      case 'aggregation':
        return '◇';
      case 'association':
        return '↔';
      case 'dependency':
        return '⟶';
      default:
        return data?.label || '';
    }
  };

  return (
    <>
      <defs>
        <marker
          id={`arrowhead-inheritance-${id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColor} />
        </marker>
        
        <marker
          id={`arrowhead-realization-${id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColor} />
        </marker>
        
        <marker
          id={`arrowhead-composition-${id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColor} />
        </marker>
        
        <marker
          id={`arrowhead-aggregation-${id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColor} />
        </marker>
        
        <marker
          id={`arrowhead-association-${id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColor} />
        </marker>
        
        <marker
          id={`arrowhead-dependency-${id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColor} />
        </marker>
      </defs>

      <path
        id={id}
        style={getRelationshipStyle()}
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
          fontWeight: 'bold',
          fill: edgeColor,
          background: '#fff',
          padding: '2px 4px',
        }}
      >
        {getRelationshipLabel()}
      </text>

      {data?.sourceMultiplicity && (
        <text
          x={sourceX + (sourceX < targetX ? -20 : 20)}
          y={sourceY + (sourceY < targetY ? -20 : 20)}
          className="react-flow__edge-text"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: '10px',
            fontWeight: 'bold',
            fill: edgeColor,
            background: '#fff',
            padding: '1px 3px',
            borderRadius: '3px',
          }}
        >
          {data.sourceMultiplicity}
        </text>
      )}

      {data?.targetMultiplicity && (
        <text
          x={targetX + (targetX < sourceX ? -20 : 20)}
          y={targetY + (targetY < sourceY ? -20 : 20)}
          className="react-flow__edge-text"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: '10px',
            fontWeight: 'bold',
            fill: edgeColor,
            background: '#fff',
            padding: '1px 3px',
            borderRadius: '3px',
          }}
        >
          {data.targetMultiplicity}
        </text>
      )}
    </>
  );
}