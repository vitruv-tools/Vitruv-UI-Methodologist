import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { apiService } from '../../services/api';
import { KeywordTagsInput } from './KeywordTagsInput';

interface CreateModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (modelData: any) => void;
}

interface CreateModelRequest {
  name: string;
  description: string;
  domain: string;
  keyword: string[];
  ecoreFileId: number;
  genModelFileId: number;
}

// Secure random number generator helper function
const getSecureRandomInt = (max: number): number => {
  const crypto = window.crypto || (window as any).msCrypto;
  if (crypto && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  }
  // Fallback for environments without crypto support (should not happen in modern browsers)
  throw new Error('Cryptographically secure random number generation not available');
};

// Modal styles
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
  zIndex: 10000,
};

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

const closeButtonHoverStyle: React.CSSProperties = {
  background: '#f8f9fa',
  color: '#333',
  transform: 'rotate(90deg)',
};

const formGroupStyle: React.CSSProperties = { marginBottom: '20px' };

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: 600,
  color: '#2c3e50',
  marginBottom: '8px',
  fontFamily: 'Georgia, serif',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '2px solid #d1ecf1',
  borderRadius: '6px',
  fontSize: '14px',
  boxSizing: 'border-box',
  transition: 'all 0.3s ease',
  background: '#f8f9fa',
  fontFamily: 'Georgia, serif',
};

const inputFocusStyle: React.CSSProperties = {
  borderColor: '#3498db',
  outline: 'none',
  boxShadow: '0 0 0 3px rgba(52, 152, 219, 0.1)',
  background: '#ffffff',
};

const uploadSectionStyle: React.CSSProperties = {
  marginTop: '20px',
  padding: '18px',
  background: '#f8f9fa',
  borderRadius: '6px',
  border: '2px dashed #3498db',
};

const uploadSectionTitleStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  color: '#2c3e50',
  marginBottom: '16px',
  textAlign: 'center',
  fontFamily: 'Georgia, serif',
};

const uploadButtonsContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  marginBottom: '16px',
};

const uploadButtonStyle: React.CSSProperties = {
  flex: '1',
  padding: '12px 14px',
  border: '2px solid #3498db',
  borderRadius: '6px',
  background: '#ffffff',
  color: '#2c3e50',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontFamily: 'Georgia, serif',
};

const uploadButtonHoverStyle: React.CSSProperties = {
  borderColor: '#2980b9',
  background: '#f8f9ff',
  color: '#2980b9',
  transform: 'translateY(-1px)',
  boxShadow: '0 4px 12px rgba(52, 152, 219, 0.15)',
};

const uploadButtonSuccessStyle: React.CSSProperties = {
  borderColor: '#27ae60',
  background: '#d5f4e6',
  color: '#1e8449',
};

const fileStatusStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#5a6c7d',
  textAlign: 'center',
  marginTop: '8px',
  fontFamily: 'Georgia, serif',
  fontStyle: 'italic',
};

const buttonGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  marginTop: '24px',
};

const primaryButtonStyle: React.CSSProperties = {
  flex: '1',
  padding: '14px 18px',
  border: 'none',
  borderRadius: '6px',
  background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  fontFamily: 'Georgia, serif',
};

const primaryButtonDisabledStyle: React.CSSProperties = {
  background: '#bdc3c7',
  color: '#7f8c8d',
  cursor: 'not-allowed',
  transform: 'none',
  boxShadow: 'none',
};

const secondaryButtonStyle: React.CSSProperties = {
  flex: '1',
  padding: '14px 18px',
  border: '2px solid #3498db',
  borderRadius: '6px',
  background: '#ffffff',
  color: '#2c3e50',
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

const successMessageStyle: React.CSSProperties = {
  padding: '8px 12px',
  margin: '8px 0',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: '500',
  backgroundColor: '#d4edda',
  color: '#155724',
  border: '1px solid #c3e6cb',
};

const fileInputStyle: React.CSSProperties = { display: 'none' };

const progressBarContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '6px',
  backgroundColor: '#e0e0e0',
  borderRadius: '3px',
  overflow: 'hidden',
};

const progressBarStyle: React.CSSProperties = {
  height: '100%',
  backgroundColor: '#3498db',
  borderRadius: '3px',
  transition: 'width 0.3s ease',
  width: '0%',
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  zIndex: 11000, // above modal
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const overlayCardStyle: React.CSSProperties = {
  width: 'min(520px, 90vw)',
  background: '#fff',
  borderRadius: 10,
  padding: '20px 20px 16px',
  boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
  border: '1px solid #e5e7eb',
};

const overlayTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: '#1f2937',
  marginBottom: 10,
  textAlign: 'center',
};

const overlayTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
  marginBottom: 8,
  textAlign: 'center',
};

export const CreateModelModal: React.FC<CreateModelModalProps> = ({
                                                                    isOpen,
                                                                    onClose,
                                                                    onSuccess
                                                                  }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    domain: '',
    keywords: [] as string[],
  });

  const [uploadedFileIds, setUploadedFileIds] = useState({
    ecoreFileId: 0,
    genModelFileId: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const [uploadProgress, setUploadProgress] = useState({
    ecore: { progress: 0, isUploading: false },
    genmodel: { progress: 0, isUploading: false }
  });
  const [submitProgress, setSubmitProgress] = useState({ progress: 0, isSubmitting: false });

  const ecoreFileInputRef = useRef<HTMLInputElement>(null);
  const genmodelFileInputRef = useRef<HTMLInputElement>(null);
  const ecoreProgressIntervalRef = useRef<number | null>(null);
  const genmodelProgressIntervalRef = useRef<number | null>(null);
  const submitProgressIntervalRef = useRef<number | null>(null);

  const canSave = uploadedFileIds.ecoreFileId > 0 && uploadedFileIds.genModelFileId > 0 && formData.name.trim();

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
      ecoreProgressIntervalRef.current = window.setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          ecore: {
            progress: Math.min(prev.ecore.progress + Math.random() * 20, 90),
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

      const rawData: any = (response as any)?.data;
      let fileId = (rawData && typeof rawData === 'object' && 'id' in rawData)
          ? Number(rawData.id)
          : Number(rawData);
      if (!Number.isFinite(fileId)) fileId = Date.now() + getSecureRandomInt(1000);

      setUploadedFileIds(prev => ({ ...prev, ecoreFileId: fileId }));
      setSuccess(`Successfully uploaded ${file.name}`);
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
      genmodelProgressIntervalRef.current = window.setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          genmodel: {
            progress: Math.min(prev.genmodel.progress + Math.random() * 20, 90),
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

      const rawData: any = (response as any)?.data;
      let fileId = (rawData && typeof rawData === 'object' && 'id' in rawData)
          ? Number(rawData.id)
          : Number(rawData);
      if (!Number.isFinite(fileId)) fileId = Date.now() + getSecureRandomInt(1000);

      setUploadedFileIds(prev => ({ ...prev, genModelFileId: fileId }));
      setSuccess(`Successfully uploaded ${file.name}`);
      setTimeout(() => setSuccess(''), 3000);

      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, genmodel: { progress: 0, isUploading: false } }));
      }, 2000);
    } catch (err) {
      setError(`Error uploading ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setUploadProgress(prev => ({ ...prev, genmodel: { progress: 0, isUploading: false } }));
      if (genmodelProgressIntervalRef.current) {
        clearInterval(genmodelProgressIntervalRef.current);
        genmodelProgressIntervalRef.current = null;
      }
    }

    event.target.value = '';
  };

  const startSubmitOverlay = () => {
    // Start overlay with progress ramping to ~90%
    if (submitProgressIntervalRef.current) {
      clearInterval(submitProgressIntervalRef.current);
      submitProgressIntervalRef.current = null;
    }
    setSubmitProgress({ progress: 0, isSubmitting: true });
    submitProgressIntervalRef.current = window.setInterval(() => {
      setSubmitProgress(prev => ({
        progress: Math.min(prev.progress + Math.random() * 16 + 4, 90), // +4..20 each tick up to 90
        isSubmitting: true,
      }));
    }, 220);
  };

  const finishSubmitOverlay = (onDone?: () => void) => {
    // Smoothly fill to 100
    if (submitProgressIntervalRef.current) {
      clearInterval(submitProgressIntervalRef.current);
      submitProgressIntervalRef.current = null;
    }
    setSubmitProgress({ progress: 100, isSubmitting: true });
    // Let user see 100% briefly
    setTimeout(() => {
      setSubmitProgress({ progress: 0, isSubmitting: false });
      onDone?.();
    }, 500);
  };

  const stopSubmitOverlayWithError = () => {
    if (submitProgressIntervalRef.current) {
      clearInterval(submitProgressIntervalRef.current);
      submitProgressIntervalRef.current = null;
    }
    // Collapse overlay
    setSubmitProgress({ progress: 0, isSubmitting: false });
  };

  const handleCreateModel = async () => {
    if (!canSave) {
      setError('Please fill in all required fields and upload both files');
      return;
    }
    if (formData.keywords.length === 0) {
      setError('Please enter at least one keyword');
      return;
    }

    setIsLoading(true);
    setError('');
    startSubmitOverlay();

    try {
      const requestData: CreateModelRequest = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        domain: formData.domain.trim(),
        keyword: formData.keywords,
        ecoreFileId: uploadedFileIds.ecoreFileId,
        genModelFileId: uploadedFileIds.genModelFileId,
      };

      const response = await apiService.createMetaModel(requestData);

      // If backend responds OK, fill to 100% and then close/reset
      finishSubmitOverlay(() => {
        setIsLoading(false);
        setSuccess('Meta Model created successfully!');
        setTimeout(() => {
          onSuccess?.(response.data);
          handleClose();
        }, 300);
      });
    } catch (err) {
      setIsLoading(false);
      setError(`Error creating meta model: ${err instanceof Error ? err.message : 'Unknown error'}`);
      stopSubmitOverlayWithError();
    }
  };

  const handleClose = () => {
    if (submitProgressIntervalRef.current) {
      clearInterval(submitProgressIntervalRef.current);
      submitProgressIntervalRef.current = null;
    }
    if (ecoreProgressIntervalRef.current) {
      clearInterval(ecoreProgressIntervalRef.current);
      ecoreProgressIntervalRef.current = null;
    }
    if (genmodelProgressIntervalRef.current) {
      clearInterval(genmodelProgressIntervalRef.current);
      genmodelProgressIntervalRef.current = null;
    }
    setSubmitProgress({ progress: 0, isSubmitting: false });
    setFormData({ name: '', description: '', domain: '', keywords: [] });
    setUploadedFileIds({ ecoreFileId: 0, genModelFileId: 0 });
    setError('');
    setSuccess('');
    setIsLoading(false);
    setUploadProgress({
      ecore: { progress: 0, isUploading: false },
      genmodel: { progress: 0, isUploading: false }
    });
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
    if (!isOpen) {
      if (submitProgressIntervalRef.current) {
        clearInterval(submitProgressIntervalRef.current);
        submitProgressIntervalRef.current = null;
      }
      if (ecoreProgressIntervalRef.current) {
        clearInterval(ecoreProgressIntervalRef.current);
        ecoreProgressIntervalRef.current = null;
      }
      if (genmodelProgressIntervalRef.current) {
        clearInterval(genmodelProgressIntervalRef.current);
        genmodelProgressIntervalRef.current = null;
      }
      setSubmitProgress({ progress: 0, isSubmitting: false });
      setUploadProgress({
        ecore: { progress: 0, isUploading: false },
        genmodel: { progress: 0, isUploading: false }
      });
    }
    return () => {
      if (submitProgressIntervalRef.current) {
        clearInterval(submitProgressIntervalRef.current);
        submitProgressIntervalRef.current = null;
      }
      if (ecoreProgressIntervalRef.current) {
        clearInterval(ecoreProgressIntervalRef.current);
        ecoreProgressIntervalRef.current = null;
      }
      if (genmodelProgressIntervalRef.current) {
        clearInterval(genmodelProgressIntervalRef.current);
        genmodelProgressIntervalRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
      <>
        {/* Full-screen Submit Overlay */}
        {submitProgress.isSubmitting && (
            <div style={overlayStyle} aria-modal="true" role="dialog" aria-label="Building meta model">
              <div style={overlayCardStyle} onClick={(e) => e.stopPropagation()}>
                <div style={overlayTitleStyle}>Building Meta Model…</div>
                <div style={overlayTextStyle}>Please wait while we process your files.</div>
                <div style={{ ...progressBarContainerStyle, marginTop: 8 }}>
                  <div style={{ ...progressBarStyle, width: `${submitProgress.progress}%` }} />
                </div>
                <div style={{ fontSize: 12, color: '#374151', textAlign: 'center', marginTop: 6 }}>
                  {Math.round(submitProgress.progress)}%
                </div>
              </div>
            </div>
        )}

        {/* Modal */}
        <div style={modalOverlayStyle} onClick={handleClose}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={modalTitleStyle}>Build New Meta Model</h2>
              <button
                  style={closeButtonStyle}
                  onClick={handleClose}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, closeButtonHoverStyle)}
                  onMouseLeave={(e) => Object.assign(e.currentTarget.style, closeButtonStyle)}
              >
                ×
              </button>
            </div>

            {error && <div style={errorMessageStyle}>{error}</div>}
            {success && <div style={successMessageStyle}>{success}</div>}

            <div style={formGroupStyle}>
              <label style={labelStyle}>Name *</label>
              <input
                  type="text"
                  placeholder="Enter meta model name..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={inputStyle}
                  onFocus={(e) => Object.assign(e.currentTarget.style, inputFocusStyle)}
                  onBlur={(e) => Object.assign(e.currentTarget.style, inputStyle)}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>Description</label>
              <textarea
                  placeholder="Optional description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
                  onFocus={(e) => Object.assign(e.currentTarget.style, inputFocusStyle)}
                  onBlur={(e) => Object.assign(e.currentTarget.style, inputStyle)}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>Keywords</label>
              <KeywordTagsInput
                  keywords={formData.keywords}
                  onChange={(keywords) => setFormData({ ...formData, keywords })}
                  placeholder="Type keywords and press Enter..."
                  style={inputStyle}
              />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', fontStyle: 'italic' }}>
                Press Enter to add each keyword as colored text. Keywords will appear in different colors automatically.
              </div>
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>Domain</label>
              <input
                  type="text"
                  placeholder="Enter domain"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  style={inputStyle}
                  onFocus={(e) => Object.assign(e.currentTarget.style, inputFocusStyle)}
                  onBlur={(e) => Object.assign(e.currentTarget.style, inputStyle)}
              />
            </div>

            {/* File Upload Section */}
            <div style={uploadSectionStyle}>
              <div style={uploadSectionTitleStyle}>Required Meta Model Files</div>

              <input
                  ref={ecoreFileInputRef}
                  type="file"
                  accept=".ecore"
                  onChange={handleEcoreFileUpload}
                  style={fileInputStyle}
              />
              <input
                  ref={genmodelFileInputRef}
                  type="file"
                  accept=".genmodel"
                  onChange={handleGenmodelFileUpload}
                  style={fileInputStyle}
              />

              <div style={uploadButtonsContainerStyle}>
                <div style={{ flex: '1' }}>
                  <button
                      style={{
                        ...uploadButtonStyle,
                        ...(uploadedFileIds.ecoreFileId > 0 ? uploadButtonSuccessStyle : {}),
                        width: '100%'
                      }}
                      onClick={() => ecoreFileInputRef.current?.click()}
                      disabled={uploadProgress.ecore.isUploading}
                      onMouseEnter={(e) => !uploadedFileIds.ecoreFileId && !uploadProgress.ecore.isUploading && Object.assign(e.currentTarget.style, uploadButtonHoverStyle)}
                      onMouseLeave={(e) => !uploadedFileIds.ecoreFileId && !uploadProgress.ecore.isUploading && Object.assign(e.currentTarget.style, uploadButtonStyle)}
                  >
                    {uploadProgress.ecore.isUploading ? 'Uploading...' : uploadedFileIds.ecoreFileId > 0 ? '✓' : 'Upload'} .ecore
                  </button>
                  {uploadProgress.ecore.isUploading && (
                      <>
                        <div style={{ ...progressBarContainerStyle, marginTop: 8 }}>
                          <div style={{ ...progressBarStyle, width: `${uploadProgress.ecore.progress}%` }} />
                        </div>
                        <div style={{ fontSize: 12, color: '#666', textAlign: 'center', marginTop: 4 }}>
                          {Math.round(uploadProgress.ecore.progress)}%
                        </div>
                      </>
                  )}
                </div>

                <div style={{ flex: '1' }}>
                  <button
                      style={{
                        ...uploadButtonStyle,
                        ...(uploadedFileIds.genModelFileId > 0 ? uploadButtonSuccessStyle : {}),
                        width: '100%'
                      }}
                      onClick={() => genmodelFileInputRef.current?.click()}
                      disabled={uploadProgress.genmodel.isUploading}
                      onMouseEnter={(e) => !uploadedFileIds.genModelFileId && !uploadProgress.genmodel.isUploading && Object.assign(e.currentTarget.style, uploadButtonHoverStyle)}
                      onMouseLeave={(e) => !uploadedFileIds.genModelFileId && !uploadProgress.genmodel.isUploading && Object.assign(e.currentTarget.style, uploadButtonStyle)}
                  >
                    {uploadProgress.genmodel.isUploading ? 'Uploading...' : uploadedFileIds.genModelFileId > 0 ? '✓' : 'Upload'} .genmodel
                  </button>
                  {uploadProgress.genmodel.isUploading && (
                      <>
                        <div style={{ ...progressBarContainerStyle, marginTop: 8 }}>
                          <div style={{ ...progressBarStyle, width: `${uploadProgress.genmodel.progress}%` }} />
                        </div>
                        <div style={{ fontSize: 12, color: '#666', textAlign: 'center', marginTop: 4 }}>
                          {Math.round(uploadProgress.genmodel.progress)}%
                        </div>
                      </>
                  )}
                </div>
              </div>

              <div style={fileStatusStyle}>
                {uploadedFileIds.ecoreFileId > 0 && uploadedFileIds.genModelFileId > 0
                    ? '✅ Both files uploaded successfully!'
                    : 'Please upload both .ecore and .genmodel files to continue'}
              </div>
            </div>

            <div style={buttonGroupStyle}>
              <button
                  style={secondaryButtonStyle}
                  onClick={handleClose}
                  disabled={isLoading || submitProgress.isSubmitting}
                  onMouseEnter={(e) => !isLoading && !submitProgress.isSubmitting && Object.assign(e.currentTarget.style, buttonHoverStyle)}
                  onMouseLeave={(e) => !isLoading && !submitProgress.isSubmitting && Object.assign(e.currentTarget.style, secondaryButtonStyle)}
              >
                Cancel
              </button>
              <button
                  style={{
                    ...primaryButtonStyle,
                    ...(canSave && !isLoading ? {} : primaryButtonDisabledStyle)
                  }}
                  onClick={handleCreateModel}
                  disabled={!canSave || isLoading || submitProgress.isSubmitting}
                  onMouseEnter={(e) => canSave && !isLoading && !submitProgress.isSubmitting && Object.assign(e.currentTarget.style, buttonHoverStyle)}
                  onMouseLeave={(e) => canSave && !isLoading && !submitProgress.isSubmitting && Object.assign(e.currentTarget.style, primaryButtonStyle)}
              >
                {isLoading ? 'Creating...' : canSave ? 'Build Meta Model' : 'Upload Files First'}
              </button>
            </div>
          </div>
        </div>
      </>,
      document.body
  );
};