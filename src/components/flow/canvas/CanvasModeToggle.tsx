import React from 'react';
import { CanvasMode } from '../flowCanvasTypes';

const ModelingIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="21" x2="9" y2="9" />
  </svg>
);

const ConstraintsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ViewsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="3" x2="12" y2="21" />
    <line x1="3" y1="12" x2="21" y2="12" />
  </svg>
);

const MetricsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

interface ModeOption {
  label: string;
  mode: CanvasMode;
  icon: React.ReactNode;
}

export interface CanvasModeToggleProps {
  activeCanvasMode: CanvasMode;
  onSelectMode: (mode: CanvasMode) => void;
  /** Constraints mode is hidden for read-only viewers. */
  readOnly: boolean;
  /** Rendered directly beneath the toggle (e.g. project tabs). */
  projectTabsBelowModeToggle?: React.ReactNode;
}

/** Modeling / Constraints / Views / Metrics switch floating at the top of the canvas. */
export const CanvasModeToggle: React.FC<CanvasModeToggleProps> = ({
  activeCanvasMode,
  onSelectMode,
  readOnly,
  projectTabsBelowModeToggle,
}) => {
  const options: ModeOption[] = [
    { label: 'Modeling', mode: 'modeling', icon: <ModelingIcon /> },
    ...(readOnly ? [] : [{ label: 'Constraints', mode: 'constraints' as CanvasMode, icon: <ConstraintsIcon /> }]),
    { label: 'Views', mode: 'views', icon: <ViewsIcon /> },
    { label: 'Metrics', mode: 'metrics' as CanvasMode, icon: <MetricsIcon /> },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 31,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--v-chrome-bg)',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.13), 0 0 0 1px var(--v-card-border)',
          height: 44,
          padding: '0 4px',
          gap: 2,
        }}
      >
        {options.map(({ label, mode, icon }) => {
          const isActive = activeCanvasMode === mode;
          return (
            <button
              type="button"
              key={label}
              onClick={() => onSelectMode(mode)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 34,
                padding: '0 12px',
                border: isActive ? '1px solid #049484' : '1px solid transparent',
                borderRadius: 6,
                background: isActive ? '#049484' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--v-text-muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => {
                if (isActive) return;
                e.currentTarget.style.background = 'var(--v-chrome-hover)';
                e.currentTarget.style.color = 'var(--v-text)';
              }}
              onMouseLeave={e => {
                if (isActive) return;
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--v-text-muted)';
              }}
            >
              {icon}
              {label}
            </button>
          );
        })}
      </div>
      {projectTabsBelowModeToggle}
    </div>
  );
};
