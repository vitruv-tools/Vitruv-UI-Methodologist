import React, { useState } from 'react';

interface ConnectionHandleProps {
  position: 'top' | 'bottom' | 'left' | 'right';
  onConnectionStart?: (position: 'top' | 'bottom' | 'left' | 'right') => void;
}

export const ConnectionHandle: React.FC<ConnectionHandleProps> = ({ 
  position, 
  onConnectionStart 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Position styling basierend auf position prop
  const getPositionStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      width: isHovered ? '20px' : '16px',
      height: isHovered ? '20px' : '16px',
      background: isHovered ? '#2c3e50' : '#bdc3c7',
      borderRadius: '50%',
      cursor: 'crosshair',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      border: '2px solid #ffffff',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    };

    switch (position) {
      case 'top':
        return {
          ...baseStyle,
          top: '-10px',
          left: '50%',
          transform: `translateX(-50%) ${isHovered ? 'scale(1.1)' : 'scale(1)'}`,
        };
      case 'bottom':
        return {
          ...baseStyle,
          bottom: '-10px',
          left: '50%',
          transform: `translateX(-50%) ${isHovered ? 'scale(1.1)' : 'scale(1)'}`,
        };
      case 'left':
        return {
          ...baseStyle,
          left: '-10px',
          top: '50%',
          transform: `translateY(-50%) ${isHovered ? 'scale(1.1)' : 'scale(1)'}`,
        };
      case 'right':
        return {
          ...baseStyle,
          right: '-10px',
          top: '50%',
          transform: `translateY(-50%) ${isHovered ? 'scale(1.1)' : 'scale(1)'}`,
        };
    }
  };

  // Pfeil-Icon basierend auf Position
  const getArrowIcon = () => {
    const iconStyle: React.CSSProperties = {
      color: isHovered ? '#ffffff' : '#7f8c8d',
      fontSize: isHovered ? '12px' : '10px',
      transition: 'all 0.2s ease',
    };

    switch (position) {
      case 'top':
        return <span style={iconStyle}>▲</span>;
      case 'bottom':
        return <span style={iconStyle}>▼</span>;
      case 'left':
        return <span style={iconStyle}>◀</span>;
      case 'right':
        return <span style={iconStyle}>▶</span>;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); // Verhindere Node-Drag
    if (onConnectionStart) {
      onConnectionStart(position);
    }
  };

  return (
    <div
      style={getPositionStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={handleMouseDown}
      title={`Connect from ${position}`}
    >
      {getArrowIcon()}
    </div>
  );
};