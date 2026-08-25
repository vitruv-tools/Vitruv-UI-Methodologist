import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { apiService } from '../../services/api';
import { KeywordTagsInput } from './KeywordTagsInput';
import { MODAL_Z_INDEX, modalBackdropStyle, useModalBodyLock } from './modalUtils';

const FONT = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const DARK = '#0B1720';

interface EditMetaModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  metaModel: any;
}

export const EditMetaModelModal: React.FC<EditMetaModelModalProps> = ({
  isOpen, onClose, onSuccess, metaModel,
}) => {
  const [form, setForm] = useState({ name: '', description: '', domain: '', keywords: [] as string[] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen && metaModel) {
      setForm({ name: metaModel.name || '', description: metaModel.description || '', domain: metaModel.domain || '', keywords: metaModel.keyword || [] });
      setError(''); setSuccess('');
    }
  }, [isOpen, metaModel]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true); setError(''); setSuccess('');
    try {
      await apiService.updateMetaModel(String(metaModel.id), {
        name: form.name.trim(), description: form.description.trim(),
        domain: form.domain.trim(), keyword: form.keywords,
        ecoreFileId: metaModel.ecoreFileId || 0,
        genModelFileId: metaModel.genModelFileId || 0,
      });
      setSuccess('Saved successfully');
      setTimeout(() => { onSuccess?.(); onClose(); }, 900);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setIsLoading(false);
    }
  };

  useModalBodyLock(isOpen);

  if (!isOpen) return null;

  const disabled = isLoading || !form.name.trim() || !form.description.trim() || !form.domain.trim() || form.keywords.length === 0;

  return ReactDOM.createPortal(
    <>
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        style={{ ...modalBackdropStyle, zIndex: MODAL_Z_INDEX }}
      />
      <div
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: MODAL_Z_INDEX + 1, fontFamily: FONT,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'var(--v-surface)', borderRadius: 10, width: 480, maxWidth: '92vw',
          maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--v-card-shadow)',
          border: '1px solid var(--v-border)',
          pointerEvents: 'auto',
          color: 'var(--v-text)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--v-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--v-text)', letterSpacing: '-0.01em' }}>Edit Meta-Model</div>
            {metaModel?.name && (
              <div style={{ fontSize: 12, color: 'var(--v-text-muted)', marginTop: 1 }}>{metaModel.name}</div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--v-text-muted)', fontSize: 16, width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--v-chrome-hover)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--v-text)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--v-text-muted)'; }}
          >✕</button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
          <Field label="Name *">
            <input
              type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={inputSt}
              onFocus={e => (e.currentTarget.style.borderColor = '#049484')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--v-border)')}
              required
            />
          </Field>

          <Field label="Description *">
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              style={{ ...inputSt, resize: 'vertical', minHeight: 80 }}
              onFocus={e => (e.currentTarget.style.borderColor = '#049484')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--v-border)')}
              required
            />
          </Field>

          <Field label="Domain *">
            <input
              type="text" value={form.domain}
              onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
              style={inputSt}
              onFocus={e => (e.currentTarget.style.borderColor = '#049484')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--v-border)')}
              required
            />
          </Field>

          <Field label="Keywords *">
            <KeywordTagsInput keywords={form.keywords} onChange={kws => setForm(f => ({ ...f, keywords: kws }))} />
          </Field>

          {error   && <Msg type="error">{error}</Msg>}
          {success && <Msg type="success">{success}</Msg>}
        </form>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--v-border)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button
            type="button" onClick={onClose}
            style={{ flex: 1, padding: '9px 0', border: '1px solid var(--v-border)', borderRadius: 8, background: 'var(--v-surface)', color: 'var(--v-text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--v-surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--v-surface)')}
          >Cancel</button>
          <button
            type="submit"
            onClick={handleSubmit as any}
            disabled={disabled}
            style={{ flex: 1, padding: '9px 0', border: 'none', borderRadius: 8, background: disabled ? 'var(--v-disabled-bg)' : DARK, color: '#fff', fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: FONT, transition: 'background 0.15s' }}
            onMouseEnter={e => { if (!disabled) (e.currentTarget.style.background = '#1e293b'); }}
            onMouseLeave={e => { if (!disabled) (e.currentTarget.style.background = DARK); }}
          >{isLoading ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </div>
    </>,
    document.body
  );
};

// ── helpers ───────────────────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid var(--v-border)', borderRadius: 8,
  fontSize: 13, color: 'var(--v-text)', background: 'var(--v-input-bg)',
  boxSizing: 'border-box', outline: 'none',
  fontFamily: FONT, transition: 'border-color 0.15s',
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--v-text-secondary)', marginBottom: 5, letterSpacing: '0.01em', fontFamily: FONT }}>{label}</label>
    {children}
  </div>
);

const Msg: React.FC<{ type: 'error' | 'success'; children: React.ReactNode }> = ({ type, children }) => (
  <div style={{
    padding: '9px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, marginBottom: 12,
    background: type === 'error' ? 'var(--v-danger-bg)' : 'var(--v-success-bg)',
    border: `1px solid ${type === 'error' ? 'var(--v-danger-border)' : 'var(--v-success-border)'}`,
    color: type === 'error' ? 'var(--v-danger-text)' : 'var(--v-success-text)',
  }}>{children}</div>
);
