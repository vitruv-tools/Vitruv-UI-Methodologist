import React from 'react';

// Base node container style generator
export const getBaseNodeStyle = (selected: boolean): React.CSSProperties => ({
  padding: '0px',
  background: '#ffffff',
  border: selected ? '2px solid #2563eb' : '1px solid #9ca3af',
  borderRadius: '4px',
  minWidth: '180px',
  boxShadow: selected ? '0 4px 12px rgba(37, 99, 235, 0.25)' : '0 2px 8px rgba(0,0,0,0.08)',
  position: 'relative',
  fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif`,
  overflow: 'hidden',
});

// Header (title) area styles
export const headerBaseStyle: React.CSSProperties = {
  borderBottom: '1px solid #d1d5db',
  padding: '8px 12px',
  textAlign: 'center',
  fontWeight: 600,
  fontSize: '13px',
  color: '#1f2937',
  background: '#f9fafb',
};

export const italicHeaderStyle: React.CSSProperties = {
  ...headerBaseStyle,
  fontStyle: 'italic',
};

// Section list container styles
export const borderedSectionBodyStyle: React.CSSProperties = {
  borderBottom: '1px solid #d1d5db',
  padding: '4px 0',
  fontSize: '11px',
  color: '#374151',
  background: '#ffffff',
};

export const sectionBodyStyle: React.CSSProperties = {
  padding: '4px 0',
  fontSize: '11px',
  color: '#374151',
  background: '#ffffff',
};

// Monospace list item used for attributes/methods/values
export const listItemStyle: React.CSSProperties = {
  padding: '2px 12px',
  fontSize: '11px',
  fontFamily: 'monospace',
  display: 'flex',
  alignItems: 'center',
};

// Package header style
export const packageHeaderStyle: React.CSSProperties = {
  background: '#fdf8f0',
  borderBottom: '1px solid #f39c12',
  borderRight: '1px solid #f39c12',
  padding: '8px 0',
  textAlign: 'center',
  fontWeight: 'bold',
  fontSize: '14px',
  color: '#f39c12',
  minHeight: '30px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
};

// Package content wrapper
export const packageContentStyle: React.CSSProperties = {
  padding: '8px 0',
  fontSize: '12px',
  color: '#666',
  minHeight: '50px',
};

export const packageContentTitleStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontWeight: 'bold',
  color: '#f39c12',
  background: '#fdf8f0',
};

export const packageHintStyle: React.CSSProperties = {
  padding: '2px 8px',
  fontStyle: 'italic',
  color: '#999',
};

// Delete button base style generator
export const getDeleteButtonStyle = (options?: {
  background?: string;
  size?: number;
  boxShadow?: string;
}) => {
  const background = options?.background ?? '#ef4444';
  const size = options?.size ?? 22;
  const boxShadow = options?.boxShadow ?? '0 4px 12px rgba(239,68,68,0.3)';
  const style: React.CSSProperties = {
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    background,
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: `${size}px`,
    height: `${size}px`,
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    boxShadow,
    transition: 'all 0.2s ease',
  };
  return style;
};

// Handle circle base and variants
const handleCircleBase: React.CSSProperties = {
  background: '#6b7280',
  width: '10px',
  height: '10px',
  borderRadius: '50%',
  border: '2px solid #ffffff',
};

const handleCircleRaised: React.CSSProperties = {
  ...handleCircleBase,
  boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.08)',
};

export const handleStyles = {
  leftTarget: {
    ...handleCircleBase,
    top: '50%',
    left: 0,
    transform: 'translateY(-50%)',
  } as React.CSSProperties,
  leftSource: {
    ...handleCircleRaised,
    top: '50%',
    left: 0,
    transform: 'translateY(-50%)',
  } as React.CSSProperties,
  topTarget: {
    ...handleCircleBase,
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
  } as React.CSSProperties,
  topSource: {
    ...handleCircleRaised,
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
  } as React.CSSProperties,
  rightSource: {
    ...handleCircleBase,
    top: '50%',
    right: 0,
    transform: 'translateY(-50%)',
  } as React.CSSProperties,
  rightTarget: {
    ...handleCircleRaised,
    top: '50%',
    right: 0,
    transform: 'translateY(-50%)',
  } as React.CSSProperties,
  bottomSource: {
    ...handleCircleBase,
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
  } as React.CSSProperties,
  bottomTarget: {
    ...handleCircleRaised,
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
  } as React.CSSProperties,
};


