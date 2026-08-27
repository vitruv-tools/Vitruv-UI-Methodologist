import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { apiService } from '../../services/api';
import { useToast } from './ToastProvider';
import { useModalBodyLock, modalBackdropStyle, modalDialogShellStyle } from './modalUtils';

interface CreateVsumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (vsum: any) => void;
}

const FONT = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

// ── small sub-components to keep hover state local ────────────────────────────

const CancelButton: React.FC<{ onClick: () => void; disabled: boolean }> = ({ onClick, disabled }) => {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '9px 18px',
        border: '1.5px solid var(--v-border)',
        borderRadius: 9,
        background: hov ? 'var(--v-surface-hover)' : 'var(--v-surface)',
        color: 'var(--v-text-secondary)',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: FONT,
        transition: 'background 0.15s',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      Cancel
    </button>
  );
};

const SubmitButton: React.FC<{ onClick: () => void; disabled: boolean; loading: boolean }> = ({ onClick, disabled, loading }) => {
  const [hov, setHov] = React.useState(false);
  let background = '#049484';
  if (disabled) {
    background = '#9ca3af';
  } else if (hov) {
    background = '#038472';
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '9px 22px',
        border: 'none',
        borderRadius: 9,
        background,
        color: '#ffffff',
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: FONT,
        transition: 'background 0.15s',
      }}
    >
      {loading ? 'Creating…' : 'Create project'}
    </button>
  );
};

// ── CreateVsumModal ───────────────────────────────────────────────────────────

export const CreateVsumModal: React.FC<CreateVsumModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showSuccess, showError } = useToast();

  useModalBodyLock(isOpen);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) { setError('Project name is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await apiService.createVsum({ name: trimmedName, description: description.trim() || undefined });
      onSuccess?.(res.data);
      showSuccess('Project created successfully.');
      setName('');
      setDescription('');
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create project.';
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError('');
    setName('');
    setDescription('');
    onClose();
  };

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid var(--v-border)',
    borderRadius: 9,
    fontSize: 14,
    color: 'var(--v-text)',
    fontFamily: FONT,
    background: 'var(--v-input-bg)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  return ReactDOM.createPortal(
    <dialog
      open
      aria-labelledby="create-vsum-title"
      onCancel={e => {
        if (loading) {
          e.preventDefault();
          return;
        }
        handleClose();
      }}
      style={{
        ...modalDialogShellStyle,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={handleClose}
        style={{
          ...modalBackdropStyle,
          position: 'absolute',
          backgroundColor: 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          cursor: loading ? 'default' : 'pointer',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: 'min(480px, 94vw)',
          background: 'var(--v-surface)',
          borderRadius: 14,
          boxShadow: 'var(--v-card-shadow)',
          overflow: 'hidden',
          fontFamily: FONT,
          color: 'var(--v-text)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 18px',
          borderBottom: '1px solid var(--v-border)',
        }}>
          <div>
            <h2 id="create-vsum-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--v-text)', letterSpacing: '-0.01em' }}>
              New Project
            </h2>
            <div style={{ fontSize: 13, color: 'var(--v-text-muted)', marginTop: 2 }}>
              Create a new V-SUM workspace
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            style={{
              width: 30, height: 30, borderRadius: 6,
              background: 'transparent',
              border: '1.5px solid var(--v-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 13, color: 'var(--v-text-muted)',
              transition: 'all 0.12s', fontFamily: FONT,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--v-surface-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 9,
              background: 'var(--v-danger-bg)', border: '1px solid var(--v-danger-border)',
              fontSize: 13, color: 'var(--v-danger-text)',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="vsum-name-input" style={{ fontSize: 11, fontWeight: 700, color: 'var(--v-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              id="vsum-name-input"
              placeholder="e.g. My V-SUM"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !loading && name.trim()) handleSubmit(); }}
              onFocus={e => { e.currentTarget.style.borderColor = '#049484'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(4,148,132,0.12)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--v-border)'; e.currentTarget.style.boxShadow = 'none'; }}
              style={inputBase}
              disabled={loading}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="vsum-description-input" style={{ fontSize: 11, fontWeight: 700, color: 'var(--v-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Description <span style={{ color: 'var(--v-text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <textarea
              id="vsum-description-input"
              placeholder="Short description of this project…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = '#049484'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(4,148,132,0.12)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--v-border)'; e.currentTarget.style.boxShadow = 'none'; }}
              style={{ ...inputBase, minHeight: 80, resize: 'vertical' }}
              disabled={loading}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '14px 24px 20px',
          borderTop: '1px solid var(--v-border)',
        }}>
          <CancelButton onClick={handleClose} disabled={loading} />
          <SubmitButton onClick={handleSubmit} disabled={loading || !name.trim()} loading={loading} />
        </div>
      </div>
    </dialog>,
    document.body
  );
};
