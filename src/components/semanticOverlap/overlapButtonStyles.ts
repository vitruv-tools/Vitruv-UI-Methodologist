import type React from 'react';
import { themeVars } from '../../theme/theme';

/** Main action of the semantic overlap views (start, retry). */
export const primaryButton: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 9, border: 'none', background: '#0B1720', color: '#ffffff',
  fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 4px rgba(11,23,32,0.25)', height: 40,
};

/** Secondary actions (exports). */
export const secondaryButton: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${themeVars.border}`, background: themeVars.surface,
  color: themeVars.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', height: 40,
};
