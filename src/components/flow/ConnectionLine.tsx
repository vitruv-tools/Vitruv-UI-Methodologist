import React from 'react';

interface ConnectionLineProps {
  sourcePosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({
  sourcePosition,
  targetPosition,
}) => {
  console.log('🟪 ConnectionLine rendered', { sourcePosition, targetPosition });
  console.log('🟪 Drawing line from', sourcePosition, 'to', targetPosition);
  
  return (
  <svg
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 9999,
    }}
  >
    <line
      x1={sourcePosition.x}
      y1={sourcePosition.y}
      x2={targetPosition.x}
      y2={targetPosition.y}
      stroke="#95a5a6"
      strokeWidth="3"
      strokeDasharray="8,8"
      strokeLinecap="round"
    />
    
    <circle
      cx={targetPosition.x}
      cy={targetPosition.y}
      r="6"
      fill="#95a5a6"
    />
  </svg>
);
};