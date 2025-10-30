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
  cursor: 'crosshair',
  transition: 'all 0.2s ease',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'auto', // ← NEU: Stelle sicher dass Events funktionieren
};

    // Größerer Offset - weiter weg von der Box
    const offset = isHovered ? '20px' : '18px';

    switch (position) {
      case 'top':
        return {
          ...baseStyle,
          bottom: '100%', // Oberhalb der Box
          left: '50%',
          marginBottom: offset,
          transform: `translateX(-50%) ${isHovered ? 'scale(1.3)' : 'scale(1)'}`,
        };
      case 'bottom':
        return {
          ...baseStyle,
          top: '100%', // Unterhalb der Box
          left: '50%',
          marginTop: offset,
          transform: `translateX(-50%) ${isHovered ? 'scale(1.3)' : 'scale(1)'}`,
        };
      case 'left':
        return {
          ...baseStyle,
          right: '100%', // Links von der Box
          top: '50%',
          marginRight: offset,
          transform: `translateY(-50%) ${isHovered ? 'scale(1.3)' : 'scale(1)'}`,
        };
      case 'right':
        return {
          ...baseStyle,
          left: '100%', // Rechts von der Box
          top: '50%',
          marginLeft: offset,
          transform: `translateY(-50%) ${isHovered ? 'scale(1.3)' : 'scale(1)'}`,
        };
    }
  };

  // SVG Pfeil mit Spitze + Schwanz
  const getArrowSVG = () => {
    const color = isHovered ? '#2c3e50' : '#95a5a6';
    const size = 24; // SVG viewport size
    
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
            {/* Schwanz (vertikale Linie) */}
            <line x1="12" y1="24" x2="12" y2="8" stroke={color} strokeWidth="2" strokeLinecap="round" />
            {/* Pfeilspitze (Dreieck) */}
            <polygon points="12,2 8,10 16,10" fill={color} />
          </svg>
        );
      case 'bottom':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" style={svgStyle}>
            {/* Schwanz (vertikale Linie) */}
            <line x1="12" y1="0" x2="12" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" />
            {/* Pfeilspitze (Dreieck) */}
            <polygon points="12,22 8,14 16,14" fill={color} />
          </svg>
        );
      case 'left':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" style={svgStyle}>
            {/* Schwanz (horizontale Linie) */}
            <line x1="24" y1="12" x2="8" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
            {/* Pfeilspitze (Dreieck) */}
            <polygon points="2,12 10,8 10,16" fill={color} />
          </svg>
        );
      case 'right':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" style={svgStyle}>
            {/* Schwanz (horizontale Linie) */}
            <line x1="0" y1="12" x2="16" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
            {/* Pfeilspitze (Dreieck) */}
            <polygon points="22,12 14,8 14,16" fill={color} />
          </svg>
        );
    }
  };

  // NEU:
const handleMouseDown = (e: React.MouseEvent) => {
  console.log('🟢 Handle mousedown captured');
  
  e.stopPropagation();
  e.preventDefault();
  e.nativeEvent.stopImmediatePropagation(); // ← NEU: Stoppt ALLE Listener
  
  if (onConnectionStart) {
    onConnectionStart(position);
  }
  
  return false; // ← NEU: Extra Sicherheit
};

  return (
  <div
    style={getPositionStyle()}
    onPointerDownCapture={(e) => { // ← NEU: PointerDown statt MouseDown
      console.log('🟢 Handle pointer down CAPTURED');
      e.stopPropagation();
      e.preventDefault();
      
      // Setze ein Flag dass ReactFlow nicht dragging starten soll
      (e.target as HTMLElement).setAttribute('data-nodrag', 'true');
      
      if (onConnectionStart) {
        onConnectionStart(position);
      }
    }}
    onMouseEnter={() => {
      setIsHovered(true);
    }}
    onMouseLeave={() => {
      setIsHovered(false);
    }}
    data-nodrag="true" // ← NEU: ReactFlow's spezielles Attribut
    className="nodrag" // ← NEU: ReactFlow's spezielle Klasse
    title={`Connect from ${position}`}
  >
    {getArrowSVG()}
  </div>
);
};