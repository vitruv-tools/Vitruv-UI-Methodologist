import React, { useState } from 'react';
import { apiService } from '../../services/api';
import { useToast } from './ToastProvider';

interface CreateVsumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (vsum: any) => void;
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '8px',
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
  borderRadius: '6px',
};

const formGroupStyle: React.CSSProperties = {
  marginBottom: '14px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#2c3e50',
  marginBottom: '6px',
  fontFamily: 'Georgia, serif',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #ced4da',
  borderRadius: '6px',
  fontSize: '13px',
  boxSizing: 'border-box',
  background: '#ffffff',
  fontFamily: 'Georgia, serif',
};

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

const errorMessageStyle: React.CSSProperties = {
  padding: '8px 12px',
  margin: '8px 0',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: '500',
  backgroundColor: '#f8d7da',
  color: '#721c24',
  border: '1px solid #f5c6cb',
};

export const CreateVsumModal: React.FC<CreateVsumModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showSuccess, showError } = useToast();

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

  return (
    <div style={modalOverlayStyle} onClick={handleClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>Create VSUM</h3>
          <button style={closeButtonStyle} onClick={handleClose}>
            ×
          </button>
        </div>

        {error && <div style={errorMessageStyle}>{error}</div>}

        <div style={formGroupStyle}>
          <label style={labelStyle}>Name *</label>
          <input
            placeholder="Enter name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            disabled={loading}
          />
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle}>Description</label>
          <textarea
            placeholder="Optional description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
            disabled={loading}
          />
        </div>

        <div style={buttonRowStyle}>
          <button style={secondaryButtonStyle} onClick={handleClose} disabled={loading}>Cancel</button>
          <button style={primaryButtonStyle} onClick={handleSubmit} disabled={loading || !name.trim()}>
            {loading ? 'Creating...' : 'Create VSUM'}
          </button>
        </div>
      </div>
    </div>
  );
};

