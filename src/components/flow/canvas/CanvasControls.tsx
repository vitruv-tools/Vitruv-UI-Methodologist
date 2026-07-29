import React from 'react';

interface CanvasControlButtonProps {
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
}

export const CanvasControlButton: React.FC<CanvasControlButtonProps> = ({ onClick, title, icon }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      width: 36,
      height: 36,
      borderRadius: 10,
      border: '1px solid #e5e7eb',
      background: '#ffffff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18,
      transition: 'all 0.2s ease',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    }}
    title={title}
    onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
    onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}
  >
    {icon}
  </button>
);

export interface CanvasControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onToggleInteractive: () => void;
  isInteractive: boolean;
  readOnly: boolean;
}

/** Zoom / fit / lock stack anchored to the bottom-right of the canvas. */
export const CanvasControls: React.FC<CanvasControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onFitView,
  onToggleInteractive,
  isInteractive,
  readOnly,
}) => (
  <div
    style={{
      position: 'absolute',
      right: 16,
      bottom: 16,
      zIndex: 31,
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
    }}
  >
    <CanvasControlButton onClick={onZoomIn} title="Zoom in" icon="+" />
    <CanvasControlButton onClick={onZoomOut} title="Zoom out" icon="–" />
    <CanvasControlButton onClick={onFitView} title="Fit view" icon="⛶" />
    {!readOnly && (
      <CanvasControlButton
        onClick={onToggleInteractive}
        title={isInteractive ? 'Lock interactions' : 'Unlock interactions'}
        icon={isInteractive ? '🔓' : '🔒'}
      />
    )}
  </div>
);
