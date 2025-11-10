import React from 'react';

// Shared, reusable UI style objects to reduce duplication across components

export const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
};

export const formGroupStyle: React.CSSProperties = { marginBottom: '20px' };

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: 600,
  color: '#2c3e50',
  marginBottom: '8px',
  fontFamily: 'Georgia, serif',
};

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '2px solid #d1ecf1',
  borderRadius: '6px',
  fontSize: '14px',
  boxSizing: 'border-box',
  transition: 'all 0.3s ease',
  background: '#f8f9fa',
  fontFamily: 'Georgia, serif',
};

export const errorMessageStyle: React.CSSProperties = {
  padding: '8px 12px',
  margin: '8px 0',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: '500',
  backgroundColor: '#f8d7da',
  color: '#721c24',
  border: '1px solid #f5c6cb',
};

export const successMessageStyle: React.CSSProperties = {
  padding: '8px 12px',
  margin: '8px 0',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: '500',
  backgroundColor: '#d4edda',
  color: '#155724',
  border: '1px solid #c3e6cb',
};

export const fileInputStyle: React.CSSProperties = { display: 'none' };

export const progressBarContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '6px',
  backgroundColor: '#e0e0e0',
  borderRadius: '3px',
  overflow: 'hidden',
};

export const progressBarStyle: React.CSSProperties = {
  height: '100%',
  backgroundColor: '#3498db',
  borderRadius: '3px',
  transition: 'width 0.3s ease',
  width: '0%',
};


