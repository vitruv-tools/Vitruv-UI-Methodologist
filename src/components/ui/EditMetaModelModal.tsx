import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../../services/api';
import {
  modalOverlayStyle,
  formGroupStyle,
  labelStyle,
  inputStyle,
  errorMessageStyle,
  successMessageStyle,
  fileInputStyle,
  progressBarContainerStyle,
  progressBarStyle,
} from './sharedStyles';

export interface MetaModel {
  id: string | number;
  name: string;
  description?: string;
  domain?: string;
  keyword?: string[];
  ecoreFileId?: number;
  genModelFileId?: number;
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
  padding: '20px',
  width: '480px',
  maxWidth: '90vw',
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
  
  // File upload state
  const [uploadedFileIds, setUploadedFileIds] = useState({
    ecoreFileId: 0,
    genModelFileId: 0,
  });
  const [uploadProgress, setUploadProgress] = useState({
    ecore: { progress: 0, isUploading: false },
    genmodel: { progress: 0, isUploading: false }
  });
  
  const ecoreFileInputRef = useRef<HTMLInputElement>(null);
  const genmodelFileInputRef = useRef<HTMLInputElement>(null);
  const ecoreProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const genmodelProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isOpen && model) {
      setName(model.name || '');
      setDescription(model.description || '');
      setDomain(model.domain || '');
      setKeywords(Array.isArray(model.keyword) ? model.keyword : []);
      setUploadedFileIds({
        ecoreFileId: model.ecoreFileId || 0,
        genModelFileId: model.genModelFileId || 0,
      });
      setError('');
      setSuccess('');
      setIsSaving(false);
      setUploadProgress({
        ecore: { progress: 0, isUploading: false },
        genmodel: { progress: 0, isUploading: false }
      });
    }
  }, [isOpen, model]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (ecoreProgressIntervalRef.current) {
        clearInterval(ecoreProgressIntervalRef.current);
      }
      if (genmodelProgressIntervalRef.current) {
        clearInterval(genmodelProgressIntervalRef.current);
      }
    };
  }, []);

  if (!isOpen || !model) return null;

  const canSave =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    domain.trim().length > 0 &&
    keywords.length > 0 &&
    !isSaving;

  // Helper to extract file ID from response
  const extractFileId = (rawData: any): number => {
    let fileId = (rawData && typeof rawData === 'object' && 'id' in rawData)
        ? Number(rawData.id)
        : Number(rawData);
    if (!Number.isFinite(fileId)) fileId = 0;
    return fileId;
  };

  // Helper to sanitize file names for display
  const sanitizeFileName = (fileName: string): string => {
    const invalidChars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    let sanitized = fileName;
    for (const char of invalidChars) {
      sanitized = sanitized.replaceAll(char, '');
    }
    return sanitized;
  };

  const handleEcoreFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.ecore')) {
      setError('Please select a valid .ecore file');
      return;
    }

    setUploadProgress(prev => ({ ...prev, ecore: { progress: 0, isUploading: true } }));
    setError('');

    try {
      if (ecoreProgressIntervalRef.current) clearInterval(ecoreProgressIntervalRef.current);
      ecoreProgressIntervalRef.current = globalThis.setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          ecore: {
            progress: Math.min(prev.ecore.progress + 15, 90),
            isUploading: true
          }
        }));
      }, 200);

      const response = await apiService.uploadFile(file, 'ECORE');

      if (ecoreProgressIntervalRef.current) {
        clearInterval(ecoreProgressIntervalRef.current);
        ecoreProgressIntervalRef.current = null;
      }

      setUploadProgress(prev => ({ ...prev, ecore: { progress: 100, isUploading: false } }));

      const fileId = extractFileId(response);
      setUploadedFileIds(prev => ({ ...prev, ecoreFileId: fileId }));
      setSuccess(`Successfully uploaded ${sanitizeFileName(file.name)}`);
      
      setTimeout(() => setSuccess(''), 3000);
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, ecore: { progress: 0, isUploading: false } }));
      }, 2000);
    } catch (err) {
      setError(`${err instanceof Error ? err.message : 'Unknown error'}`);
      setUploadProgress(prev => ({ ...prev, ecore: { progress: 0, isUploading: false } }));
      if (ecoreProgressIntervalRef.current) {
        clearInterval(ecoreProgressIntervalRef.current);
        ecoreProgressIntervalRef.current = null;
      }
    }

    event.target.value = '';
  };

  const handleGenmodelFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.genmodel')) {
      setError('Please select a valid .genmodel file');
      return;
    }

    setUploadProgress(prev => ({ ...prev, genmodel: { progress: 0, isUploading: true } }));
    setError('');

    try {
      if (genmodelProgressIntervalRef.current) clearInterval(genmodelProgressIntervalRef.current);
      genmodelProgressIntervalRef.current = globalThis.setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          genmodel: {
            progress: Math.min(prev.genmodel.progress + 15, 90),
            isUploading: true
          }
        }));
      }, 200);

      const response = await apiService.uploadFile(file, 'GEN_MODEL');

      if (genmodelProgressIntervalRef.current) {
        clearInterval(genmodelProgressIntervalRef.current);
        genmodelProgressIntervalRef.current = null;
      }

      setUploadProgress(prev => ({ ...prev, genmodel: { progress: 100, isUploading: false } }));

      const fileId = extractFileId(response);
      setUploadedFileIds(prev => ({ ...prev, genModelFileId: fileId }));
      setSuccess(`Successfully uploaded ${sanitizeFileName(file.name)}`);
      
      setTimeout(() => setSuccess(''), 3000);
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, genmodel: { progress: 0, isUploading: false } }));
      }, 2000);
    } catch (err) {
      setError(`Error uploading ${sanitizeFileName(file.name)}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setUploadProgress(prev => ({ ...prev, genmodel: { progress: 0, isUploading: false } }));
      if (genmodelProgressIntervalRef.current) {
        clearInterval(genmodelProgressIntervalRef.current);
        genmodelProgressIntervalRef.current = null;
      }
    }

    event.target.value = '';
  };

  const handleSave = async () => {
    if (!canSave) return;

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload: {
        name: string;
        description: string;
        domain: string;
        keyword: string[];
        ecoreFileId?: number;
        genModelFileId?: number;
      } = {
        name: name.trim(),
        description: description.trim(),
        domain: domain.trim(),
        keyword: keywords,
      };

      // Include file IDs if they exist (either from existing model or newly uploaded)
      if (uploadedFileIds.ecoreFileId > 0) {
        payload.ecoreFileId = uploadedFileIds.ecoreFileId;
      }
      if (uploadedFileIds.genModelFileId > 0) {
        payload.genModelFileId = uploadedFileIds.genModelFileId;
      }

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

        <div style={formGroupStyle}>
          <div style={labelStyle}>Files (Optional - upload new files to replace existing ones)</div>
          
          <div style={{ marginBottom: '12px' }}>
            <label
              htmlFor="edit-mm-ecore-file"
              style={{
                ...primaryButtonStyle,
                display: 'inline-block',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              {uploadedFileIds.ecoreFileId > 0 && !uploadProgress.ecore.isUploading
                ? 'Replace .ecore File'
                : 'Upload .ecore File'}
            </label>
            <input
              ref={ecoreFileInputRef}
              id="edit-mm-ecore-file"
              type="file"
              accept=".ecore"
              onChange={handleEcoreFileUpload}
              style={fileInputStyle}
            />
            {uploadProgress.ecore.isUploading && (
              <div style={{ ...progressBarContainerStyle, marginTop: 8 }}>
                <div style={{ ...progressBarStyle, width: `${uploadProgress.ecore.progress}%` }} />
              </div>
            )}
            {uploadedFileIds.ecoreFileId > 0 && !uploadProgress.ecore.isUploading && (
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>
                .ecore file ID: {uploadedFileIds.ecoreFileId}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="edit-mm-genmodel-file"
              style={{
                ...primaryButtonStyle,
                display: 'inline-block',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              {uploadedFileIds.genModelFileId > 0 && !uploadProgress.genmodel.isUploading
                ? 'Replace .genmodel File'
                : 'Upload .genmodel File'}
            </label>
            <input
              ref={genmodelFileInputRef}
              id="edit-mm-genmodel-file"
              type="file"
              accept=".genmodel"
              onChange={handleGenmodelFileUpload}
              style={fileInputStyle}
            />
            {uploadProgress.genmodel.isUploading && (
              <div style={{ ...progressBarContainerStyle, marginTop: 8 }}>
                <div style={{ ...progressBarStyle, width: `${uploadProgress.genmodel.progress}%` }} />
              </div>
            )}
            {uploadedFileIds.genModelFileId > 0 && !uploadProgress.genmodel.isUploading && (
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>
                .genmodel file ID: {uploadedFileIds.genModelFileId}
              </div>
            )}
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


