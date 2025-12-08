import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { apiService } from '../../services/api';
import { useToast } from './ToastProvider';
import {
  modalOverlayStyle,
  labelStyle,
  inputStyle,
  errorMessageStyle,
} from './sharedStyles';

interface CreateVsumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (vsum: any) => void;
}

const modalStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '0',
  padding: '24px',
  width: '480px',
  maxWidth: '90vw',
  maxHeight: '85vh',
  overflow: 'auto',
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
  border: '1px solid #d1ecf1',
  fontFamily: 'Georgia, serif',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
  paddingBottom: '12px',
  borderBottom: '2px solid #3498db',
};

const titleStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#2c3e50',
  margin: 0,
  fontFamily: 'Georgia, serif',
};

const closeButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #dee2e6',
  fontSize: '16px',
  color: '#6c757d',
  cursor: 'pointer',
  padding: '6px 10px',
  borderRadius: '0',
};

const formGroupStyle: React.CSSProperties = {
  marginBottom: '14px',
};

const inputStyleLocal: React.CSSProperties = { ...inputStyle, border: '1px solid #ced4da', borderRadius: 0, fontSize: '13px', background: '#ffffff' };

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  justifyContent: 'flex-end',
  marginTop: '12px',
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '10px 12px',
  border: '1px solid #dee2e6',
  borderRadius: '6px',
  background: '#e7f5ff',
  cursor: 'pointer',
  fontWeight: 700,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '10px 12px',
  border: '1px solid #dee2e6',
  borderRadius: '6px',
  background: '#f8f9fa',
  cursor: 'pointer',
  fontWeight: 600,
};

export const CreateVsumModal: React.FC<CreateVsumModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiService.createVsum({ name: trimmedName, description: description.trim() || undefined });
      onSuccess?.(res.data);
      showSuccess('Vsum successfully created');
      setName('');
      setDescription('');
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create VSUM';
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

  return ReactDOM.createPortal(
    <dialog open style={modalOverlayStyle} onClose={handleClose} onCancel={handleClose} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }} onKeyDown={(e) => { if (e.key === 'Escape') handleClose(); }}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>Create</h3>
          <button style={closeButtonStyle} onClick={handleClose}>
            ×
          </button>
        </div>

        {error && <div style={errorMessageStyle}>{error}</div>}

        <div style={formGroupStyle}>
          <label htmlFor="vsum-name-input" style={labelStyle}>Name *</label>
          <input
            id="vsum-name-input"
            placeholder="Enter name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyleLocal}
            disabled={loading}
          />
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="vsum-description-input" style={labelStyle}>Description</label>
          <textarea
            id="vsum-description-input"
            placeholder="Optional description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyleLocal, minHeight: 80, resize: 'vertical' }}
            disabled={loading}
          />
        </div>

        <div style={buttonRowStyle}>
          <button style={secondaryButtonStyle} onClick={handleClose} disabled={loading}>Cancel</button>
          <button style={primaryButtonStyle} onClick={handleSubmit} disabled={loading || !name.trim()}>
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </dialog>,
    document.body
  );
};

