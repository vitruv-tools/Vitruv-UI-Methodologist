import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { apiService } from '../../services/api';
import { KeywordTagsInput } from './KeywordTagsInput';
import {
  modalOverlayStyle,
  formGroupStyle,
  labelStyle,
  inputStyle,
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

/** Form regions used for inline errors + scroll-into-view */
export type CreateModelFieldKey = 'name' | 'description' | 'keywords' | 'domain' | 'files';

const EMPTY_FIELD_ERRORS: Record<CreateModelFieldKey, string> = {
  name: '',
  description: '',
  keywords: '',
  domain: '',
  files: '',
};

/** Best-effort mapping of API messages to a field (otherwise use `files`). */
function inferFieldKeyFromBackendMessage(message: string): CreateModelFieldKey | null {
  const m = message.toLowerCase();
  if (/\b(keyword|keywords)\b/.test(m)) return 'keywords';
  if (/\bdescription\b/.test(m)) return 'description';
  if (/\bdomain\b/.test(m)) return 'domain';
  if (/\b(ecore|genmodel|gen model|file id|upload|metamodel|precheck)\b/.test(m)) return 'files';
  if (/\b(name|title)\b/.test(m) && !/\b(genmodel|filename|file name|file\.)\b/.test(m)) return 'name';
  return null;
}

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

/** Shown inside the “Required Meta Model Files” box when POST /meta-models fails. */
const metaModelImportErrorBannerStyle: React.CSSProperties = {
  marginBottom: '14px',
  padding: '10px 12px',
  background: '#fef2f2',
  border: '1px solid #fca5a5',
  borderRadius: '6px',
  fontSize: '13px',
  color: '#991b1b',
  lineHeight: 1.45,
  fontFamily: 'Georgia, serif',
};

const fieldInlineErrorStyle: React.CSSProperties = {
  marginTop: '6px',
  fontSize: '12px',
  color: '#b91c1c',
  lineHeight: 1.45,
  fontFamily: 'Georgia, serif',
};

const inputErrorOutlineStyle: React.CSSProperties = {
  borderColor: '#f87171',
  background: '#fffafa',
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

// ─── Upload-state label lookup (avoids nested ternaries) ─────────────────────

const UPLOAD_STATE_LABELS = {
  uploading: { icon: '⏳', dropLabel: 'Uploading…',                       importLabel: '⏳ …'    },
  uploaded:  { icon: '✅', dropLabel: 'File uploaded — click to replace', importLabel: '✓ Done' },
  idle:      { icon: '📂', dropLabel: 'Click to browse file',             importLabel: 'Import'  },
} as const;

type UploadState = keyof typeof UPLOAD_STATE_LABELS;

// Shared base for the file/URL mode toggle buttons
const modeButtonBaseStyle: React.CSSProperties = {
  padding: '4px 11px', fontSize: '11px', fontWeight: 600, border: 'none',
  borderRadius: '4px', cursor: 'pointer', fontFamily: 'Georgia, serif',
  transition: 'all 0.15s', whiteSpace: 'nowrap',
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

// ── FileDropZone: file-picker button (file mode body) ────────────────────────

interface FileDropZoneProps {
  isUploaded: boolean;
  isUploading: boolean;
  ext: string;
  hoverBg: string;
  accentColor: string;
  icon: string;
  label: string;
  labelColor: string;
  /** Original filename when uploaded from this device (file mode) */
  uploadedFileName?: string;
  onClick: () => void;
}

const FileDropZone: React.FC<FileDropZoneProps> = ({
  isUploaded, isUploading, ext, hoverBg, accentColor, icon, label, labelColor, uploadedFileName, onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
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
    <div style={{ fontSize: '20px', marginBottom: '4px', lineHeight: 1 }}>{icon}</div>
    <div style={{ fontSize: '13px', fontWeight: 600, color: labelColor }}>{label}</div>
    {isUploaded && !isUploading && uploadedFileName && (
      <div
        title={uploadedFileName}
        style={{
          fontSize: '12px',
          color: '#166534',
          marginTop: '6px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          wordBreak: 'break-word',
          lineHeight: 1.35,
        }}
      >
        {uploadedFileName}
      </div>
    )}
    {!isUploaded && !isUploading && (
      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>Accepts {ext} format</div>
    )}
  </button>
);

// ── UrlImportRow: URL input + import button (URL mode body) ───────────────────

interface UrlImportRowProps {
  ext: string;
  url: string;
  urlFileName: string;
  isUploaded: boolean;
  isUploading: boolean;
  urlPlaceholder: string;
  importLabel: string;
  onUrlChange: (url: string) => void;
  onUrlImport: () => void;
}

const UrlImportRow: React.FC<UrlImportRowProps> = ({
  ext, url, urlFileName, isUploaded, isUploading, urlPlaceholder, importLabel,
  onUrlChange, onUrlImport,
}) => {
  const isDisabled = isUploading || !url.trim();
  return (
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
          disabled={isDisabled}
          style={{
            padding: '8px 16px', border: 'none', borderRadius: '6px',
            fontSize: '12px', fontWeight: 600, fontFamily: 'Georgia, serif',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            background: isUploaded ? '#22c55e' : '#049484',
            color: '#ffffff',
            opacity: isDisabled ? 0.5 : 1,
            transition: 'all 0.2s', whiteSpace: 'nowrap',
          }}
        >
          {importLabel}
        </button>
      </div>
      {urlFileName && isUploaded && (
        <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>✅</span><span style={{ fontStyle: 'italic' }}>{urlFileName}</span>
        </div>
      )}
    </>
  );
};

// ── FileUploadCard ────────────────────────────────────────────────────────────

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
  uploadError: string;
  /** Filename when the current upload came from the device (file mode) */
  localFileName: string;
  onModeChange: (mode: 'file' | 'url') => void;
  onFileInputClick: () => void;
  onUrlChange: (url: string) => void;
  onUrlImport: () => void;
  /** Clear this slot and delete the file on the server so the user can upload again */
  onClearUpload: () => void;
  removeDisabled: boolean;
}

const FileUploadCard: React.FC<FileUploadCardProps> = ({
  ext, accentColor, hoverBg, badgeBg, badgeBorder, badgeColor, headerBg,
  fileId, inputMode, uploadProgress, url, urlFileName, urlPlaceholder,
  uploadError, localFileName, onModeChange, onFileInputClick, onUrlChange, onUrlImport,
  onClearUpload, removeDisabled,
}) => {
  const isUploaded = fileId > 0;
  const isUploading = uploadProgress.isUploading;

  // Derive upload state once; look up all display strings from the table
  let uploadState: UploadState = 'idle';
  if (isUploading) uploadState = 'uploading';
  else if (isUploaded) uploadState = 'uploaded';
  const { icon, dropLabel, importLabel } = UPLOAD_STATE_LABELS[uploadState];

  // Pre-compute styles that contain ternaries to keep JSX branch-free
  const cardStyle: React.CSSProperties = {
    background: '#ffffff',
    border: `1px solid ${isUploaded ? '#86efac' : '#e2e8f0'}`,
    borderLeft: `3px solid ${isUploaded ? '#22c55e' : accentColor}`,
    borderRadius: '8px', marginBottom: '12px', overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  };
  const fileModeStyle: React.CSSProperties = {
    ...modeButtonBaseStyle,
    background: inputMode === 'file' ? '#049484' : 'transparent',
    color:      inputMode === 'file' ? '#ffffff'  : '#64748b',
  };
  const urlModeStyle: React.CSSProperties = {
    ...modeButtonBaseStyle,
    background: inputMode === 'url' ? '#049484' : 'transparent',
    color:      inputMode === 'url' ? '#ffffff'  : '#64748b',
  };
  const labelColor = isUploaded ? '#15803d' : '#374151';

  return (
    <div style={cardStyle}>
      {/* card header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 14px', background: headerBg, borderBottom: '1px solid #e2e8f0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          <code style={{
            background: badgeBg, color: badgeColor, fontSize: '12px', fontWeight: 700,
            padding: '2px 8px', borderRadius: '4px', border: `1px solid ${badgeBorder}`,
            letterSpacing: '0.02em',
          }}>{ext}</code>
          {isUploaded && (
            <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>✓ Ready</span>
          )}
          {isUploaded && (
            <button
              type="button"
              onClick={onClearUpload}
              disabled={removeDisabled}
              title="Remove this file and upload a different one"
              style={{
                marginLeft: '4px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'Georgia, serif',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: '#fff',
                color: '#6b7280',
                cursor: removeDisabled ? 'not-allowed' : 'pointer',
                opacity: removeDisabled ? 0.5 : 1,
              }}
            >
              Remove
            </button>
          )}
        </div>
        {/* segmented toggle */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '2px', gap: '2px', flexShrink: 0 }}>
          <button type="button" onClick={() => onModeChange('file')} style={fileModeStyle}>⬆ Computer</button>
          <button type="button" onClick={() => onModeChange('url')}  style={urlModeStyle}>🔗 URL</button>
        </div>
      </div>

      {/* card body */}
      <div style={{ padding: '12px 14px' }}>
        {inputMode === 'file' ? (
          <FileDropZone
            isUploaded={isUploaded} isUploading={isUploading}
            ext={ext} hoverBg={hoverBg} accentColor={accentColor}
            icon={icon} label={dropLabel} labelColor={labelColor}
            uploadedFileName={localFileName}
            onClick={onFileInputClick}
          />
        ) : (
          <UrlImportRow
            ext={ext} url={url} urlFileName={urlFileName}
            isUploaded={isUploaded} isUploading={isUploading}
            urlPlaceholder={urlPlaceholder} importLabel={importLabel}
            onUrlChange={onUrlChange} onUrlImport={onUrlImport}
          />
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
        {uploadError && (
          <div style={{
            marginTop: '8px', padding: '7px 10px',
            background: '#fef2f2', border: '1px solid #fca5a5',
            borderRadius: '6px', fontSize: '12px', color: '#b91c1c',
            display: 'flex', alignItems: 'flex-start', gap: '6px',
          }}>
            <span style={{ flexShrink: 0 }}>⚠️</span>
            <span>{uploadError}</span>
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
  ecore:    { inputMode: 'file' as 'file' | 'url', url: '', urlFileName: '', localFileName: '', uploadError: '' },
  genmodel: { inputMode: 'file' as 'file' | 'url', url: '', urlFileName: '', localFileName: '', uploadError: '' },
};

const getUploadedDisplayName = (kindState: (typeof EMPTY_PER_KIND)['ecore']): string =>
  kindState.inputMode === 'url' ? kindState.urlFileName : kindState.localFileName;

// ─── Custom hook ──────────────────────────────────────────────────────────────

function useCreateModelForm({ isOpen, onClose, onSuccess }: CreateModelModalProps) {
  const [formData, setFormData] = useState({
    name: '', description: '', domain: '', keywords: [] as string[],
  });
  const [uploadedFileIds, setUploadedFileIds] = useState({ ecoreFileId: 0, genModelFileId: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<CreateModelFieldKey, string>>(() => ({ ...EMPTY_FIELD_ERRORS }));
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState({
    ecore: { progress: 0, isUploading: false },
    genmodel: { progress: 0, isUploading: false },
  });
  const [submitProgress, setSubmitProgress] = useState({ progress: 0, isSubmitting: false });
  const [metaModelCreatedSuccessfully, setMetaModelCreatedSuccessfully] = useState(false);
  const [showGenModelFixPrompt, setShowGenModelFixPrompt] = useState(false);
  const [pendingCreateRequest, setPendingCreateRequest] = useState<CreateModelRequest | null>(null);
  const [scrollTarget, setScrollTarget] = useState<CreateModelFieldKey | null>(null);

  // Unified per-kind UI state (replaces 6 separate ecoreInputMode / genmodelUrl / … states)
  const [perKind, setPerKind] = useState(EMPTY_PER_KIND);

  const nameFieldRef = useRef<HTMLDivElement>(null);
  const descriptionFieldRef = useRef<HTMLDivElement>(null);
  const keywordsFieldRef = useRef<HTMLDivElement>(null);
  const domainFieldRef = useRef<HTMLDivElement>(null);
  const filesSectionRef = useRef<HTMLDivElement>(null);

  const fileInputRefs = {
    ecore:    useRef<HTMLInputElement>(null),
    genmodel: useRef<HTMLInputElement>(null),
  };
  const ecoreProgressIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const genmodelProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submitProgressIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const successTimeoutRef           = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const progressResetTimeoutRef     = useRef<ReturnType<typeof setTimeout>  | null>(null);

  const fieldSectionRefs: Record<CreateModelFieldKey, React.RefObject<HTMLDivElement | null>> = {
    name: nameFieldRef,
    description: descriptionFieldRef,
    keywords: keywordsFieldRef,
    domain: domainFieldRef,
    files: filesSectionRef,
  };

  const fieldSectionRefsRef = useRef(fieldSectionRefs);
  fieldSectionRefsRef.current = fieldSectionRefs;

  useLayoutEffect(() => {
    if (!scrollTarget) return;
    const el = fieldSectionRefsRef.current[scrollTarget].current;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setScrollTarget(null);
  }, [scrollTarget]);

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
    const prevId = uploadedFileIds[FILE_KIND_CONFIG[kind].fileIdKey];
    if (prevId > 0) {
      apiService.deleteFile(prevId).catch(e => console.warn(`Failed to delete ${kind} file on mode switch:`, e));
    }
    updateKind(kind, { inputMode: mode, urlFileName: '', localFileName: '', uploadError: '' });
    setUploadedFileIds(prev => ({ ...prev, [FILE_KIND_CONFIG[kind].fileIdKey]: 0 }));
    setFieldErrors(prev => ({ ...prev, files: '' }));
  };

  const changeFileUrl = (kind: FileKind, url: string) => {
    // Delete the previously uploaded file the first time the user edits the URL
    // (prevId will be 0 on subsequent keystrokes, so this fires only once per upload)
    const prevId = uploadedFileIds[FILE_KIND_CONFIG[kind].fileIdKey];
    if (prevId > 0) {
      apiService.deleteFile(prevId).catch(e => console.warn(`Failed to delete ${kind} file on URL change:`, e));
    }
    updateKind(kind, { url, urlFileName: '', localFileName: '', uploadError: '' });
    setUploadedFileIds(prev => ({ ...prev, [FILE_KIND_CONFIG[kind].fileIdKey]: 0 }));
    setFieldErrors(prev => ({ ...prev, files: '' }));
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
        progress: Math.min(prev.progress + 10, 90),
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
    setFieldErrors({ ...EMPTY_FIELD_ERRORS });
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

  /** Resets local upload UI after server deletes files (so we do not keep stale “Ready” with dead IDs). */
  const resetLocalUploadStateAfterImportFailure = () => {
    setUploadedFileIds({ ecoreFileId: 0, genModelFileId: 0 });
    setPerKind(EMPTY_PER_KIND);
  };

  const clearKindUpload = async (kind: FileKind) => {
    const { fileIdKey } = FILE_KIND_CONFIG[kind];
    const id = uploadedFileIds[fileIdKey];
    if (id > 0) {
      await apiService.deleteFile(id).catch(err => console.warn(`Failed to delete ${kind} file:`, err));
    }
    setUploadedFileIds(prev => ({ ...prev, [fileIdKey]: 0 }));
    updateKind(kind, { urlFileName: '', localFileName: '', uploadError: '' });
    setFieldErrors(prev => ({ ...prev, files: '' }));
  };

  // ── Core handlers ─────────────────────────────────────────────────────────

  const handleClose = async () => {
    await cleanupUploadedFiles();
    clearAllTimers();
    setSubmitProgress({ progress: 0, isSubmitting: false });
    setFormData({ name: '', description: '', domain: '', keywords: [] });
    setUploadedFileIds({ ecoreFileId: 0, genModelFileId: 0 });
    setFieldErrors({ ...EMPTY_FIELD_ERRORS });
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

    if (!file.name.endsWith(ext)) {
      updateKind(kind, { uploadError: `Please select a valid ${ext} file` });
      return;
    }

    setUploadProgress(prev => ({ ...prev, [kind]: { progress: 0, isUploading: true } }));
    updateKind(kind, { uploadError: '' });
    setFieldErrors(prev => ({ ...prev, files: '' }));

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
      updateKind(kind, { localFileName: sanitizeFileName(file.name) });
      setSuccess(`Successfully uploaded ${sanitizeFileName(file.name)}`);
      scheduleSuccessReset(kind);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      updateKind(kind, { uploadError: `Error uploading ${sanitizeFileName(file.name)}: ${msg}`, localFileName: '' });
      setUploadProgress(prev => ({ ...prev, [kind]: { progress: 0, isUploading: false } }));
      setUploadedFileIds(prev => ({ ...prev, [fileIdKey]: 0 }));
      stopProgressSimulation(kind);
    }
    event.target.value = '';
  };

  const handleUrlImport = async (kind: FileKind) => {
    const { ext, apiType, fileIdKey } = FILE_KIND_CONFIG[kind];
    const currentFileId = uploadedFileIds[fileIdKey];

    // Auto-convert GitHub blob page URLs to raw content URLs
    const rawUrl = perKind[kind].url.trim().replace(
      /^https?:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)$/,
      'https://raw.githubusercontent.com/$1/$2',
    );

    if (!rawUrl) {
      updateKind(kind, { uploadError: `Please enter a URL for the ${ext} file` });
      return;
    }
    const urlPath = rawUrl.split('?')[0];
    if (!urlPath.endsWith(ext)) {
      updateKind(kind, { uploadError: `URL must point to a ${ext} file (ending with ${ext})` });
      return;
    }

    // Reflect the (possibly converted) URL back into the input
    if (rawUrl !== perKind[kind].url.trim()) {
      updateKind(kind, { url: rawUrl });
    }

    setUploadProgress(prev => ({ ...prev, [kind]: { progress: 0, isUploading: true } }));
    updateKind(kind, { uploadError: '' });
    setFieldErrors(prev => ({ ...prev, files: '' }));

    try {
      if (currentFileId > 0) {
        await apiService.deleteFile(currentFileId)
          .catch(e => console.warn(`Failed to delete previous ${ext} file:`, e));
      }
      startProgressSimulation(kind);
      const fetchResponse = await fetch(rawUrl);
      if (!fetchResponse.ok) {
        throw new Error(`Server returned ${fetchResponse.status} ${fetchResponse.statusText}`);
      }
      const blob = await fetchResponse.blob();
      const fileName = urlPath.split('/').pop() || `imported${ext}`;
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      const response = await apiService.uploadFile(file, apiType);
      stopProgressSimulation(kind);
      setUploadProgress(prev => ({ ...prev, [kind]: { progress: 100, isUploading: false } }));
      setUploadedFileIds(prev => ({ ...prev, [fileIdKey]: extractFileId(response) }));
      updateKind(kind, { urlFileName: sanitizeFileName(fileName), localFileName: '' });
      setSuccess(`Successfully imported ${sanitizeFileName(fileName)}`);
      scheduleSuccessReset(kind);
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Unknown error';
      const isCors = raw === 'Failed to fetch';
      const uploadError = isCors
        ? `Cannot reach that URL from the browser (CORS policy). Use a raw public URL — e.g. raw.githubusercontent.com — or download the file and upload it locally.`
        : `Failed to import ${ext} from URL: ${raw}`;
      updateKind(kind, { uploadError, urlFileName: '', localFileName: '' });
      setUploadProgress(prev => ({ ...prev, [kind]: { progress: 0, isUploading: false } }));
      setUploadedFileIds(prev => ({ ...prev, [fileIdKey]: 0 }));
      stopProgressSimulation(kind);
    }
  };

  const validateClientFields = (): boolean => {
    const next = { ...EMPTY_FIELD_ERRORS };
    if (!formData.name.trim()) next.name = 'Please enter a name';
    if (!formData.description.trim()) next.description = 'Please enter a description';
    if (!formData.domain.trim()) next.domain = 'Please enter a domain';
    if (formData.keywords.length === 0) next.keywords = 'Please enter at least one keyword';
    if (!uploadedFileIds.ecoreFileId || !uploadedFileIds.genModelFileId) {
      next.files = 'Please upload both .ecore and .genmodel files';
    }
    const order: CreateModelFieldKey[] = ['name', 'description', 'keywords', 'domain', 'files'];
    const first = order.find(k => next[k]);
    if (first) {
      setFieldErrors(next);
      setScrollTarget(first);
      return false;
    }
    setFieldErrors({ ...EMPTY_FIELD_ERRORS });
    return true;
  };

  const handleCreateModel = async () => {
    if (!validateClientFields()) return;

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
        setFieldErrors({
          ...EMPTY_FIELD_ERRORS,
          files:
            `We found some issues in your GenModel: ${message}. ` +
            'You can let the system modify the GenModel automatically or cancel this operation.',
        });
        setScrollTarget('files');
        setShowGenModelFixPrompt(true);
        return;
      }
      await cleanupUploadedFiles();
      resetLocalUploadStateAfterImportFailure();
      const full = `Error creating meta model: ${message}`;
      const inferred = inferFieldKeyFromBackendMessage(message);
      if (inferred) {
        setFieldErrors({ ...EMPTY_FIELD_ERRORS, [inferred]: full });
        setScrollTarget(inferred);
      } else {
        setFieldErrors({ ...EMPTY_FIELD_ERRORS, files: full });
        setScrollTarget('files');
      }
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
      await cleanupUploadedFiles();
      resetLocalUploadStateAfterImportFailure();
      const full = `Error creating meta model with automatic GenModel fixes: ${message}`;
      const inferred = inferFieldKeyFromBackendMessage(message);
      if (inferred) {
        setFieldErrors({ ...EMPTY_FIELD_ERRORS, [inferred]: full });
        setScrollTarget(inferred);
      } else {
        setFieldErrors({ ...EMPTY_FIELD_ERRORS, files: full });
        setScrollTarget('files');
      }
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
    fieldErrors,
    setFieldErrors,
    fieldSectionRefs,
    success,
    uploadProgress, submitProgress,
    showGenModelFixPrompt,
    perKind,
    fileInputRefs,
    canSave,
    handleFileUpload, handleUrlImport,
    handleCreateModel, handleApplyGenModelFixes,
    handleCancelGenModelFixScenario, handleClose,
    switchFileMode, changeFileUrl,
    clearKindUpload,
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

          {form.success && <div style={successMessageStyle}>{form.success}</div>}

          <div ref={form.fieldSectionRefs.name} style={formGroupStyle}>
            <label htmlFor="model-name-input" style={labelStyle}>Name *</label>
            <input
              id="model-name-input"
              type="text"
              placeholder="Enter meta model name..."
              value={form.formData.name}
              onChange={(e) => {
                form.setFormData({ ...form.formData, name: e.target.value });
                if (form.fieldErrors.name) form.setFieldErrors(prev => ({ ...prev, name: '' }));
              }}
              aria-invalid={!!form.fieldErrors.name}
              aria-describedby={form.fieldErrors.name ? 'model-name-error' : undefined}
              style={{ ...inputStyle, ...(form.fieldErrors.name ? inputErrorOutlineStyle : {}) }}
              onFocus={(e) => Object.assign(e.currentTarget.style, { ...inputFocusStyle, ...(form.fieldErrors.name ? inputErrorOutlineStyle : {}) })}
              onBlur={(e) => Object.assign(e.currentTarget.style, { ...inputStyle, ...(form.fieldErrors.name ? inputErrorOutlineStyle : {}) })}
            />
            {form.fieldErrors.name && (
              <div id="model-name-error" role="alert" style={fieldInlineErrorStyle}>{form.fieldErrors.name}</div>
            )}
          </div>

          <div ref={form.fieldSectionRefs.description} style={formGroupStyle}>
            <label htmlFor="model-description-input" style={labelStyle}>Description *</label>
            <textarea
              id="model-description-input"
              placeholder="Enter description..."
              value={form.formData.description}
              onChange={(e) => {
                form.setFormData({ ...form.formData, description: e.target.value });
                if (form.fieldErrors.description) form.setFieldErrors(prev => ({ ...prev, description: '' }));
              }}
              aria-invalid={!!form.fieldErrors.description}
              aria-describedby={form.fieldErrors.description ? 'model-description-error' : undefined}
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit', ...(form.fieldErrors.description ? inputErrorOutlineStyle : {}) }}
              onFocus={(e) => Object.assign(e.currentTarget.style, { ...inputFocusStyle, ...(form.fieldErrors.description ? inputErrorOutlineStyle : {}) })}
              onBlur={(e) => Object.assign(e.currentTarget.style, { ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit', ...(form.fieldErrors.description ? inputErrorOutlineStyle : {}) })}
            />
            {form.fieldErrors.description && (
              <div id="model-description-error" role="alert" style={fieldInlineErrorStyle}>{form.fieldErrors.description}</div>
            )}
          </div>

          <div ref={form.fieldSectionRefs.keywords} style={formGroupStyle}>
            <label id="model-keywords-label" style={labelStyle}>Keywords *</label>
            <KeywordTagsInput
              aria-labelledby="model-keywords-label"
              keywords={form.formData.keywords}
              onChange={(keywords) => {
                form.setFormData({ ...form.formData, keywords });
                if (form.fieldErrors.keywords) form.setFieldErrors(prev => ({ ...prev, keywords: '' }));
              }}
              placeholder="Type keywords and press Enter..."
              style={{ ...inputStyle, ...(form.fieldErrors.keywords ? inputErrorOutlineStyle : {}) }}
            />
            {form.fieldErrors.keywords && (
              <div id="model-keywords-error" role="alert" style={fieldInlineErrorStyle}>{form.fieldErrors.keywords}</div>
            )}
          </div>

          <div ref={form.fieldSectionRefs.domain} style={formGroupStyle}>
            <label htmlFor="model-domain-input" style={labelStyle}>Domain *</label>
            <input
              id="model-domain-input"
              type="text"
              placeholder="Enter domain"
              value={form.formData.domain}
              onChange={(e) => {
                form.setFormData({ ...form.formData, domain: e.target.value });
                if (form.fieldErrors.domain) form.setFieldErrors(prev => ({ ...prev, domain: '' }));
              }}
              aria-invalid={!!form.fieldErrors.domain}
              aria-describedby={form.fieldErrors.domain ? 'model-domain-error' : undefined}
              style={{ ...inputStyle, ...(form.fieldErrors.domain ? inputErrorOutlineStyle : {}) }}
              onFocus={(e) => Object.assign(e.currentTarget.style, { ...inputFocusStyle, ...(form.fieldErrors.domain ? inputErrorOutlineStyle : {}) })}
              onBlur={(e) => Object.assign(e.currentTarget.style, { ...inputStyle, ...(form.fieldErrors.domain ? inputErrorOutlineStyle : {}) })}
            />
            {form.fieldErrors.domain && (
              <div id="model-domain-error" role="alert" style={fieldInlineErrorStyle}>{form.fieldErrors.domain}</div>
            )}
          </div>

          {/* File Upload Section */}
          <div ref={form.fieldSectionRefs.files} style={uploadSectionStyle}>
            <div style={uploadSectionTitleStyle}>Required Meta Model Files</div>

            {form.fieldErrors.files && (
              <div
                role="alert"
                style={metaModelImportErrorBannerStyle}
              >
                {form.fieldErrors.files}
              </div>
            )}

            {form.showGenModelFixPrompt && (
              <GenModelFixPrompt
                isLoading={isLoading}
                isSubmitting={submitProgress.isSubmitting}
                onCancel={form.handleCancelGenModelFixScenario}
                onApplyFixes={form.handleApplyGenModelFixes}
              />
            )}

            {FILE_CARD_DISPLAY_CONFIGS.map(({ kind, accentColor, hoverBg, badgeBg, badgeBorder, badgeColor, defaultHeaderBg }) => {
              const { ext, fileIdKey } = FILE_KIND_CONFIG[kind];
              const fileId = uploadedFileIds[fileIdKey];
              const { inputMode, url, urlFileName, localFileName } = form.perKind[kind];
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
                    uploadError={form.perKind[kind].uploadError}
                    localFileName={localFileName}
                    onModeChange={(mode) => form.switchFileMode(kind, mode)}
                    onFileInputClick={() => form.fileInputRefs[kind].current?.click()}
                    onUrlChange={(newUrl) => form.changeFileUrl(kind, newUrl)}
                    onUrlImport={() => form.handleUrlImport(kind)}
                    onClearUpload={() => { void form.clearKindUpload(kind); }}
                    removeDisabled={isLoading || submitProgress.isSubmitting || uploadProgress[kind].isUploading}
                  />
                </React.Fragment>
              );
            })}

            <div style={fileStatusStyle}>
              {uploadedFileIds.ecoreFileId > 0 && uploadedFileIds.genModelFileId > 0
                ? (() => {
                    const nEcore = getUploadedDisplayName(form.perKind.ecore);
                    const nGen = getUploadedDisplayName(form.perKind.genmodel);
                    if (nEcore && nGen) return `✅ Both files ready! (${nEcore} · ${nGen})`;
                    return '✅ Both files ready!';
                  })()
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
        </div>
      </dialog>
    </>,
    document.body
  );
};
