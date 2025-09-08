import React from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';

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

  const getRelationshipStyle = () => {
    const baseStyle = {
      strokeWidth: selected ? '3px' : '2px',
      stroke: selected ? '#0071e3' : '#333',
      fill: 'none',
    };

    switch (data?.relationshipType) {
      case 'inheritance':
        return {
          ...baseStyle,
          stroke: '#16a085',
          markerEnd: 'url(#arrowhead-inheritance)',
        };
      case 'realization':
        return {
          ...baseStyle,
          stroke: '#e67e22',
          strokeDasharray: '5,5',
          markerEnd: 'url(#arrowhead-realization)',
        };
      case 'composition':
        return {
          ...baseStyle,
          stroke: '#8e44ad',
          markerEnd: 'url(#arrowhead-composition)',
        };
      case 'aggregation':
        return {
          ...baseStyle,
          stroke: '#27ae60',
          markerEnd: 'url(#arrowhead-aggregation)',
        };
      case 'association':
        return {
          ...baseStyle,
          stroke: '#34495e',
          markerEnd: 'url(#arrowhead-association)',
        };
      case 'dependency':
        return {
          ...baseStyle,
          stroke: '#95a5a6',
          strokeDasharray: '3,3',
          markerEnd: 'url(#arrowhead-dependency)',
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
          id="arrowhead-inheritance"
          viewBox="0 0 10 10"
          refX="9"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#16a085" />
        </marker>
        
        <marker
          id="arrowhead-realization"
          viewBox="0 0 10 10"
          refX="9"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#e67e22" />
        </marker>
        
        <marker
          id="arrowhead-composition"
          viewBox="0 0 10 10"
          refX="9"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#8e44ad" />
        </marker>
        
        <marker
          id="arrowhead-aggregation"
          viewBox="0 0 10 10"
          refX="9"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#27ae60" />
        </marker>
        
        <marker
          id="arrowhead-association"
          viewBox="0 0 10 10"
          refX="9"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#34495e" />
        </marker>
        
        <marker
          id="arrowhead-dependency"
          viewBox="0 0 10 10"
          refX="9"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#95a5a6" />
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
          fill: '#333',
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
            fill: '#e74c3c',
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
            fill: '#e74c3c',
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
