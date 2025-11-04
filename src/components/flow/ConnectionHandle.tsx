// src/components/flow/ConnectionHandle.tsx
import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

interface ConnectionHandleProps {
  position: 'top' | 'bottom' | 'left' | 'right';
  onConnectionStart?: (position: 'top' | 'bottom' | 'left' | 'right') => void;
  isVisible?: boolean;
}

const getReactFlowPosition = (pos: 'top' | 'bottom' | 'left' | 'right'): Position => {
  switch (pos) {
    case 'top': return Position.Top;
    case 'bottom': return Position.Bottom;
    case 'left': return Position.Left;
    case 'right': return Position.Right;
  }
};

export const ConnectionHandle: React.FC<ConnectionHandleProps> = ({
  position,
  onConnectionStart,
  isVisible = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // NOTE: kein display hier — das visuelle Element wird bedingt gerendert
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    cursor: 'crosshair',
    transition: 'all 0.2s ease',
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    // pointerEvents hier nur für die visuelle Wrapper-Logik,
    // die React Flow Handles haben ihre eigenen pointerEvents unten.
  };

  const offset = isHovered ? '20px' : '18px';

  const getPositionStyle = (): React.CSSProperties => {
    switch (position) {
      case 'top':
        return {
          ...baseStyle,
          bottom: '100%',
          left: '50%',
          marginBottom: offset,
          transform: `translateX(-50%) ${isHovered ? 'scale(1.3)' : 'scale(1)'}`,
        };
      case 'bottom':
        return {
          ...baseStyle,
          top: '100%',
          left: '50%',
          marginTop: offset,
          transform: `translateX(-50%) ${isHovered ? 'scale(1.3)' : 'scale(1)'}`,
        };
      case 'left':
        return {
          ...baseStyle,
          right: '100%',
          top: '50%',
          marginRight: offset,
          transform: `translateY(-50%) ${isHovered ? 'scale(1.3)' : 'scale(1)'}`,
        };
      case 'right':
        return {
          ...baseStyle,
          left: '100%',
          top: '50%',
          marginLeft: offset,
          transform: `translateY(-50%) ${isHovered ? 'scale(1.3)' : 'scale(1)'}`,
        };
    }
  };

  const getArrowSVG = () => {
    const color = isHovered ? '#2c3e50' : '#95a5a6';
    const size = 24;

    const svgStyle: React.CSSProperties = {
      transition: 'all 0.2s ease',
      filter: isHovered
        ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
        : 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
    };

    switch (position) {
      case 'top':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" style={svgStyle}>
            <line x1="12" y1="24" x2="12" y2="8" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <polygon points="12,2 8,10 16,10" fill={color} />
          </svg>
        );
      case 'bottom':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" style={svgStyle}>
            <line x1="12" y1="0" x2="12" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <polygon points="12,22 8,14 16,14" fill={color} />
          </svg>
        );
      case 'left':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" style={svgStyle}>
            <line x1="24" y1="12" x2="8" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <polygon points="2,12 10,8 10,16" fill={color} />
          </svg>
        );
      case 'right':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" style={svgStyle}>
            <line x1="0" y1="12" x2="16" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <polygon points="22,12 14,8 14,16" fill={color} />
          </svg>
        );
    }
  };

  const handlePointerDownCapture = (e: React.PointerEvent) => {
    console.log('🟢 Handle pointer down CAPTURED');
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setAttribute('data-nodrag', 'true');

    if (onConnectionStart) {
      onConnectionStart(position);
    }
  };

  return (
    <>
      {/* React Flow Handles - IMMER im DOM (source + target!) */}
      <Handle
        type="source"
        position={getReactFlowPosition(position)}
        id={position}
        style={{
          opacity: 0,
          width: 1,
          height: 1,
          border: 'none',
          background: 'transparent',
          pointerEvents: 'auto', // wichtig, damit React Flow die Interaktion erkennt
        }}
      />

      <Handle
        type="target"
        position={getReactFlowPosition(position)}
        id={position}
        style={{
          opacity: 0,
          width: 1,
          height: 1,
          border: 'none',
          background: 'transparent',
          pointerEvents: 'auto',
        }}
      />

      {/* Visueller Pfeil - nur rendern wenn sichtbar */}
      {isVisible && (
        <div
          style={getPositionStyle()}
          onPointerDownCapture={handlePointerDownCapture}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          data-nodrag="true"
          className="nodrag"
          title={`Connect from ${position}`}
        >
          {getArrowSVG()}
        </div>
      )}
    </>
  );
};

export default ConnectionHandle;
