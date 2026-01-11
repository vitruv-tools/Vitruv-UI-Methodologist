import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { apiService } from '../../services/api';
import { KeywordTagsInput } from './KeywordTagsInput';
import {
  modalOverlayStyle,
  formGroupStyle,
  labelStyle,
  inputStyle,
  errorMessageStyle,
  successMessageStyle,
} from './sharedStyles';

interface EditMetaModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  metaModel: any;
  isOwner: boolean;
}

const modalStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '0',
  padding: '28px',
  width: '480px',
  maxWidth: '90vw',
  maxHeight: '85vh',
  overflow: 'auto',
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
  border: '1px solid #d1ecf1',
  fontFamily: 'Georgia, serif',
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '20px',
  paddingBottom: '16px',
  borderBottom: '2px solid #3498db',
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  color: '#2c3e50',
  margin: 0,
  fontFamily: 'Georgia, serif',
};

const closeButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  fontSize: '28px',
  color: '#999',
  cursor: 'pointer',
  padding: '8px',
  borderRadius: '0',
  transition: 'all 0.2s ease',
  width: '40px',
  height: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const inputFocusStyle: React.CSSProperties = {
  borderColor: '#3498db',
  outline: 'none',
  boxShadow: '0 0 0 3px rgba(52, 152, 219, 0.1)',
  background: '#ffffff',
};

const buttonStyle: React.CSSProperties = {
  padding: '12px 24px',
  borderRadius: '6px',
  border: 'none',
  background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  fontFamily: 'Georgia, serif',
};

const buttonHoverStyle: React.CSSProperties = {
  transform: 'translateY(-1px)',
  boxShadow: '0 5px 15px rgba(52, 152, 219, 0.2)',
};

export const EditMetaModelModal: React.FC<EditMetaModelModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  metaModel,
  isOwner,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    domain: '',
    keywords: [] as string[],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    if (isOpen && metaModel) {
      setFormData({
        name: metaModel.name || '',
        description: metaModel.description || '',
        domain: metaModel.domain || '',
        keywords: metaModel.keyword || [],
      });
      setError('');
      setSuccess('');
    }
  }, [isOpen, metaModel]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Backend handles permission checks, allow submission for all users

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await apiService.updateMetaModel(String(metaModel.id), {
        name: formData.name.trim(),
        description: formData.description.trim(),
        domain: formData.domain.trim(),
        keyword: formData.keywords,
        ecoreFileId: metaModel.ecoreFileId || 0,
        genModelFileId: metaModel.genModelFileId || 0,
      });

      setSuccess('Meta model updated successfully!');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to update meta model');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const overlayStyle: React.CSSProperties = {
    ...modalOverlayStyle,
    zIndex: 10000,
  };

  return ReactDOM.createPortal(
    <div
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-meta-model-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
      tabIndex={-1}
    >
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <h2 id="edit-meta-model-title" style={modalTitleStyle}>
            Edit Meta Model
          </h2>
          <button
            style={closeButtonStyle}
            onClick={onClose}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, { background: '#f8f9fa', color: '#333' });
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, closeButtonStyle);
            }}
          >
            ×
          </button>
        </div>


        <form onSubmit={handleSubmit}>
          <div style={formGroupStyle}>
            <label htmlFor="edit-meta-model-name" style={labelStyle}>Name *</label>
            <input
              id="edit-meta-model-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={inputStyle}
              required
              onFocus={(e) => Object.assign(e.currentTarget.style, inputFocusStyle)}
              onBlur={(e) => Object.assign(e.currentTarget.style, inputStyle)}
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="edit-meta-model-description" style={labelStyle}>Description *</label>
            <textarea
              id="edit-meta-model-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              style={{
                ...inputStyle,
                minHeight: '100px',
                resize: 'vertical',
              }}
              required
              onFocus={(e) => Object.assign(e.currentTarget.style, inputFocusStyle)}
              onBlur={(e) => Object.assign(e.currentTarget.style, inputStyle)}
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="edit-meta-model-domain" style={labelStyle}>Domain *</label>
            <input
              id="edit-meta-model-domain"
              type="text"
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              style={inputStyle}
              required
              onFocus={(e) => Object.assign(e.currentTarget.style, inputFocusStyle)}
              onBlur={(e) => Object.assign(e.currentTarget.style, inputStyle)}
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="edit-meta-model-keywords" style={labelStyle}>Keywords *</label>
            <KeywordTagsInput
              id="edit-meta-model-keywords"
              keywords={formData.keywords}
              onChange={(keywords) => setFormData({ ...formData, keywords })}
            />
          </div>

          {error && <div style={errorMessageStyle}>{error}</div>}
          {success && <div style={successMessageStyle}>{success}</div>}

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                ...buttonStyle,
                background: '#6c757d',
                flex: 1,
              }}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, { ...buttonHoverStyle, background: '#5a6268' })}
              onMouseLeave={(e) => Object.assign(e.currentTarget.style, { ...buttonStyle, background: '#6c757d' })}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.name.trim() || !formData.description.trim() || !formData.domain.trim() || formData.keywords.length === 0}
              style={{
                ...buttonStyle,
                flex: 1,
                opacity: isLoading || !formData.name.trim() || !formData.description.trim() || !formData.domain.trim() || formData.keywords.length === 0 ? 0.6 : 1,
                cursor: isLoading || !formData.name.trim() || !formData.description.trim() || !formData.domain.trim() || formData.keywords.length === 0 ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isLoading && formData.name.trim() && formData.description.trim() && formData.domain.trim() && formData.keywords.length > 0) {
                  Object.assign(e.currentTarget.style, buttonHoverStyle);
                }
              }}
              onMouseLeave={(e) => {
                Object.assign(e.currentTarget.style, buttonStyle);
              }}
            >
              {isLoading ? 'Updating...' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
