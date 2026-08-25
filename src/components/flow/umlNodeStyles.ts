import React from 'react';

// jjodel-inspired color palette
const NAVY = 'var(--v-uml-edge, #0c436e)';
const TEAL = '#087E8B';
const MAROON = '#5F0F40';
const GOLD = '#d4a017';
const SEPARATOR = '#b8d0e2';

// Base node container
export const getBaseNodeStyle = (selected: boolean): React.CSSProperties => ({
  padding: '0px',
  background: '#ffffff',
  border: selected ? `2px solid ${TEAL}` : `1.5px solid ${NAVY}`,
  borderRadius: '3px',
  minWidth: '380px',
  boxShadow: selected
    ? `0 0 0 3px ${TEAL}33, 0 2px 8px rgba(12,67,110,0.18)`
    : '0 1px 4px rgba(12,67,110,0.10)',
  position: 'relative',
  fontFamily: `'Segoe UI', system-ui, -apple-system, sans-serif`,
  overflow: 'hidden',
});

// Header (title) area — white background, navy text, navy separator
export const headerBaseStyle: React.CSSProperties = {
  borderBottom: `2px solid ${NAVY}`,
  padding: '13px 18px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontWeight: 700,
  fontSize: '18px',
  color: NAVY,
  background: '#ffffff',
  flexWrap: 'nowrap' as const,
  letterSpacing: '0.1px',
};

// Italic variant for abstract / interface
export const italicHeaderStyle: React.CSSProperties = {
  ...headerBaseStyle,
  fontStyle: 'italic',
};

// Inline type-label prefix ("Abstract Class:", "Class:", etc.)
export const typeLabelStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  flexShrink: 0,
  letterSpacing: '0.2px',
  color: NAVY,
  opacity: 0.65,
};

// Per-element-type accent colors for the prefix label
export const typeAccentColors: Record<string, string> = {
  'class': TEAL,
  'abstract-class': '#9B2335',
  'interface': '#1a6ea6',
  'enumeration': GOLD,
  'package': MAROON,
};

// Section list container — attributes / methods
export const borderedSectionBodyStyle: React.CSSProperties = {
  borderBottom: `1px solid ${SEPARATOR}`,
  padding: '5px 0',
  fontSize: '16px',
  color: '#2d4a5e',
  background: '#ffffff',
};

export const sectionBodyStyle: React.CSSProperties = {
  padding: '5px 0',
  fontSize: '16px',
  color: '#2d4a5e',
  background: '#ffffff',
};

// Monospace list item for attributes / methods / enum values
export const listItemStyle: React.CSSProperties = {
  padding: '6px 18px',
  fontSize: '16px',
  fontFamily: `'Consolas', 'Courier New', monospace`,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  color: '#1e3a50',
  lineHeight: '1.4',
};

// Package header (maroon theme)
export const packageHeaderStyle: React.CSSProperties = {
  background: '#f9f4f7',
  borderBottom: `2px solid ${MAROON}`,
  padding: '12px 18px',
  textAlign: 'center',
  fontWeight: 'bold',
  fontSize: '18px',
  color: MAROON,
  minHeight: '44px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  letterSpacing: '0.2px',
};

export const packageContentStyle: React.CSSProperties = {
  padding: '8px 0',
  fontSize: '15px',
  color: '#666',
  minHeight: '50px',
};

export const packageContentTitleStyle: React.CSSProperties = {
  padding: '5px 10px',
  fontWeight: 'bold',
  color: MAROON,
  background: '#f9f4f7',
  fontSize: '14px',
};

export const packageHintStyle: React.CSSProperties = {
  padding: '3px 10px',
  fontStyle: 'italic',
  color: '#aaa',
  fontSize: '13px',
};

// Delete button
export const getDeleteButtonStyle = (options?: {
  background?: string;
  size?: number;
  boxShadow?: string;
}) => {
  const background = options?.background ?? '#ef4444';
  const size = options?.size ?? 20;
  const boxShadow = options?.boxShadow ?? '0 2px 8px rgba(239,68,68,0.3)';
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
    transition: 'all 0.15s ease',
  };
  return style;
};

// Connection handles — invisible by default, shown via CSS on hover
// (the actual visibility is controlled by global.css .react-flow__handle rules)
const handleBase: React.CSSProperties = {
  background: NAVY,
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  border: '1.5px solid #ffffff',
  opacity: 0,
};

export const handleStyles = {
  leftTarget: {
    ...handleBase,
    top: '50%',
    left: 0,
    transform: 'translateY(-50%)',
  } as React.CSSProperties,
  leftSource: {
    ...handleBase,
    top: '50%',
    left: 0,
    transform: 'translateY(-50%)',
  } as React.CSSProperties,
  topTarget: {
    ...handleBase,
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
  } as React.CSSProperties,
  topSource: {
    ...handleBase,
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
  } as React.CSSProperties,
  rightSource: {
    ...handleBase,
    top: '50%',
    right: 0,
    transform: 'translateY(-50%)',
  } as React.CSSProperties,
  rightTarget: {
    ...handleBase,
    top: '50%',
    right: 0,
    transform: 'translateY(-50%)',
  } as React.CSSProperties,
  bottomSource: {
    ...handleBase,
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
  } as React.CSSProperties,
  bottomTarget: {
    ...handleBase,
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
  } as React.CSSProperties,
};
