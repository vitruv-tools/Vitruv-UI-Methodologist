import React, { useState, useMemo, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import {
  HandlePosition,
  connectionHandlePositionStyle,
  tipFromHandleRect,
} from './connectionHandleLayout';

function connectionHandleArrowSvg(
  position: HandlePosition,
  isHovered: boolean,
  size = 24,
): React.ReactNode {
  const color = isHovered ? 'var(--v-chrome-icon-hover)' : 'var(--v-chrome-icon)';
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
}

interface ConnectionHandleProps {
  position: HandlePosition;
  onConnectionStart?: (position: HandlePosition, tipScreenPos: { x: number; y: number }) => void;
  isVisible?: boolean;
  offsetIndex?: number;
  totalHandles?: number;
}

const HANDLE_SPACING = 25;

const getReactFlowPosition = (pos: HandlePosition): Position => {
  switch (pos) {
    case 'top': return Position.Top;
    case 'bottom': return Position.Bottom;
    case 'left': return Position.Left;
    case 'right': return Position.Right;
  }
};

export const ConnectionHandle: React.FC<ConnectionHandleProps> = React.memo(({
  position,
  onConnectionStart,
  isVisible = true,
  offsetIndex = 0,
  totalHandles = 1,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const handleRef = useRef<HTMLButtonElement>(null);

  const offset = useMemo(() => {
    if (totalHandles > 1) {
      const centerOffset = (totalHandles - 1) / 2;
      const indexOffset = offsetIndex - centerOffset;
      return indexOffset * HANDLE_SPACING;
    }
    return 0;
  }, [offsetIndex, totalHandles]);

  const hoverOffset = isHovered ? '20px' : '18px';

  const positionStyle = useMemo(
    () => connectionHandlePositionStyle(position, offset, hoverOffset, isHovered),
    [position, offset, hoverOffset, isHovered],
  );

  const arrowSVG = useMemo(
    () => connectionHandleArrowSvg(position, isHovered),
    [position, isHovered],
  );

  const handlePointerDownCapture = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).dataset.nodrag = 'true';

    if (!onConnectionStart) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onConnectionStart(position, tipFromHandleRect(rect, position));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const rect = handleRef.current?.getBoundingClientRect();
      if (rect && onConnectionStart) {
        onConnectionStart(position, tipFromHandleRect(rect, position));
      }
    }
  };

  const handleCountSuffix = totalHandles > 1 ? ` (${offsetIndex + 1}/${totalHandles})` : '';
  const handleTitle = `Connect from ${position}${handleCountSuffix}`;

  return (
    <>
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

      {isVisible && (
        <button
          ref={handleRef}
          type="button"
          style={{
            ...positionStyle,
            background: 'transparent',
            border: 0,
            padding: 0,
            lineHeight: 0,
          }}
          onPointerDownCapture={handlePointerDownCapture}
          onKeyDown={handleKeyDown}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => setIsHovered(true)}
          onBlur={() => setIsHovered(false)}
          data-nodrag="true"
          className="nodrag"
          title={handleTitle}
          aria-label={handleTitle}
        >
          {arrowSVG}
        </button>
      )}
    </>
  );
});

export default ConnectionHandle;
