export const DIAGRAM_TOOLBAR_TOP = 10;
export const DIAGRAM_TOOLBAR_HEIGHT = 46;
export const DIAGRAM_HINT_TOP = DIAGRAM_TOOLBAR_TOP + DIAGRAM_TOOLBAR_HEIGHT + 8;

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
