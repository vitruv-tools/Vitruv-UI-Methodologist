import React from 'react';
import ReactDOM from 'react-dom';
import { MODAL_Z_INDEX, modalBackdropStyle, useModalBodyLock } from '../ui/modalUtils';

interface UnsavedTabCloseDialogProps {
  isOpen: boolean;
  projectName?: string;
  saving?: boolean;
  onSave: () => void;
  onCloseWithoutSaving: () => void;
  onCancel: () => void;
}

export const UnsavedTabCloseDialog: React.FC<UnsavedTabCloseDialogProps> = ({
  isOpen,
  projectName,
  saving = false,
  onSave,
  onCloseWithoutSaving,
  onCancel,
}) => {
  useModalBodyLock(isOpen);
  if (!isOpen) return null;

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
          style={{
            pointerEvents: 'auto',
            background: 'var(--v-surface)',
            borderRadius: 12,
            boxShadow: 'var(--v-card-shadow)',
            width: 400,
            maxWidth: '92vw',
            padding: '24px',
            borderTop: '4px solid #f59e0b',
            color: 'var(--v-text)',
          }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--v-text)' }}>
            Unsaved changes
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--v-text-muted)', lineHeight: 1.55 }}>
            {projectName
              ? `"${projectName}" has unsaved changes. Save before closing, or close without saving.`
              : 'This project has unsaved changes. Save before closing, or close without saving.'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                background: '#049484',
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onCloseWithoutSaving}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--v-danger-border)',
                background: 'var(--v-surface)',
                color: 'var(--v-danger-text)',
                fontWeight: 600,
                fontSize: 14,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              Close without saving
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onCancel}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--v-border)',
                background: 'var(--v-surface)',
                color: 'var(--v-text-secondary)',
                fontWeight: 600,
                fontSize: 14,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return ReactDOM.createPortal(dialog, document.body);
};
