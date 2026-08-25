import React from 'react';
import ReactDOM from 'react-dom';
import { MODAL_Z_INDEX, modalBackdropStyle, useModalBodyLock } from './modalUtils';

const FONT = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message?: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  singleAction?: boolean;
  variant?: 'danger' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
}

const DangerIcon: React.FC = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const SuccessIcon: React.FC = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  singleAction = false,
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  useModalBodyLock(isOpen);

  if (!isOpen) return null;

  const themes = {
    danger: {
      accentColor: '#dc2626',
      iconBg: '#fef2f2',
      buttonBg: '#dc2626',
      buttonHoverBg: '#b91c1c',
      buttonShadow: 'rgba(220,38,38,0.25)',
      buttonHoverShadow: 'rgba(220,38,38,0.38)',
    },
    success: {
      accentColor: '#059669',
      iconBg: '#f0fdf4',
      buttonBg: '#059669',
      buttonHoverBg: '#047857',
      buttonShadow: 'rgba(5,150,105,0.25)',
      buttonHoverShadow: 'rgba(5,150,105,0.38)',
    },
  };

  const theme = themes[variant];

  const dialog = (
    <>
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onCancel}
        style={{ ...modalBackdropStyle, zIndex: MODAL_Z_INDEX }}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: MODAL_Z_INDEX + 1,
          pointerEvents: 'none',
        }}
      >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        style={{
          pointerEvents: 'auto',
          background: 'var(--v-surface)',
          borderRadius: '14px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.08)',
          width: '420px',
          maxWidth: '92vw',
          overflow: 'hidden',
          boxSizing: 'border-box',
          borderTop: `4px solid ${theme.accentColor}`,
          animation: 'confirmDialogIn 0.18s ease',
        }}
      >
        <style>{`
          @keyframes confirmDialogIn {
            from { opacity: 0; transform: scale(0.96) translateY(6px); }
            to   { opacity: 1; transform: scale(1)    translateY(0);   }
          }
        `}</style>

        {/* ── Content ── */}
        <div
          style={{
            padding: '32px 32px 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            fontFamily: FONT,
          }}
        >
          {/* Icon circle */}
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: theme.iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {variant === 'danger' ? <DangerIcon /> : <SuccessIcon />}
          </div>

          {/* Title */}
          <div
            id="confirm-title"
            style={{
              fontSize: '19px',
              fontWeight: 700,
              color: 'var(--v-text)',
              textAlign: 'center',
              lineHeight: 1.3,
              fontFamily: FONT,
            }}
          >
            {title}
          </div>

          {/* Message */}
          <div
            id="confirm-message"
            style={{
              fontSize: '14px',
              color: 'var(--v-text-muted)',
              textAlign: 'center',
              lineHeight: '1.65',
              fontFamily: FONT,
              maxWidth: '320px',
            }}
          >
            {message}
          </div>
        </div>

        {/* ── Buttons ── */}
        <div
          style={{
            padding: '24px 32px 28px',
            display: 'flex',
            gap: '10px',
            justifyContent: singleAction ? 'center' : 'stretch',
          }}
        >
          {!singleAction && (
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '11px 16px',
                background: 'var(--v-surface)',
                border: '1.5px solid var(--v-border)',
                borderRadius: '8px',
                color: 'var(--v-text-secondary)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: FONT,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--v-surface-hover)';
                e.currentTarget.style.borderColor = 'var(--v-text-faint)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--v-surface)';
                e.currentTarget.style.borderColor = 'var(--v-border)';
              }}
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            style={{
              flex: singleAction ? undefined : 1,
              padding: '11px 16px',
              background: theme.buttonBg,
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: FONT,
              transition: 'all 0.15s ease',
              boxShadow: `0 4px 14px ${theme.buttonShadow}`,
              ...(singleAction ? { paddingLeft: '36px', paddingRight: '36px' } : {}),
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.buttonHoverBg;
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = `0 6px 18px ${theme.buttonHoverShadow}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.buttonBg;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = `0 4px 14px ${theme.buttonShadow}`;
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
      </div>
    </>
  );

  return ReactDOM.createPortal(dialog, document.body);
};
