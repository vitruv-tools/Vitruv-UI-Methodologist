import type { CSSProperties } from 'react';

export const DIAGRAM_TOOLBAR_TOP = 10;
export const DIAGRAM_TOOLBAR_HEIGHT = 46;
export const DIAGRAM_HINT_TOP = DIAGRAM_TOOLBAR_TOP + DIAGRAM_TOOLBAR_HEIGHT + 8;

/** Dotted workspace background — matches canvas / HomePage grid */
export const WORKSPACE_DOT_BACKGROUND: CSSProperties = {
  backgroundColor: 'var(--v-workspace-bg)',
  backgroundImage: 'radial-gradient(circle, var(--v-workspace-dot) 0.75px, transparent 0.75px)',
  backgroundSize: '24px 24px',
};

/** Vitruv design tokens — aligned with Model Library / canvas UI */
export const UML = {
  primary: '#049484',
  primarySoft: 'var(--v-uml-primary-soft, #ecfdf5)',
  primaryBorder: 'var(--v-uml-primary-border, #a7f3d0)',
  primaryRing: 'rgba(4,148,132,0.2)',
  ink: 'var(--v-text)',
  text: 'var(--v-text-secondary)',
  textMuted: 'var(--v-text-muted)',
  border: 'var(--v-border)',
  surface: 'var(--v-surface)',
  surfaceMuted: 'var(--v-surface-muted)',
  surfaceHover: 'var(--v-surface-hover)',
  textFaint: 'var(--v-text-faint)',
  edge: 'var(--v-uml-edge, #0c436e)',
  edgeHalo: 'var(--v-uml-edge-halo, #ffffff)',
  circle: 'var(--v-uml-circle, #0c436e)',
  boxBg: 'var(--v-uml-box-bg, #ffffff)',
  boxMuted: 'var(--v-uml-box-muted, #f8fafc)',
  boxHover: 'var(--v-uml-box-hover, #f1f5f9)',
  boxText: 'var(--v-uml-box-text, #0f172a)',
  boxTextMuted: 'var(--v-uml-box-text-muted, #64748b)',
  boxBorder: 'var(--v-uml-box-border, #cbd5e1)',
  fontSans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;
