import React, { useState } from 'react';
import { APP_FONT, BRAND_COLOR, BRAND_COLOR_HOVER, DANGER_COLOR, DANGER_COLOR_HOVER } from './sharedStyles';

export type ActionButtonVariant = 'primary' | 'secondary' | 'danger' | 'dangerOutline' | 'ghost';
export type ActionButtonSize = 'sm' | 'md';

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  children: React.ReactNode;
}

const SIZE_STYLES: Record<ActionButtonSize, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: '13px', borderRadius: '8px' },
  md: { padding: '10px 18px', fontSize: '14px', borderRadius: '8px' },
};

const VARIANT_BASE: Record<ActionButtonVariant, React.CSSProperties> = {
  primary: {
    background: BRAND_COLOR,
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 2px 8px rgba(4, 148, 132, 0.22)',
  },
  secondary: {
    background: '#ffffff',
    color: '#374151',
    border: '1.5px solid #e2e8f0',
    boxShadow: 'none',
  },
  danger: {
    background: DANGER_COLOR,
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.2)',
  },
  dangerOutline: {
    background: '#ffffff',
    color: DANGER_COLOR,
    border: `1.5px solid ${DANGER_COLOR}`,
    boxShadow: 'none',
  },
  ghost: {
    background: '#ffffff',
    color: '#475569',
    border: '1.5px solid #e2e8f0',
    boxShadow: 'none',
  },
};

const VARIANT_HOVER: Record<ActionButtonVariant, React.CSSProperties> = {
  primary: { background: BRAND_COLOR_HOVER, boxShadow: '0 4px 12px rgba(4, 148, 132, 0.3)' },
  secondary: { background: '#f8fafc', borderColor: '#cbd5e1' },
  danger: { background: DANGER_COLOR_HOVER, boxShadow: '0 4px 12px rgba(220, 38, 38, 0.28)' },
  dangerOutline: { background: '#fef2f2', borderColor: DANGER_COLOR_HOVER },
  ghost: { background: '#f8fafc', borderColor: '#cbd5e1', color: '#334155' },
};

const VARIANT_DISABLED: Record<ActionButtonVariant, React.CSSProperties> = {
  primary: { background: '#94a3b8', boxShadow: 'none', cursor: 'not-allowed' },
  secondary: { background: '#f1f5f9', color: '#94a3b8', borderColor: '#e2e8f0', cursor: 'not-allowed' },
  danger: { background: '#fca5a5', boxShadow: 'none', cursor: 'not-allowed' },
  dangerOutline: { background: '#f8fafc', color: '#94a3b8', borderColor: '#e2e8f0', cursor: 'not-allowed' },
  ghost: { background: '#f8fafc', color: '#94a3b8', borderColor: '#e2e8f0', cursor: 'not-allowed' },
};

export const ActionButton: React.FC<ActionButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  disabled = false,
  style,
  children,
  onMouseEnter,
  onMouseLeave,
  ...rest
}) => {
  const [hovered, setHovered] = useState(false);

  const base: React.CSSProperties = {
    ...SIZE_STYLES[size],
    ...VARIANT_BASE[variant],
    fontFamily: APP_FONT,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    ...(disabled ? VARIANT_DISABLED[variant] : hovered ? VARIANT_HOVER[variant] : {}),
    ...style,
  };

  return (
    <button
      type="button"
      disabled={disabled}
      style={base}
      onMouseEnter={(e) => {
        if (!disabled) setHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        onMouseLeave?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
};
