
import React, { useState, useMemo } from 'react';
import { Handle, Position } from 'reactflow';

interface ConnectionHandleProps {
  position: 'top' | 'bottom' | 'left' | 'right';
  onConnectionStart?: (position: 'top' | 'bottom' | 'left' | 'right') => void;
  isVisible?: boolean;
  offsetIndex?: number;
  totalHandles?: number;
}

const HANDLE_SPACING = 25;

/**
 * Maps custom position string to React Flow Position enum.
 */
const getReactFlowPosition = (pos: 'top' | 'bottom' | 'left' | 'right'): Position => {
  switch (pos) {
    case 'top': return Position.Top;
    case 'bottom': return Position.Bottom;
    case 'left': return Position.Left;
    case 'right': return Position.Right;
  }
};

/**
 * ConnectionHandle Component
 * Displays interactive connection points with hover effects and arrows.
 */
export const ConnectionHandle: React.FC<ConnectionHandleProps> = React.memo(({
  position,
  onConnectionStart,
  isVisible = true,
  offsetIndex = 0,
  totalHandles = 1,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Calculate symmetric offset from center
  const offset = useMemo(() => {
    if (totalHandles > 1) {
      const centerOffset = (totalHandles - 1) / 2;
      const indexOffset = offsetIndex - centerOffset;
      return indexOffset * HANDLE_SPACING;
    }
    return 0;
  }, [offsetIndex, totalHandles]);

  const hoverOffset = isHovered ? '20px' : '18px';

  /**
   * Compute dynamic position styles based on handle position and hover state.
   */
  const positionStyle = useMemo<React.CSSProperties>(() => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      cursor: 'crosshair',
      transition: 'all 0.2s ease',
      zIndex: 1000,
      alignItems: 'center',
      justifyContent: 'center',
    };

    switch (position) {
      case 'top':
        return {
          ...baseStyle,
          bottom: '100%',
          left: `calc(50% + ${offset}px)`,
          marginBottom: hoverOffset,
          transform: `translateX(-50%) ${isHovered ? 'scale(1.3)' : 'scale(1)'}`,
        };
      case 'bottom':
        return {
          ...baseStyle,
          top: '100%',
          left: `calc(50% + ${offset}px)`,
          marginTop: hoverOffset,
          transform: `translateX(-50%) ${isHovered ? 'scale(1.3)' : 'scale(1)'}`,
        };
      case 'left':
        return {
          ...baseStyle,
          right: '100%',
          top: `calc(50% + ${offset}px)`,
          marginRight: hoverOffset,
          transform: `translateY(-50%) ${isHovered ? 'scale(1.3)' : 'scale(1)'}`,
        };
      case 'right':
        return {
          ...baseStyle,
          left: '100%',
          top: `calc(50% + ${offset}px)`,
          marginLeft: hoverOffset,
          transform: `translateY(-50%) ${isHovered ? 'scale(1.3)' : 'scale(1)'}`,
        };
    }
  }, [position, offset, hoverOffset, isHovered]);

  /**
   * Render directional arrow SVG based on position.
   */
  const arrowSVG = useMemo(() => {
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
  }, [position, isHovered]);

  /**
   * Handle pointer down event to start connection.
   */
  const handlePointerDownCapture = (e: React.PointerEvent) => {
    console.log('🟢 Handle pointer down CAPTURED');
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setAttribute('data-nodrag', 'true');

    if (onConnectionStart) {
      onConnectionStart(position);
    }
  };

  const handleCountSuffix = totalHandles > 1 ? ` (${offsetIndex + 1}/${totalHandles})` : '';
  const handleTitle = `Connect from ${position}${handleCountSuffix}`;

  return (
    <>
      {/* Invisible React Flow handles for source and target */}
      <Handle
        type="source"
        position={getReactFlowPosition(position)}
        id={position}
        style={{ opacity: 0, width: 1, height: 1, border: 'none', background: 'transparent', pointerEvents: 'auto' }}
      />
      <Handle
        type="target"
        position={getReactFlowPosition(position)}
        id={position}
        style={{ opacity: 0, width: 1, height: 1, border: 'none', background: 'transparent', pointerEvents: 'auto' }}
      />

      {/* Visible interactive handle */}
      {isVisible && (
        <div
          style={positionStyle}
          onPointerDownCapture={handlePointerDownCapture}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          data-nodrag="true"
          className="nodrag"
          title={handleTitle}
        >
          {arrowSVG}
        </div>
      )}
    </>
  );
});

export default ConnectionHandle;
