import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import {
  modalOverlayStyle,
  formGroupStyle,
  labelStyle,
  inputStyle,
  errorMessageStyle,
  successMessageStyle,
} from './sharedStyles';

export interface MetaModel {
  id: string | number;
  name: string;
  description?: string;
  domain?: string;
  keyword?: string[];
}

interface EditMetaModelModalProps {
  isOpen: boolean;
  model: MetaModel | null;
  onClose: () => void;
  onSuccess?: (model: MetaModel) => void;
}

const modalStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 0,
  padding: '24px',
  width: '480px',
  maxWidth: '90vw',
  maxHeight: '85vh',
  overflow: 'auto',
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
  // Consistent dark edge so the modal stands out on white background
  border: '1px solid #111827',
  fontFamily: 'Georgia, serif',
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
  paddingBottom: '12px',
  borderBottom: '2px solid #3498db',
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: '#2c3e50',
  margin: 0,
};

const closeButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  fontSize: 24,
  color: '#999',
  cursor: 'pointer',
  padding: '4px',
  borderRadius: 0,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 6,
  border: 'none',
  background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  fontFamily: 'Georgia, serif',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  background: '#ffffff',
  color: '#374151',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  fontFamily: 'Georgia, serif',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 20,
};

export const EditMetaModelModal: React.FC<EditMetaModelModalProps> = ({
  isOpen,
  model,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen && model) {
      setName(model.name || '');
      setDescription(model.description || '');
      setDomain(model.domain || '');
      setKeywords(Array.isArray(model.keyword) ? model.keyword : []);
      setError('');
      setSuccess('');
      setIsSaving(false);
    }
  }, [isOpen, model]);

  if (!isOpen || !model) return null;

  const canSave =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    domain.trim().length > 0 &&
    keywords.length > 0 &&
    !isSaving;

  const handleSave = async () => {
    if (!canSave) return;

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        domain: domain.trim(),
        keyword: keywords,
      };
      const response = await apiService.updateMetaModel(String(model.id), payload);
      setSuccess('Meta Model updated successfully.');
      onSuccess?.(response.data);
      setTimeout(() => {
        onClose();
      }, 200);
    } catch (e: any) {
      setError(e?.message || 'Failed to update meta model.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      open
      style={modalOverlayStyle}
      onClose={onClose}
      onCancel={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={modalStyle}>
        <div style={modalHeaderStyle}>
          <h2 style={modalTitleStyle}>Edit Meta Model</h2>
          <button style={closeButtonStyle} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {error && <div style={errorMessageStyle}>{error}</div>}
        {success && <div style={successMessageStyle}>{success}</div>}

        <div style={formGroupStyle}>
          <label htmlFor="edit-mm-name" style={labelStyle}>
            Name *
          </label>
          <input
            id="edit-mm-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="edit-mm-description" style={labelStyle}>
            Description *
          </label>
          <textarea
            id="edit-mm-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="edit-mm-domain" style={labelStyle}>
            Domain *
          </label>
          <input
            id="edit-mm-domain"
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="edit-mm-keywords" style={labelStyle}>Keywords *</label>
          <input
            id="edit-mm-keywords"
            type="text"
            placeholder="Comma separated keywords"
            value={keywords.join(', ')}
            onChange={(e) =>
              setKeywords(
                e.target.value
                  .split(',')
                  .map((k) => k.trim())
                  .filter((k) => k.length > 0),
              )
            }
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>
            Keywords are stored as a list; separate them with commas.
          </div>
        </div>

        <div style={footerStyle}>
          <button style={secondaryButtonStyle} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            style={{
              ...primaryButtonStyle,
              opacity: canSave ? 1 : 0.6,
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
            onClick={handleSave}
            disabled={!canSave}
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </dialog>
  );
};


