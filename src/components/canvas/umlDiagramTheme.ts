import type { CSSProperties } from 'react';

export const DIAGRAM_TOOLBAR_TOP = 10;
export const DIAGRAM_TOOLBAR_HEIGHT = 46;
export const DIAGRAM_HINT_TOP = DIAGRAM_TOOLBAR_TOP + DIAGRAM_TOOLBAR_HEIGHT + 8;

/** Dotted workspace background — matches canvas / HomePage grid */
export const WORKSPACE_DOT_BACKGROUND: CSSProperties = {
  backgroundColor: '#f3f4f6',
  backgroundImage: 'radial-gradient(circle, #d1d5db 0.75px, transparent 0.75px)',
  backgroundSize: '24px 24px',
};

/** Vitruv design tokens — aligned with Model Library / canvas UI */
export const UML = {
  primary: '#049484',
  primarySoft: '#ecfdf5',
  primaryBorder: '#a7f3d0',
  primaryRing: 'rgba(4,148,132,0.2)',
  ink: '#0c436e',
  text: '#374151',
  textMuted: '#64748b',
  border: '#e2e8f0',
  surface: '#ffffff',
  surfaceMuted: '#f8fafc',
  fontSans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;
