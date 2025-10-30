import React from 'react';

interface ConnectionLineProps {
  sourcePosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({
  sourcePosition,
  targetPosition,
}) => {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none', // Linie blockiert keine Maus-Events
        zIndex: 999, // Über allem anderen
      }}
    >
      <line
        x1={sourcePosition.x}
        y1={sourcePosition.y}
        x2={targetPosition.x}
        y2={targetPosition.y}
        stroke="#95a5a6" // Grau
        strokeWidth="2"
        strokeDasharray="5,5" // Gestrichelt
        strokeLinecap="round"
        style={{
          transition: 'stroke 0.1s ease', // Smooth color transition
        }}
      />
      
      {/* Optional: Kleiner Kreis am Ende (Cursor-Position) */}
      <circle
        cx={targetPosition.x}
        cy={targetPosition.y}
        r="4"
        fill="#95a5a6"
        style={{
          transition: 'all 0.1s ease',
        }}
      />
    </svg>
  );
};