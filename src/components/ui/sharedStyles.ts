import React from 'react';

// Shared, reusable UI style objects to reduce duplication across components

export const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
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


