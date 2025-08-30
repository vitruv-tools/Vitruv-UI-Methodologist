import React, { useState, useRef, useEffect } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { apiService } from '../../services/api';

interface ToolsPanelProps {
  onEcoreFileUpload?: (fileContent: string, meta?: { fileName?: string; uploadId?: string }) => void;
}

const toolsPanelStyle: React.CSSProperties = {
  userSelect: 'none',
  width: '100%',
  background: '#fff',
  padding: '0',
  boxSizing: 'border-box',
  height: 'auto',
  overflowY: 'auto',
};

const titleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  marginBottom: '12px',
  color: '#222',
  textAlign: 'left',
  padding: '4px 0',
  borderBottom: '1px solid #e5e5e5',
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

const filterContainerStyle: React.CSSProperties = {
  marginBottom: '16px',
  padding: '12px',
  background: '#f8f9fa',
  borderRadius: '8px',
  border: '1px solid #e9ecef',
};

const filterRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '8px',
  alignItems: 'center',
};

const filterLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '600',
  color: '#495057',
  minWidth: '60px',
};

const filterInputStyle: React.CSSProperties = {
  flex: '1',
  padding: '6px 8px',
  border: '1px solid #ced4da',
  borderRadius: '4px',
  fontSize: '12px',
};

const filterSelectStyle: React.CSSProperties = {
  flex: '1',
  padding: '6px 8px',
  border: '1px solid #ced4da',
  borderRadius: '4px',
  fontSize: '12px',
  background: '#ffffff',
};

const fileCardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e9ecef',
  borderRadius: '8px',
  padding: '12px',
  marginBottom: '12px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  position: 'relative',
};

const fileCardHoverStyle: React.CSSProperties = {
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  transform: 'translateY(-1px)',
  borderColor: '#007bff',
};

const toggleContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  margin: '8px 0',
  alignItems: 'center',
};

const toggleButtonStyle: React.CSSProperties = {
  flex: '1',
  padding: '8px 12px',
  border: '1px solid #dee2e6',
  borderRadius: '6px',
  background: '#f8f9fa',
  color: '#495057',
  fontSize: '12px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const toggleButtonHoverStyle: React.CSSProperties = {
  background: '#e9ecef',
  borderColor: '#adb5bd',
};

const sortDropdownStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #dee2e6',
  borderRadius: '6px',
  background: '#ffffff',
  color: '#495057',
  fontSize: '12px',
  fontWeight: '500',
  cursor: 'pointer',
  minWidth: '120px',
};

export const ToolsPanel: React.FC<ToolsPanelProps> = ({ onEcoreFileUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUploader, setSelectedUploader] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'uploader'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [uploadMessageType, setUploadMessageType] = useState<'success' | 'error'>('success');
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

    // Return empty array - no sample data by default
    return [];
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

  // Filter uploads based on search term, uploader, and date
  const filteredUploads = uploads.filter(item => {
    const matchesSearch = item.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUploader = selectedUploader === 'all' || item.uploadedBy === selectedUploader;
    
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const itemDate = new Date(item.uploadedAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - itemDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      switch (dateFilter) {
        case 'today':
          matchesDate = diffDays <= 1;
          break;
        case 'week':
          matchesDate = diffDays <= 7;
          break;
        case 'month':
          matchesDate = diffDays <= 30;
          break;
        case 'year':
          matchesDate = diffDays <= 365;
          break;
      }
    }
    
    return matchesSearch && matchesUploader && matchesDate;
  });

  // Sort filtered uploads
  const sortedUploads = [...filteredUploads].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.fileName.localeCompare(b.fileName);
        break;
      case 'date':
        comparison = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
        break;
      case 'uploader':
        comparison = a.uploadedBy.localeCompare(b.uploadedBy);
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Get unique uploaders for filter dropdown
  const uniqueUploaders = Array.from(new Set(uploads.map(item => item.uploadedBy)));

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

  const handleFileSelect = async (file: File) => {
    if (!file || !file.name.endsWith('.ecore')) {
      alert('Please select a valid .ecore file');
      return;
    }

    if (!onEcoreFileUpload) {
      console.warn('No upload handler provided');
      return;
    }

    setIsProcessing(true);
    
    try {
      // First, upload the file to the API
      const uploadResponse = await apiService.uploadFile(file);
      console.log('File uploaded to API:', uploadResponse);
      
      // Show success message
      setUploadMessage(`Successfully uploaded ${file.name} to server`);
      setUploadMessageType('success');
      
      // Read the file content for local processing
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
      
      // Clear success message after 3 seconds
      setTimeout(() => setUploadMessage(''), 3000);
    } catch (error) {
      console.error('Error uploading file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setUploadMessage(`Error uploading file: ${errorMessage}`);
      setUploadMessageType('error');
      setTimeout(() => setUploadMessage(''), 5000);
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
    <div style={toolsPanelStyle}>
      <div style={titleStyle}>
        ECORE UPLOADER
      </div>
      
      {/* Helper text */}
      <div style={instructionsStyle}>Upload a .ecore file to open it in the workspace.</div>
      
      {/* Success/Error Message */}
      {uploadMessage && (
        <div style={{
          padding: '8px 12px',
          margin: '8px 0',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: '500',
          backgroundColor: uploadMessageType === 'success' ? '#d4edda' : '#f8d7da',
          color: uploadMessageType === 'success' ? '#155724' : '#721c24',
          border: `1px solid ${uploadMessageType === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
        }}>
          {uploadMessage}
        </div>
      )}
      
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
            Uploading to Server...
          </>
        ) : (
          <>
            Upload .ecore
          </>
        )}
      </button>

      {/* Uploaded Files List */}
      <div style={{
        marginTop: '16px',
        marginBottom: '8px',
        fontWeight: '700',
        fontSize: '13px',
        color: '#222',
        borderBottom: '1px solid #e5e5e5',
        paddingBottom: '6px',
      }}>
        Uploaded files
      </div>

      {/* Toggle Filters Button and Sort Dropdown */}
      <div style={toggleContainerStyle}>
        <button
          style={toggleButtonStyle}
          onClick={() => setShowFilters(!showFilters)}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, toggleButtonHoverStyle)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, toggleButtonStyle)}
        >
          <span>{showFilters ? 'Hide' : 'Show'} Filters</span>
          <span>{showFilters ? '▼' : '▶'}</span>
        </button>
        
        <select
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => {
            const [newSortBy, newSortOrder] = e.target.value.split('-') as ['name' | 'date' | 'uploader', 'asc' | 'desc'];
            setSortBy(newSortBy);
            setSortOrder(newSortOrder);
          }}
          style={sortDropdownStyle}
        >
          <option value="date-desc">Newest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="uploader-asc">Uploader A-Z</option>
          <option value="uploader-desc">Uploader Z-A</option>
        </select>
      </div>

      {/* Filters */}
      {showFilters && (
        <>
          {uploads.length > 0 && (
            <div style={filterContainerStyle}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#495057', marginBottom: '8px' }}>
                Filters
              </div>
              <div style={filterRowStyle}>
                <span style={filterLabelStyle}>Search:</span>
                <input
                  type="text"
                  placeholder="Filter by filename..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={filterInputStyle}
                />
              </div>
              <div style={filterRowStyle}>
                <span style={filterLabelStyle}>Uploader:</span>
                <select
                  value={selectedUploader}
                  onChange={(e) => setSelectedUploader(e.target.value)}
                  style={filterSelectStyle}
                >
                  <option value="all">All uploaders</option>
                  {uniqueUploaders.map(uploader => (
                    <option key={uploader} value={uploader}>{uploader}</option>
                  ))}
                </select>
              </div>
              <div style={filterRowStyle}>
                <span style={filterLabelStyle}>Date:</span>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  style={filterSelectStyle}
                >
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="week">This week</option>
                  <option value="month">This month</option>
                  <option value="year">This year</option>
                </select>
              </div>
            </div>
          )}
        </>
      )}

      <div>
        {[...sortedUploads]
          .map(item => (
            <div key={item.id} style={fileCardStyle}
            onClick={() => {
              const fallback = `name="${item.fileName.replace(/\.ecore$/i, '')}"`;
              const toOpen = item.content && item.content.trim().length > 0 ? item.content : fallback;
              if (onEcoreFileUpload) {
                onEcoreFileUpload(toOpen, { fileName: item.fileName, uploadId: item.id });
              }
            }}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, fileCardHoverStyle);
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, fileCardStyle);
            }}
            >
              {item.uploadedBy && item.uploadedBy.trim().toLowerCase() === 'you' && (
                <div style={{ position: 'absolute', right: '8px', top: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmState({ open: true, targetId: item.id, targetName: item.fileName });
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#dc3545',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '600',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#dc3545';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#dc3545';
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
              <div style={{ 
                fontWeight: '600', 
                color: '#212529', 
                wordBreak: 'break-all',
                marginBottom: '4px',
                fontSize: '14px'
              }}>
                {item.fileName}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: '#6c757d',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>by <strong>{item.uploadedBy}</strong></span>
                <span>•</span>
                <span title={new Date(item.uploadedAt).toLocaleString()}>
                  {formatRelativeTime(item.uploadedAt)}
                </span>
              </div>
            </div>
          ))}
        {sortedUploads.length === 0 && (
          <div style={{ 
            fontSize: '12px', 
            color: '#6c757d',
            textAlign: 'center',
            padding: '20px',
            fontStyle: 'italic'
          }}>
            {uploads.length === 0 ? 'No uploads yet.' : 'No uploads match your filters.'}
          </div>
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
