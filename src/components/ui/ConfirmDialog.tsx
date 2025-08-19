import React from 'react';
import ReactDOM from 'react-dom';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

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
        width: '360px',
        maxWidth: '90vw',
        padding: '20px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontSize: '16px',
          fontWeight: 700,
          marginBottom: '10px',
          color: '#222',
        }}>{title}</div>
        <div style={{
          fontSize: '14px',
          color: '#444',
          marginBottom: '18px',
        }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              background: '#f1f3f5',
              border: '1px solid #dee2e6',
              color: '#343a40',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e9ecef';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f1f3f5';
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: '#e03131',
              border: '1px solid #c92a2a',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#c92a2a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#e03131';
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


