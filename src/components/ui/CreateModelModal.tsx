import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  fileInputStyle,
  progressBarContainerStyle,
  progressBarStyle,
} from './sharedStyles';

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
  /**
   * When true, backend will try to automatically fix issues
   * in the GenModel before saving the meta model.
   *
   * Frontend convention:
   * - First call should always send `false`
   * - If backend rejects the GenModel with a "Metamodel rejected" error,
   *   the user can opt in to a second call with this flag set to `true`.
   */
  applyGenModelFixes?: boolean;
}

type FileKind = 'ecore' | 'genmodel';

// ─── Module-level helpers ────────────────────────────────────────────────────

const getSecureRandomInt = (max: number): number => {
  const crypto = globalThis.crypto || (globalThis as any).msCrypto;
  if (crypto?.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  }
  throw new Error('Cryptographically secure random number generation not available');
};

const sanitizeFileName = (fileName: string): string => fileName.replaceAll(/[<>]/g, '');

const extractFileId = (response: any): number => {
  const rawData: any = response?.data;
  let fileId = rawData && typeof rawData === 'object' && 'id' in rawData
    ? Number(rawData.id)
    : Number(rawData);
  if (!Number.isFinite(fileId)) fileId = Date.now() + getSecureRandomInt(1000);
  return fileId;
};

const parseBackendError = (err: unknown): { message: string; isMetamodelRejected: boolean } => {
  const anyError = err as any;
  const backendPayload = anyError?.response?.data;
  const backendMessage = typeof backendPayload?.message === 'string' ? backendPayload.message : '';
  const message = backendMessage || (err instanceof Error ? err.message : '') || 'Unknown error';
  return { message, isMetamodelRejected: message.toLowerCase().includes('metamodel rejected') };
};

// ─── Per-kind configuration ───────────────────────────────────────────────────

const FILE_KIND_CONFIG: Record<FileKind, {
  ext: string;
  apiType: 'ECORE' | 'GEN_MODEL';
  fileIdKey: 'ecoreFileId' | 'genModelFileId';
}> = {
  ecore:    { ext: '.ecore',    apiType: 'ECORE',     fileIdKey: 'ecoreFileId' },
  genmodel: { ext: '.genmodel', apiType: 'GEN_MODEL', fileIdKey: 'genModelFileId' },
};

const FILE_CARD_DISPLAY_CONFIGS: Array<{
  kind: FileKind;
  accentColor: string;
  hoverBg: string;
  badgeBg: string;
  badgeBorder: string;
  badgeColor: string;
  defaultHeaderBg: string;
}> = [
  { kind: 'ecore',    accentColor: '#049484', hoverBg: '#f0fdff', badgeBg: '#e6f7f5', badgeBorder: '#b2e4df', badgeColor: '#049484', defaultHeaderBg: '#f8fffe' },
  { kind: 'genmodel', accentColor: '#2980b9', hoverBg: '#f0f7ff', badgeBg: '#eff6ff', badgeBorder: '#bfdbfe', badgeColor: '#2563eb', defaultHeaderBg: '#f8fbff' },
];

// ─── Style constants ──────────────────────────────────────────────────────────

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
  borderBottom: '2px solid #049484',
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

const inputFocusStyle: React.CSSProperties = {
  borderColor: '#049484',
  outline: 'none',
  boxShadow: '0 0 0 3px rgba(52, 152, 219, 0.1)',
  background: '#ffffff',
};

const uploadSectionStyle: React.CSSProperties = {
  marginTop: '20px',
  padding: '18px',
  background: '#f8f9fa',
  borderRadius: '6px',
  border: '2px dashed #049484',
};

const uploadSectionTitleStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  color: '#2c3e50',
  marginBottom: '16px',
  textAlign: 'center',
  fontFamily: 'Georgia, serif',
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
  background: 'linear-gradient(135deg, #049484 0%, #2980b9 100%)',
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
  border: '2px solid #049484',
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

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  background: 'transparent',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  zIndex: 11000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: 0,
  padding: 0,
  border: 'none',
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

// ─── Sub-components ───────────────────────────────────────────────────────────

const SubmitProgressOverlay: React.FC<{ progress: number }> = ({ progress }) => (
  <dialog
    open
    style={{ ...overlayStyle, background: 'transparent', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
    aria-label="Building meta model"
  >
    <div style={overlayCardStyle} role="presentation" onMouseDown={(e) => e.stopPropagation()}>
      <div style={overlayTitleStyle}>Building Meta Model…</div>
      <div style={overlayTextStyle}>Please wait while we process your files.</div>
      <div style={{ ...progressBarContainerStyle, marginTop: 8 }}>
        <div style={{ ...progressBarStyle, width: `${progress}%` }} />
      </div>
      <div style={{ fontSize: 12, color: '#374151', textAlign: 'center', marginTop: 6 }}>
        {Math.round(progress)}%
      </div>
    </div>
  </dialog>
);

interface FileUploadCardProps {
  ext: string;
  accentColor: string;
  hoverBg: string;
  badgeBg: string;
  badgeBorder: string;
  badgeColor: string;
  headerBg: string;
  fileId: number;
  inputMode: 'file' | 'url';
  uploadProgress: { progress: number; isUploading: boolean };
  url: string;
  urlFileName: string;
  urlPlaceholder: string;
  onModeChange: (mode: 'file' | 'url') => void;
  onFileInputClick: () => void;
  onUrlChange: (url: string) => void;
  onUrlImport: () => void;
}

const FileUploadCard: React.FC<FileUploadCardProps> = ({
  ext, accentColor, hoverBg, badgeBg, badgeBorder, badgeColor, headerBg,
  fileId, inputMode, uploadProgress, url, urlFileName, urlPlaceholder,
  onModeChange, onFileInputClick, onUrlChange, onUrlImport,
}) => {
  const isUploaded = fileId > 0;
  const isUploading = uploadProgress.isUploading;

  const fileZoneIcon = isUploading ? '⏳' : isUploaded ? '✅' : '📂';
  const fileZoneLabel = isUploading ? 'Uploading…' : isUploaded ? 'File uploaded — click to replace' : 'Click to browse file';
  const urlImportButtonLabel = isUploading ? '⏳ …' : isUploaded ? '✓ Done' : 'Import';

  return (
    <div style={{
      background: '#ffffff',
      border: `1px solid ${isUploaded ? '#86efac' : '#e2e8f0'}`,
      borderLeft: `3px solid ${isUploaded ? '#22c55e' : accentColor}`,
      borderRadius: '8px',
      marginBottom: '12px',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* card header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '9px 14px',
        background: headerBg,
        borderBottom: '1px solid #e2e8f0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <code style={{
            background: badgeBg,
            color: badgeColor,
            fontSize: '12px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '4px',
            border: `1px solid ${badgeBorder}`,
            letterSpacing: '0.02em',
          }}>{ext}</code>
          {isUploaded && (
            <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>✓ Ready</span>
          )}
        </div>
        {/* segmented toggle */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '2px', gap: '2px' }}>
          <button
            type="button"
            onClick={() => onModeChange('file')}
            style={{
              padding: '4px 11px', fontSize: '11px', fontWeight: 600, border: 'none',
              borderRadius: '4px', cursor: 'pointer', fontFamily: 'Georgia, serif',
              background: inputMode === 'file' ? '#049484' : 'transparent',
              color: inputMode === 'file' ? '#ffffff' : '#64748b',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >⬆ Computer</button>
          <button
            type="button"
            onClick={() => onModeChange('url')}
            style={{
              padding: '4px 11px', fontSize: '11px', fontWeight: 600, border: 'none',
              borderRadius: '4px', cursor: 'pointer', fontFamily: 'Georgia, serif',
              background: inputMode === 'url' ? '#049484' : 'transparent',
              color: inputMode === 'url' ? '#ffffff' : '#64748b',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >🔗 URL</button>
        </div>
      </div>

      {/* card body */}
      <div style={{ padding: '12px 14px' }}>
        {inputMode === 'file' ? (
          <button
            type="button"
            onClick={onFileInputClick}
            disabled={isUploading}
            style={{
              width: '100%', padding: '14px 12px',
              border: `2px dashed ${isUploaded ? '#86efac' : '#cbd5e1'}`,
              borderRadius: '6px',
              background: isUploaded ? '#f0fdf4' : '#fafafa',
              cursor: isUploading ? 'wait' : 'pointer',
              textAlign: 'center', transition: 'all 0.2s', fontFamily: 'Georgia, serif',
            }}
            onMouseEnter={(e) => {
              if (!isUploaded && !isUploading) {
                e.currentTarget.style.background = hoverBg;
                e.currentTarget.style.borderColor = accentColor;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isUploaded ? '#f0fdf4' : '#fafafa';
              e.currentTarget.style.borderColor = isUploaded ? '#86efac' : '#cbd5e1';
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '4px', lineHeight: 1 }}>
              {fileZoneIcon}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: isUploaded ? '#15803d' : '#374151' }}>
              {fileZoneLabel}
            </div>
            {!isUploaded && !isUploading && (
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>Accepts {ext} format</div>
            )}
          </button>
        ) : (
          <>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', fontStyle: 'italic' }}>
              Paste a raw public URL pointing to a{' '}
              <code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: '3px' }}>{ext}</code> file
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="url"
                placeholder={urlPlaceholder}
                value={url}
                onChange={(e) => onUrlChange(e.target.value)}
                style={{ ...inputStyle, flex: 1, margin: 0, fontSize: '12px', padding: '8px 10px' }}
                onFocus={(e) => Object.assign(e.currentTarget.style, { ...inputFocusStyle, flex: '1', margin: '0', fontSize: '12px', padding: '8px 10px' })}
                onBlur={(e) => Object.assign(e.currentTarget.style, { ...inputStyle, flex: '1', margin: '0', fontSize: '12px', padding: '8px 10px' })}
                disabled={isUploading}
              />
              <button
                type="button"
                onClick={onUrlImport}
                disabled={isUploading || !url.trim()}
                style={{
                  padding: '8px 16px', border: 'none', borderRadius: '6px',
                  fontSize: '12px', fontWeight: 600, fontFamily: 'Georgia, serif',
                  cursor: isUploading || !url.trim() ? 'not-allowed' : 'pointer',
                  background: isUploaded ? '#22c55e' : '#049484',
                  color: '#ffffff',
                  opacity: isUploading || !url.trim() ? 0.5 : 1,
                  transition: 'all 0.2s', whiteSpace: 'nowrap',
                }}
              >
                {urlImportButtonLabel}
              </button>
            </div>
            {urlFileName && isUploaded && (
              <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>✅</span><span style={{ fontStyle: 'italic' }}>{urlFileName}</span>
              </div>
            )}
          </>
        )}
        {isUploading && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ ...progressBarContainerStyle }}>
              <div style={{ ...progressBarStyle, width: `${uploadProgress.progress}%` }} />
            </div>
            <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 3 }}>
              {Math.round(uploadProgress.progress)}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface FormActionButtonsProps {
  isLoading: boolean;
  isSubmitting: boolean;
  canSave: boolean;
  buttonText: string;
  onCancel: () => void;
  onSubmit: () => void;
}

const FormActionButtons: React.FC<FormActionButtonsProps> = ({
  isLoading, isSubmitting, canSave, buttonText, onCancel, onSubmit,
}) => {
  const isDisabled = isLoading || isSubmitting;
  return (
    <div style={buttonGroupStyle}>
      <button
        style={secondaryButtonStyle}
        onClick={onCancel}
        disabled={isDisabled}
        onMouseEnter={(e) => !isDisabled && Object.assign(e.currentTarget.style, buttonHoverStyle)}
        onMouseLeave={(e) => !isDisabled && Object.assign(e.currentTarget.style, secondaryButtonStyle)}
      >
        Cancel
      </button>
      <button
        style={{ ...primaryButtonStyle, ...(canSave && !isLoading ? {} : primaryButtonDisabledStyle) }}
        onClick={onSubmit}
        disabled={!canSave || isDisabled}
        onMouseEnter={(e) => canSave && !isDisabled && Object.assign(e.currentTarget.style, buttonHoverStyle)}
        onMouseLeave={(e) => canSave && !isDisabled && Object.assign(e.currentTarget.style, primaryButtonStyle)}
      >
        {buttonText}
      </button>
    </div>
  );
};

interface GenModelFixPromptProps {
  isLoading: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onApplyFixes: () => void;
}

const GenModelFixPrompt: React.FC<GenModelFixPromptProps> = ({
  isLoading, isSubmitting, onCancel, onApplyFixes,
}) => {
  const isDisabled = isLoading || isSubmitting;
  return (
    <div style={{
      marginTop: 20, padding: 14, borderRadius: 6,
      border: '1px solid #f59e0b', background: '#fffbeb',
      fontSize: 13, color: '#92400e',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        We detected issues in your GenModel.
      </div>
      <div style={{ marginBottom: 10 }}>
        Would you like to save the meta model by letting the system automatically modify the GenModel,
        or cancel this scenario?
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ ...secondaryButtonStyle, borderColor: '#f97316', color: '#92400e', padding: '8px 12px' }}
          disabled={isDisabled}
        >
          Cancel scenario
        </button>
        <button
          type="button"
          onClick={onApplyFixes}
          style={{ ...primaryButtonStyle, padding: '8px 12px' }}
          disabled={isDisabled}
        >
          Save with automatic GenModel fixes
        </button>
      </div>
    </div>
  );
};

// ─── Per-kind UI state shape ──────────────────────────────────────────────────

const EMPTY_PER_KIND = {
  ecore:    { inputMode: 'file' as 'file' | 'url', url: '', urlFileName: '' },
  genmodel: { inputMode: 'file' as 'file' | 'url', url: '', urlFileName: '' },
};

// ─── Custom hook ──────────────────────────────────────────────────────────────

function useCreateModelForm({ isOpen, onClose, onSuccess }: CreateModelModalProps) {
  const [formData, setFormData] = useState({
    name: '', description: '', domain: '', keywords: [] as string[],
  });
  const [uploadedFileIds, setUploadedFileIds] = useState({ ecoreFileId: 0, genModelFileId: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState({
    ecore: { progress: 0, isUploading: false },
    genmodel: { progress: 0, isUploading: false },
  });
  const [submitProgress, setSubmitProgress] = useState({ progress: 0, isSubmitting: false });
  const [metaModelCreatedSuccessfully, setMetaModelCreatedSuccessfully] = useState(false);
  const [showGenModelFixPrompt, setShowGenModelFixPrompt] = useState(false);
  const [pendingCreateRequest, setPendingCreateRequest] = useState<CreateModelRequest | null>(null);

  // Unified per-kind UI state (replaces 6 separate ecoreInputMode / genmodelUrl / … states)
  const [perKind, setPerKind] = useState(EMPTY_PER_KIND);

  const fileInputRefs = {
    ecore:    useRef<HTMLInputElement>(null),
    genmodel: useRef<HTMLInputElement>(null),
  };
  const ecoreProgressIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const genmodelProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submitProgressIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const successTimeoutRef           = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const progressResetTimeoutRef     = useRef<ReturnType<typeof setTimeout>  | null>(null);

  const canSave = uploadedFileIds.ecoreFileId > 0 &&
    uploadedFileIds.genModelFileId > 0 &&
    formData.name.trim() &&
    formData.description.trim() &&
    formData.domain.trim() &&
    formData.keywords.length > 0;

  // Stable ref-only cleanup – safe with empty deps
  const clearAllTimers = useCallback(() => {
    [ecoreProgressIntervalRef, genmodelProgressIntervalRef, submitProgressIntervalRef].forEach(ref => {
      if (ref.current) { clearInterval(ref.current); ref.current = null; }
    });
    [successTimeoutRef, progressResetTimeoutRef].forEach(ref => {
      if (ref.current) { clearTimeout(ref.current); ref.current = null; }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Per-kind helpers ──────────────────────────────────────────────────────

  const updateKind = (kind: FileKind, patch: Partial<typeof EMPTY_PER_KIND.ecore>) =>
    setPerKind(prev => ({ ...prev, [kind]: { ...prev[kind], ...patch } }));

  const switchFileMode = (kind: FileKind, mode: 'file' | 'url') => {
    updateKind(kind, { inputMode: mode, urlFileName: '' });
    setUploadedFileIds(prev => ({ ...prev, [FILE_KIND_CONFIG[kind].fileIdKey]: 0 }));
  };

  const changeFileUrl = (kind: FileKind, url: string) => {
    updateKind(kind, { url, urlFileName: '' });
    setUploadedFileIds(prev => ({ ...prev, [FILE_KIND_CONFIG[kind].fileIdKey]: 0 }));
  };

  // ── Progress simulation ───────────────────────────────────────────────────

  const scheduleSuccessReset = (kind: FileKind) => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    if (progressResetTimeoutRef.current) clearTimeout(progressResetTimeoutRef.current);
    successTimeoutRef.current = globalThis.setTimeout(() => setSuccess(''), 3000);
    progressResetTimeoutRef.current = globalThis.setTimeout(() => {
      setUploadProgress(prev => ({ ...prev, [kind]: { progress: 0, isUploading: false } }));
    }, 2000);
  };

  const startProgressSimulation = (kind: FileKind) => {
    const ref = kind === 'ecore' ? ecoreProgressIntervalRef : genmodelProgressIntervalRef;
    if (ref.current) clearInterval(ref.current);
    ref.current = globalThis.setInterval(() => {
      setUploadProgress(prev => ({
        ...prev,
        [kind]: { progress: Math.min(prev[kind].progress + 15, 90), isUploading: true },
      }));
    }, 200);
  };

  const stopProgressSimulation = (kind: FileKind) => {
    const ref = kind === 'ecore' ? ecoreProgressIntervalRef : genmodelProgressIntervalRef;
    if (ref.current) { clearInterval(ref.current); ref.current = null; }
  };

  // ── Submit overlay helpers ────────────────────────────────────────────────

  const clearSubmitInterval = () => {
    if (submitProgressIntervalRef.current) {
      clearInterval(submitProgressIntervalRef.current);
      submitProgressIntervalRef.current = null;
    }
  };

  const startSubmitOverlay = () => {
    clearSubmitInterval();
    setSubmitProgress({ progress: 0, isSubmitting: true });
    submitProgressIntervalRef.current = globalThis.setInterval(() => {
      setSubmitProgress(prev => ({
        progress: Math.min(prev.progress + Math.random() * 16 + 4, 90),
        isSubmitting: true,
      }));
    }, 220);
  };

  const finishSubmitOverlay = (onDone?: () => void) => {
    clearSubmitInterval();
    setSubmitProgress({ progress: 100, isSubmitting: true });
    setTimeout(() => {
      setSubmitProgress({ progress: 0, isSubmitting: false });
      onDone?.();
    }, 500);
  };

  const stopSubmitOverlayWithError = () => {
    clearSubmitInterval();
    setSubmitProgress({ progress: 0, isSubmitting: false });
  };

  // Shared setup called at the start of every submit action
  const prepareSubmit = () => {
    setIsLoading(true);
    setError('');
    setShowGenModelFixPrompt(false);
    startSubmitOverlay();
  };

  // Shared happy-path handler after a successful API call
  const onSubmitSuccess = (message: string, responseData: any) => {
    setMetaModelCreatedSuccessfully(true);
    finishSubmitOverlay(() => {
      setIsLoading(false);
      setSuccess(message);
      setTimeout(() => { onSuccess?.(responseData); handleClose(); }, 300);
    });
  };

  // ── File cleanup ──────────────────────────────────────────────────────────

  const cleanupUploadedFiles = async () => {
    if (metaModelCreatedSuccessfully) return;
    const filesToDelete = [uploadedFileIds.ecoreFileId, uploadedFileIds.genModelFileId].filter(id => id > 0);
    await Promise.all(
      filesToDelete.map(fileId =>
        apiService.deleteFile(fileId).catch(err => console.error(`Failed to delete file ${fileId}:`, err))
      )
    );
  };

  // ── Core handlers ─────────────────────────────────────────────────────────

  const handleClose = async () => {
    await cleanupUploadedFiles();
    clearAllTimers();
    setSubmitProgress({ progress: 0, isSubmitting: false });
    setFormData({ name: '', description: '', domain: '', keywords: [] });
    setUploadedFileIds({ ecoreFileId: 0, genModelFileId: 0 });
    setError('');
    setSuccess('');
    setIsLoading(false);
    setUploadProgress({ ecore: { progress: 0, isUploading: false }, genmodel: { progress: 0, isUploading: false } });
    setMetaModelCreatedSuccessfully(false);
    setPerKind(EMPTY_PER_KIND);
    onClose();
  };

  const handleFileUpload = async (kind: FileKind, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const { ext, apiType, fileIdKey } = FILE_KIND_CONFIG[kind];
    const currentFileId = uploadedFileIds[fileIdKey];

    if (!file.name.endsWith(ext)) { setError(`Please select a valid ${ext} file`); return; }

    setUploadProgress(prev => ({ ...prev, [kind]: { progress: 0, isUploading: true } }));
    setError('');

    try {
      if (currentFileId > 0) {
        await apiService.deleteFile(currentFileId)
          .catch(e => console.warn(`Failed to delete previous ${ext} file:`, e));
      }
      startProgressSimulation(kind);
      const response = await apiService.uploadFile(file, apiType);
      stopProgressSimulation(kind);
      setUploadProgress(prev => ({ ...prev, [kind]: { progress: 100, isUploading: false } }));
      setUploadedFileIds(prev => ({ ...prev, [fileIdKey]: extractFileId(response) }));
      setSuccess(`Successfully uploaded ${sanitizeFileName(file.name)}`);
      scheduleSuccessReset(kind);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(kind === 'ecore' ? msg : `Error uploading ${sanitizeFileName(file.name)}: ${msg}`);
      setUploadProgress(prev => ({ ...prev, [kind]: { progress: 0, isUploading: false } }));
      setUploadedFileIds(prev => ({ ...prev, [fileIdKey]: 0 }));
      stopProgressSimulation(kind);
    }
    event.target.value = '';
  };

  const handleUrlImport = async (kind: FileKind) => {
    const { ext, apiType, fileIdKey } = FILE_KIND_CONFIG[kind];
    const url = perKind[kind].url.trim();
    const currentFileId = uploadedFileIds[fileIdKey];

    if (!url) { setError(`Please enter a URL for the ${ext} file`); return; }
    const urlPath = url.split('?')[0];
    if (!urlPath.endsWith(ext)) {
      setError(`URL must point to a ${ext} file (ending with ${ext})`);
      return;
    }

    setUploadProgress(prev => ({ ...prev, [kind]: { progress: 0, isUploading: true } }));
    setError('');

    try {
      if (currentFileId > 0) {
        await apiService.deleteFile(currentFileId)
          .catch(e => console.warn(`Failed to delete previous ${ext} file:`, e));
      }
      startProgressSimulation(kind);
      const fetchResponse = await fetch(url);
      if (!fetchResponse.ok) {
        throw new Error(`Could not fetch file: ${fetchResponse.status} ${fetchResponse.statusText}`);
      }
      const blob = await fetchResponse.blob();
      const fileName = urlPath.split('/').pop() || `imported${ext}`;
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      const response = await apiService.uploadFile(file, apiType);
      stopProgressSimulation(kind);
      setUploadProgress(prev => ({ ...prev, [kind]: { progress: 100, isUploading: false } }));
      setUploadedFileIds(prev => ({ ...prev, [fileIdKey]: extractFileId(response) }));
      updateKind(kind, { urlFileName: sanitizeFileName(fileName) });
      setSuccess(`Successfully imported ${sanitizeFileName(fileName)}`);
      scheduleSuccessReset(kind);
    } catch (err) {
      setError(`Failed to import ${ext} from URL: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setUploadProgress(prev => ({ ...prev, [kind]: { progress: 0, isUploading: false } }));
      setUploadedFileIds(prev => ({ ...prev, [fileIdKey]: 0 }));
      updateKind(kind, { urlFileName: '' });
      stopProgressSimulation(kind);
    }
  };

  const handleCreateModel = async () => {
    if (!formData.name.trim()) { setError('Please enter a name'); return; }
    if (!formData.description.trim()) { setError('Please enter a description'); return; }
    if (!formData.domain.trim()) { setError('Please enter a domain'); return; }
    if (formData.keywords.length === 0) { setError('Please enter at least one keyword'); return; }
    if (!uploadedFileIds.ecoreFileId || !uploadedFileIds.genModelFileId) {
      setError('Please upload both .ecore and .genmodel files');
      return;
    }

    prepareSubmit();

    try {
      const requestData: CreateModelRequest = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        domain: formData.domain.trim(),
        keyword: formData.keywords,
        ecoreFileId: uploadedFileIds.ecoreFileId,
        genModelFileId: uploadedFileIds.genModelFileId,
      };
      setPendingCreateRequest(requestData);
      const response = await apiService.createMetaModel({ ...requestData, applyGenModelFixes: false });
      onSubmitSuccess('Meta Model created successfully!', response.data);
    } catch (err) {
      const { message, isMetamodelRejected } = parseBackendError(err);
      setIsLoading(false);
      stopSubmitOverlayWithError();
      if (isMetamodelRejected) {
        setError(
          `We found some issues in your GenModel: ${message}. ` +
          'You can let the system modify the GenModel automatically or cancel this operation.'
        );
        setShowGenModelFixPrompt(true);
        return;
      }
      setError(`Error creating meta model: ${message}`);
      await cleanupUploadedFiles();
    }
  };

  const handleApplyGenModelFixes = async () => {
    if (!pendingCreateRequest) return;
    prepareSubmit();

    try {
      const response = await apiService.createMetaModel({ ...pendingCreateRequest, applyGenModelFixes: true });
      onSubmitSuccess('Meta Model created successfully with automatic GenModel fixes.', response.data);
    } catch (err) {
      const { message } = parseBackendError(err);
      setIsLoading(false);
      stopSubmitOverlayWithError();
      setError(`Error creating meta model with automatic GenModel fixes: ${message}`);
      await cleanupUploadedFiles();
    }
  };

  const handleCancelGenModelFixScenario = () => {
    setShowGenModelFixPrompt(false);
    handleClose();
  };

  const getButtonText = (): string => {
    if (isLoading) return 'Creating...';
    if (canSave) return 'Import Meta Model';
    return 'Complete All Fields';
  };

  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
    clearAllTimers();
    setSubmitProgress({ progress: 0, isSubmitting: false });
    setUploadProgress({ ecore: { progress: 0, isUploading: false }, genmodel: { progress: 0, isUploading: false } });
    return clearAllTimers;
  }, [isOpen, clearAllTimers]);

  return {
    formData, setFormData,
    uploadedFileIds,
    isLoading,
    error, success,
    uploadProgress, submitProgress,
    showGenModelFixPrompt,
    perKind,
    fileInputRefs,
    canSave,
    handleFileUpload, handleUrlImport,
    handleCreateModel, handleApplyGenModelFixes,
    handleCancelGenModelFixScenario, handleClose,
    switchFileMode, changeFileUrl,
    getButtonText,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export const CreateModelModal: React.FC<CreateModelModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const form = useCreateModelForm({ isOpen, onClose, onSuccess });

  if (!isOpen) return null;

  const { uploadedFileIds, uploadProgress, submitProgress, isLoading } = form;

  return ReactDOM.createPortal(
    <>
      {submitProgress.isSubmitting && <SubmitProgressOverlay progress={submitProgress.progress} />}

      <dialog
        open
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        style={{
          ...modalOverlayStyle,
          background: 'transparent',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          top: 0, left: 0, right: 0, bottom: 0,
          width: '100%', height: '100%',
          margin: 0, padding: 0, border: 'none',
        }}
        onClose={form.handleClose}
        onCancel={form.handleClose}
        onClick={(e) => { if (e.target === e.currentTarget) form.handleClose(); }}
        onKeyDown={(e) => { if (e.key === 'Escape') form.handleClose(); }}
      >
        <div style={modalStyle}>
          <div style={modalHeaderStyle}>
            <h2 id="modal-title" style={modalTitleStyle}>Import Meta Model</h2>
            <button
              style={closeButtonStyle}
              onClick={form.handleClose}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, closeButtonHoverStyle)}
              onMouseLeave={(e) => Object.assign(e.currentTarget.style, closeButtonStyle)}
            >
              ×
            </button>
          </div>

          {form.error && <div style={errorMessageStyle}>{form.error}</div>}
          {form.success && <div style={successMessageStyle}>{form.success}</div>}

          <div style={formGroupStyle}>
            <label htmlFor="model-name-input" style={labelStyle}>Name *</label>
            <input
              id="model-name-input"
              type="text"
              placeholder="Enter meta model name..."
              value={form.formData.name}
              onChange={(e) => form.setFormData({ ...form.formData, name: e.target.value })}
              style={inputStyle}
              onFocus={(e) => Object.assign(e.currentTarget.style, inputFocusStyle)}
              onBlur={(e) => Object.assign(e.currentTarget.style, inputStyle)}
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="model-description-input" style={labelStyle}>Description *</label>
            <textarea
              id="model-description-input"
              placeholder="Enter description..."
              value={form.formData.description}
              onChange={(e) => form.setFormData({ ...form.formData, description: e.target.value })}
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
              onFocus={(e) => Object.assign(e.currentTarget.style, inputFocusStyle)}
              onBlur={(e) => Object.assign(e.currentTarget.style, inputStyle)}
            />
          </div>

          <div style={formGroupStyle}>
            <label id="model-keywords-label" style={labelStyle}>Keywords *</label>
            <KeywordTagsInput
              aria-labelledby="model-keywords-label"
              keywords={form.formData.keywords}
              onChange={(keywords) => form.setFormData({ ...form.formData, keywords })}
              placeholder="Type keywords and press Enter..."
              style={inputStyle}
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="model-domain-input" style={labelStyle}>Domain *</label>
            <input
              id="model-domain-input"
              type="text"
              placeholder="Enter domain"
              value={form.formData.domain}
              onChange={(e) => form.setFormData({ ...form.formData, domain: e.target.value })}
              style={inputStyle}
              onFocus={(e) => Object.assign(e.currentTarget.style, inputFocusStyle)}
              onBlur={(e) => Object.assign(e.currentTarget.style, inputStyle)}
            />
          </div>

          {/* File Upload Section */}
          <div style={uploadSectionStyle}>
            <div style={uploadSectionTitleStyle}>Required Meta Model Files</div>

            {FILE_CARD_DISPLAY_CONFIGS.map(({ kind, accentColor, hoverBg, badgeBg, badgeBorder, badgeColor, defaultHeaderBg }) => {
              const { ext, fileIdKey } = FILE_KIND_CONFIG[kind];
              const fileId = uploadedFileIds[fileIdKey];
              const { inputMode, url, urlFileName } = form.perKind[kind];
              return (
                <React.Fragment key={kind}>
                  <input
                    ref={form.fileInputRefs[kind]}
                    type="file"
                    accept={ext}
                    onChange={(e) => form.handleFileUpload(kind, e)}
                    style={fileInputStyle}
                  />
                  <FileUploadCard
                    ext={ext}
                    accentColor={accentColor}
                    hoverBg={hoverBg}
                    badgeBg={badgeBg}
                    badgeBorder={badgeBorder}
                    badgeColor={badgeColor}
                    headerBg={fileId > 0 ? '#f0fdf4' : defaultHeaderBg}
                    fileId={fileId}
                    inputMode={inputMode}
                    uploadProgress={uploadProgress[kind]}
                    url={url}
                    urlFileName={urlFileName}
                    urlPlaceholder={`https://raw.githubusercontent.com/…/model${ext}`}
                    onModeChange={(mode) => form.switchFileMode(kind, mode)}
                    onFileInputClick={() => form.fileInputRefs[kind].current?.click()}
                    onUrlChange={(newUrl) => form.changeFileUrl(kind, newUrl)}
                    onUrlImport={() => form.handleUrlImport(kind)}
                  />
                </React.Fragment>
              );
            })}

            <div style={fileStatusStyle}>
              {uploadedFileIds.ecoreFileId > 0 && uploadedFileIds.genModelFileId > 0
                ? '✅ Both files ready!'
                : 'Upload or import both files to continue'}
            </div>
          </div>

          <FormActionButtons
            isLoading={isLoading}
            isSubmitting={submitProgress.isSubmitting}
            canSave={!!form.canSave}
            buttonText={form.getButtonText()}
            onCancel={form.handleClose}
            onSubmit={form.handleCreateModel}
          />

          {form.showGenModelFixPrompt && (
            <GenModelFixPrompt
              isLoading={isLoading}
              isSubmitting={submitProgress.isSubmitting}
              onCancel={form.handleCancelGenModelFixScenario}
              onApplyFixes={form.handleApplyGenModelFixes}
            />
          )}
        </div>
      </dialog>
    </>,
    document.body
  );
};
