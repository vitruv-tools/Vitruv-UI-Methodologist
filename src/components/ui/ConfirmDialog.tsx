import React from 'react';
import ReactDOM from 'react-dom';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message?: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const colors = {
    danger: {
      titleColor: '#dc2626',
      icon: '⚠️',
      buttonBg: '#dc2626',
      buttonHoverBg: '#b91c1c',
      buttonShadow: 'rgba(220, 38, 38, 0.3)',
      buttonHoverShadow: 'rgba(220, 38, 38, 0.4)',
    },
    success: {
      titleColor: '#059669',
      icon: '✓',
      buttonBg: '#10b981',
      buttonHoverBg: '#059669',
      buttonShadow: 'rgba(16, 185, 129, 0.3)',
      buttonHoverShadow: 'rgba(16, 185, 129, 0.4)',
    },
  };

  const theme = colors[variant];

  const dialog = (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '10px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        width: '480px',
        maxWidth: '90vw',
        padding: '24px',
        boxSizing: 'border-box',
        fontFamily: 'Georgia, serif',
      }}>
        <div style={{
          fontSize: '18px',
          fontWeight: 700,
          marginBottom: '16px',
          color: theme.titleColor,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{ fontSize: '22px' }}>{theme.icon}</span>
          {title}
        </div>
        <div style={{
          fontSize: '14px',
          color: '#374151',
          marginBottom: '20px',
          lineHeight: '1.6',
        }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onCancel}
            style={{
              background: '#fff',
              border: '2px solid #dee2e6',
              color: '#495057',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'Georgia, serif',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8f9fa';
              e.currentTarget.style.borderColor = '#adb5bd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.borderColor = '#dee2e6';
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: theme.buttonBg,
              border: 'none',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'Georgia, serif',
              transition: 'all 0.2s ease',
              boxShadow: `0 4px 12px ${theme.buttonShadow}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.buttonHoverBg;
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = `0 6px 16px ${theme.buttonHoverShadow}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.buttonBg;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = `0 4px 12px ${theme.buttonShadow}`;
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(dialog, document.body);
};


