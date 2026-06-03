import React from 'react';

// Shared, reusable UI style objects to reduce duplication across components

import { modalBackdropStyle, modalDialogShellStyle } from './modalUtils';

/** Application-wide typography */
export const APP_FONT =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

/** Brand teal used for primary actions */
export const BRAND_COLOR = '#049484';
export const BRAND_COLOR_HOVER = '#037368';

/** Destructive actions */
export const DANGER_COLOR = '#dc2626';
export const DANGER_COLOR_HOVER = '#b91c1c';

/** Large modal panel (code editor, UML viewer, etc.) */
export const largeModalPanelStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  width: '90%',
  maxWidth: '1200px',
  height: '85vh',
  maxHeight: '900px',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 24px 64px rgba(0, 0, 0, 0.22), 0 4px 16px rgba(0, 0, 0, 0.08)',
  border: '1px solid #e2e8f0',
  overflow: 'hidden',
  position: 'relative',
  zIndex: 1,
  fontFamily: APP_FONT,
};

export const modalPanelHeaderStyle: React.CSSProperties = {
  padding: '14px 20px',
  borderBottom: '1px solid #f1f5f9',
  background: '#fafafa',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
};

export const modalPanelToolbarStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderBottom: '1px solid #f1f5f9',
  background: '#ffffff',
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  alignItems: 'center',
  flexShrink: 0,
};

export const modalPanelFooterStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderTop: '1px solid #f1f5f9',
  background: '#f8fafc',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexShrink: 0,
};

export const modalCloseButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: '#94a3b8',
  fontSize: '18px',
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
  lineHeight: 1,
  padding: 0,
};

export { MODAL_Z_INDEX } from './modalUtils';

export const modalOverlayStyle: React.CSSProperties = {
  ...modalDialogShellStyle,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/** Backdrop layer used inside transparent <dialog> shells. */
export const modalBackdropButtonStyle: React.CSSProperties = {
  ...modalBackdropStyle,
  position: 'absolute',
};

export const formGroupStyle: React.CSSProperties = { marginBottom: '20px' };

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '6px',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  letterSpacing: '0.01em',
};

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '14px',
  boxSizing: 'border-box',
  transition: 'all 0.2s ease',
  background: '#f8fafc',
  color: '#0f172a',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
};

export const errorMessageStyle: React.CSSProperties = {
  padding: '10px 14px',
  margin: '8px 0',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: '500',
  backgroundColor: '#f8d7da',
  color: '#721c24',
  border: '1px solid #f5c6cb',
};

export const successMessageStyle: React.CSSProperties = {
  padding: '10px 14px',
  margin: '8px 0',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: '500',
  backgroundColor: '#d4edda',
  color: '#155724',
  border: '1px solid #c3e6cb',
};

export const fileInputStyle: React.CSSProperties = { display: 'none' };

export const progressBarContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '8px',
  backgroundColor: '#e0e0e0',
  borderRadius: '4px',
  overflow: 'hidden',
};

export const progressBarStyle: React.CSSProperties = {
  height: '100%',
  backgroundColor: '#049484',
  borderRadius: '4px',
  transition: 'width 0.3s ease',
  width: '0%',
};


