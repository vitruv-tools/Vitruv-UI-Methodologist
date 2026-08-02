import React from 'react';

/** Full-canvas hint shown while files are dragged over the workspace. */
export const CanvasDropOverlay: React.FC = () => (
  <div style={{
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(52, 152, 219, 0.95)',
    color: 'white',
    padding: '24px 48px',
    borderRadius: '12px',
    fontSize: '20px',
    fontWeight: 'bold',
    zIndex: 1000,
    pointerEvents: 'none',
    boxShadow: '0 8px 32px rgba(52, 152, 219, 0.3)',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    backdropFilter: 'blur(10px)',
  }}>
    Drop files here
  </div>
);
