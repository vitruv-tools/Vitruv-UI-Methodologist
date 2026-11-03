import React from 'react';
import { themeVars } from '../../theme/theme';

const BRAND = '#049484';

export interface PanelCloseButtonProps {
  /** Accessible name, e.g. "Close metrics". */
  label: string;
  onClick: () => void;
}

/** Round × button in the top right corner of a canvas panel (Metrics, Semantic overlap). */
export const PanelCloseButton: React.FC<PanelCloseButtonProps> = ({ label, onClick }) => (
  <button
    type="button"
    aria-label={label}
    title="Close"
    onClick={onClick}
    style={{
      flexShrink: 0,
      width: 40,
      height: 40,
      borderRadius: '50%',
      border: `1.5px solid ${themeVars.border}`,
      background: themeVars.surfaceMuted,
      color: themeVars.text,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.background = BRAND;
      e.currentTarget.style.borderColor = BRAND;
      e.currentTarget.style.color = '#fff';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = themeVars.surfaceMuted;
      e.currentTarget.style.borderColor = themeVars.border;
      e.currentTarget.style.color = themeVars.text;
    }}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  </button>
);
