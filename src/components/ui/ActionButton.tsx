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
    background: 'var(--v-surface)',
    color: 'var(--v-text-secondary)',
    border: '1.5px solid var(--v-border)',
    boxShadow: 'none',
  },
  danger: {
    background: DANGER_COLOR,
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.2)',
  },
  dangerOutline: {
    background: 'var(--v-surface)',
    color: DANGER_COLOR,
    border: `1.5px solid ${DANGER_COLOR}`,
    boxShadow: 'none',
  },
  ghost: {
    background: 'var(--v-surface)',
    color: 'var(--v-text-secondary)',
    border: '1.5px solid var(--v-border)',
    boxShadow: 'none',
  },
};

const VARIANT_HOVER: Record<ActionButtonVariant, React.CSSProperties> = {
  primary: { background: BRAND_COLOR_HOVER, boxShadow: '0 4px 12px rgba(4, 148, 132, 0.3)' },
  secondary: { background: 'var(--v-surface-hover)', borderColor: 'var(--v-text-muted)' },
  danger: { background: DANGER_COLOR_HOVER, boxShadow: '0 4px 12px rgba(220, 38, 38, 0.28)' },
  dangerOutline: { background: 'var(--v-danger-bg)', borderColor: DANGER_COLOR_HOVER },
  ghost: { background: 'var(--v-surface-hover)', borderColor: 'var(--v-text-muted)', color: 'var(--v-text)' },
};

const VARIANT_DISABLED: Record<ActionButtonVariant, React.CSSProperties> = {
  primary: { background: 'var(--v-disabled-bg)', boxShadow: 'none', cursor: 'not-allowed' },
  secondary: { background: 'var(--v-surface-muted)', color: 'var(--v-disabled-text)', borderColor: 'var(--v-border)', cursor: 'not-allowed' },
  danger: { background: 'var(--v-danger-bg)', color: 'var(--v-danger-text)', boxShadow: 'none', cursor: 'not-allowed' },
  dangerOutline: { background: 'var(--v-surface-muted)', color: 'var(--v-disabled-text)', borderColor: 'var(--v-border)', cursor: 'not-allowed' },
  ghost: { background: 'var(--v-surface-muted)', color: 'var(--v-disabled-text)', borderColor: 'var(--v-border)', cursor: 'not-allowed' },
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

  let variantStateStyles: React.CSSProperties = {};
  if (disabled) {
    variantStateStyles = VARIANT_DISABLED[variant];
  } else if (hovered) {
    variantStateStyles = VARIANT_HOVER[variant];
  }

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
    ...variantStateStyles,
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
