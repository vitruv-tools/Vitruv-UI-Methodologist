import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { apiService } from '../../services/api';
import { useToast } from './ToastProvider';
import { useModalBodyLock } from './modalUtils';

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
        border: '1.5px solid rgba(0,0,0,0.10)',
        borderRadius: 9,
        background: hov ? '#f1f5f9' : '#ffffff',
        color: '#374151',
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
        background: disabled ? '#9ca3af' : hov ? '#038472' : '#049484',
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
    border: '1.5px solid rgba(0,0,0,0.10)',
    borderRadius: 9,
    fontSize: 14,
    color: '#111827',
    fontFamily: FONT,
    background: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  return ReactDOM.createPortal(
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.25)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(480px, 94vw)',
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.07)',
          overflow: 'hidden',
          fontFamily: FONT,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 18px',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
              New Project
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
              Create a new V-SUM workspace
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 30, height: 30, borderRadius: 6,
              background: 'transparent',
              border: '1.5px solid rgba(0,0,0,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 13, color: '#64748b',
              transition: 'all 0.12s', fontFamily: FONT,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
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
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              fontSize: 13, color: '#dc2626',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="vsum-name-input" style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              id="vsum-name-input"
              placeholder="e.g. My V-SUM"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !loading && name.trim()) handleSubmit(); }}
              onFocus={e => { e.currentTarget.style.borderColor = '#049484'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(4,148,132,0.12)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.10)'; e.currentTarget.style.boxShadow = 'none'; }}
              style={inputBase}
              disabled={loading}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="vsum-description-input" style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Description <span style={{ color: '#9ca3af', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <textarea
              id="vsum-description-input"
              placeholder="Short description of this project…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = '#049484'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(4,148,132,0.12)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.10)'; e.currentTarget.style.boxShadow = 'none'; }}
              style={{ ...inputBase, minHeight: 80, resize: 'vertical' }}
              disabled={loading}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '14px 24px 20px',
          borderTop: '1px solid rgba(0,0,0,0.07)',
        }}>
          <CancelButton onClick={handleClose} disabled={loading} />
          <SubmitButton onClick={handleSubmit} disabled={loading || !name.trim()} loading={loading} />
        </div>
      </div>
    </div>,
    document.body
  );
};
