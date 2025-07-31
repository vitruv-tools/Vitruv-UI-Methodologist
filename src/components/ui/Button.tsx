import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  className?: string;
}

export function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'medium', 
  disabled = false,
  className = ''
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    padding: size === 'small' ? '6px 12px' : size === 'large' ? '12px 24px' : '8px 20px',
    fontSize: size === 'small' ? 14 : size === 'large' ? 18 : 16,
    borderRadius: 6,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 500,
    transition: 'all 0.2s ease',
    opacity: disabled ? 0.6 : 1,
  };

  const variantStyles = {
    primary: {
      background: '#0091ea',
      color: '#fff',
    },
    secondary: {
      background: '#6c757d',
      color: '#fff',
    },
    success: {
      background: '#28a745',
      color: '#fff',
    },
    danger: {
      background: '#dc3545',
      color: '#fff',
    },
  };

  const style = { ...baseStyle, ...variantStyles[variant] };

  return (
    <button
      style={style}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  );
} 