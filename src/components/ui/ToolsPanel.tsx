import React, { useState, useRef, useEffect } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

interface ToolsPanelProps {
  isVisible: boolean;
  onClose?: () => void;
  onEcoreFileUpload?: (fileContent: string, meta?: { fileName?: string; uploadId?: string }) => void;
}

const toolsPanelStyle: React.CSSProperties = {
  userSelect: 'none',
  width: '240px',
  background: '#fff',
  borderLeft: '1px solid #e5e5e5',
  padding: '16px',
  boxSizing: 'border-box',
  height: '100vh',
  overflowY: 'auto',
  transition: 'transform 0.2s ease',
  transform: 'translateX(0)',
};

const hiddenStyle: React.CSSProperties = {
  ...toolsPanelStyle,
  transform: 'translateX(100%)',
};

const titleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  marginBottom: '12px',
  color: '#222',
  textAlign: 'left',
  padding: '4px 0',
  borderBottom: '1px solid #e5e5e5',
  position: 'relative',
};

const closeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: '0',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  fontSize: '18px',
  cursor: 'pointer',
  color: '#666',
  padding: '4px 8px',
  borderRadius: '4px',
  transition: 'all 0.2s ease',
};

const closeButtonHoverStyle: React.CSSProperties = {
  background: '#f8f9fa',
  color: '#333',
};

const addButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  margin: '8px 0 16px 0',
  border: '1px solid #cccccc',
  borderRadius: '6px',
  background: '#ffffff',
  color: '#222',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background 0.15s ease, border-color 0.15s ease',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  userSelect: 'none',
};

const addButtonHoverStyle: React.CSSProperties = {
  background: '#f6f6f6',
  borderColor: '#bbbbbb',
};

const addButtonActiveStyle: React.CSSProperties = {
  background: '#eeeeee',
  borderColor: '#aaaaaa',
};

const instructionsStyle: React.CSSProperties = {
  marginBottom: '8px',
  fontSize: '12px',
  color: '#666',
};

const fileInputStyle: React.CSSProperties = {
  display: 'none',
};

export const ToolsPanel: React.FC<ToolsPanelProps> = ({ isVisible, onClose, onEcoreFileUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  interface UploadedEcoreFile {
    id: string;
    fileName: string;
    uploadedBy: string;
    uploadedAt: string; // ISO string
    content?: string;
  }

  const uploadsStorageKey = 'ecoreUploads';

  const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  const getInitialUploads = (): UploadedEcoreFile[] => {
    try {
      const stored = localStorage.getItem(uploadsStorageKey);
      if (stored) {
        return JSON.parse(stored) as UploadedEcoreFile[];
      }
    } catch {}

    const now = Date.now();
    return [
      {
        id: generateId(),
        fileName: 'sample.ecore',
        uploadedBy: 'you',
        uploadedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
        content: '<ecore:EPackage name="Sample" nsURI="" nsPrefix=""><eClassifiers name="Order"><eStructuralFeatures name="id"/></eClassifiers><eClassifiers name="Customer"><eStructuralFeatures name="name"/></eClassifiers></ecore:EPackage>'
      },
      {
        id: generateId(),
        fileName: 'orders.ecore',
        uploadedBy: 'alice',
        uploadedAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(), // 1d ago
        content: '<ecore:EPackage name="Orders" nsURI="" nsPrefix=""><eClassifiers name="Order"><eStructuralFeatures name="total"/></eClassifiers></ecore:EPackage>'
      },
      {
        id: generateId(),
        fileName: 'billing.ecore',
        uploadedBy: 'charlie',
        uploadedAt: new Date(now - 7 * 60 * 1000).toISOString(), // 7m ago
        content: '<ecore:EPackage name="Billing" nsURI="" nsPrefix=""><eClassifiers name="Invoice"><eStructuralFeatures name="amount"/></eClassifiers></ecore:EPackage>'
      },
    ];
  };

  const [uploads, setUploads] = useState<UploadedEcoreFile[]>(getInitialUploads);
  const [confirmState, setConfirmState] = useState<{ open: boolean; targetId?: string; targetName?: string }>(
    { open: false }
  );

  useEffect(() => {
    try {
      localStorage.setItem(uploadsStorageKey, JSON.stringify(uploads));
    } catch {}
  }, [uploads]);

  const formatRelativeTime = (isoDate: string) => {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 5) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 1) return `${seconds}s ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 1) return `${minutes}m ago`;
    const days = Math.floor(hours / 24);
    if (days < 1) return `${hours}h ago`;
    const months = Math.floor(days / 30);
    if (months < 1) return `${days}d ago`;
    const years = Math.floor(months / 12);
    if (years < 1) return `${months}mo ago`;
    return `${years}y ago`;
  };

  if (!isVisible) return null;

  const handleFileSelect = async (file: File) => {
    if (!file || !file.name.endsWith('.ecore')) {
      alert('Please select a valid .ecore file');
      return;
    }

    setIsProcessing(true);
    
    try {
      const content = await file.text();
      
      if (onEcoreFileUpload) {
        onEcoreFileUpload(content, { fileName: file.name });
      }
      
      setUploads(prev => [
        {
          id: generateId(),
          fileName: file.name,
          uploadedBy: 'you',
          uploadedAt: new Date().toISOString(),
          content,
        },
        ...prev,
      ]);
      
      console.log('Ecore file uploaded successfully:', file.name);
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Error reading the file. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input value to allow selecting the same file again
    event.target.value = '';
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const getButtonStyle = () => {
    if (isProcessing) {
      return { ...addButtonStyle, ...addButtonActiveStyle, cursor: 'not-allowed' };
    }
    if (isDragging) {
      return { ...addButtonStyle, ...addButtonHoverStyle };
    }
    return addButtonStyle;
  };

  return (
    <div style={isVisible ? toolsPanelStyle : hiddenStyle}>
      <div style={titleStyle}>
        ECORE UPLOADER
        {onClose && (
          <button 
            style={closeButtonStyle}
            onClick={onClose}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, closeButtonHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, closeButtonStyle)}
            title="Close Tools Panel"
          >
            ×
          </button>
        )}
      </div>
      
      {/* Helper text */}
      <div style={instructionsStyle}>Upload a .ecore file to open it in the workspace.</div>
      
      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".ecore"
        onChange={handleFileInputChange}
        style={fileInputStyle}
      />
      
      {/* Add Button */}
      <button 
        style={getButtonStyle()}
        onClick={handleButtonClick}
        disabled={isProcessing}
        onMouseEnter={(e) => !isProcessing && Object.assign(e.currentTarget.style, addButtonHoverStyle)}
        onMouseLeave={(e) => !isProcessing && Object.assign(e.currentTarget.style, getButtonStyle())}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isProcessing ? (
          <>
            Uploading...
          </>
        ) : (
          <>
            Upload .ecore
          </>
        )}
      </button>

      {/* Uploaded Files List */}
      <div style={{
        marginTop: '8px',
        marginBottom: '8px',
        fontWeight: 700,
        fontSize: '13px',
        color: '#222',
        borderBottom: '1px solid #e5e5e5',
        paddingBottom: '6px',
      }}>
        Uploaded files
      </div>
      <div>
        {[...uploads]
          .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
          .map(item => (
            <div key={item.id} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              padding: '8px 0',
              borderBottom: '1px solid #eeeeee',
              marginBottom: '0px',
              background: 'transparent',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
              position: 'relative',
            }}
            onClick={() => {
              const fallback = `name="${item.fileName.replace(/\.ecore$/i, '')}"`;
              const toOpen = item.content && item.content.trim().length > 0 ? item.content : fallback;
              if (onEcoreFileUpload) {
                onEcoreFileUpload(toOpen, { fileName: item.fileName, uploadId: item.id });
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f9f9f9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            >
              {item.uploadedBy && item.uploadedBy.trim().toLowerCase() === 'you' && (
                <div style={{ position: 'absolute', right: 0, top: '6px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmState({ open: true, targetId: item.id, targetName: item.fileName });
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#c92a2a',
                      padding: 0,
                      borderRadius: 0,
                      cursor: 'pointer',
                      fontSize: '12px',
                      textDecoration: 'underline',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = 'none';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textDecoration = 'underline';
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
              <div style={{ fontWeight: 600, color: '#222', wordBreak: 'break-all' }}>{item.fileName}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                <span>by </span>
                <span style={{ fontWeight: 600 }}>{item.uploadedBy}</span>
                <span> · </span>
                <span title={new Date(item.uploadedAt).toLocaleString()}>{formatRelativeTime(item.uploadedAt)}</span>
              </div>
            </div>
          ))}
        {uploads.length === 0 && (
          <div style={{ fontSize: '12px', color: '#777' }}>No uploads yet.</div>
        )}
      </div>
      
      {/* Removed additional info box for a simpler, academic style */}

      <ConfirmDialog
        isOpen={confirmState.open}
        title="Delete file?"
        message={`Are you sure you want to delete "${confirmState.targetName || ''}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => {
          if (confirmState.targetId) {
            setUploads(prev => prev.filter(u => u.id !== confirmState.targetId));
          }
          setConfirmState({ open: false });
        }}
        onCancel={() => setConfirmState({ open: false })}
      />
    </div>
  );
};
