
import React from 'react';
import { polylinePathD } from './flowCanvasAStarRouter';

interface ConnectionLineProps {
  sourcePosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
  points?: Array<{ x: number; y: number }>;
}

/**
 * ConnectionLine Component
 * Renders a dashed orthogonal (or straight) line between the source node and the cursor
 */
export const ConnectionLine: React.FC<ConnectionLineProps> = React.memo(
  ({ sourcePosition, targetPosition, points }) => {
    const hasPolyline = Boolean(points && points.length > 1);

    return (
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none', // Prevent interaction with the SVG
          zIndex: 9999, // Ensure the line is on top
        }}
      >
        {hasPolyline ? (
          <path
            d={polylinePathD(points!)}
            fill="none"
            stroke="#95a5a6"
            strokeWidth="3"
            strokeDasharray="8,8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
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
        )}

        {/* Draw circle at target position */}
        <circle
          cx={targetPosition.x}
          cy={targetPosition.y}
          r="6"
          fill="#95a5a6"
        />
      </svg>
    );
  }
);
