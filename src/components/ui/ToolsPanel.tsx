import React, { useState, useRef, useEffect } from 'react';
import { CreateModelModal } from './CreateModelModal';
import { apiService } from '../../services/api';

interface ToolsPanelProps {
  onEcoreFileUpload?: (fileContent: string, meta?: { fileName?: string; uploadId?: string; description?: string; keywords?: string; domain?: string; createdAt?: string }) => void;
  onEcoreFileDelete?: (fileName: string) => void;
}

const toolsPanelStyle: React.CSSProperties = {
  userSelect: 'none',
  width: '100%',
  background: '#f8f9fa',
  padding: '16px',
  boxSizing: 'border-box',
  height: 'auto',
  overflowY: 'auto',
  borderRight: '1px solid #e9ecef',
};

const titleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  marginBottom: '16px',
  color: '#2c3e50',
  textAlign: 'left',
  padding: '8px 0',
  borderBottom: '2px solid #3498db',
  fontFamily: 'Georgia, serif',
};

const createButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 18px',
  margin: '12px 0 20px 0',
  border: 'none',
  borderRadius: '6px',
  background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  userSelect: 'none',
  boxShadow: '0 3px 10px rgba(52, 152, 219, 0.3)',
  fontFamily: 'Georgia, serif',
};

const createButtonHoverStyle: React.CSSProperties = {
  transform: 'translateY(-1px)',
  boxShadow: '0 5px 15px rgba(52, 152, 219, 0.4)',
  background: 'linear-gradient(135deg, #2980b9 0%, #1f5f8b 100%)',
};

const createButtonActiveStyle: React.CSSProperties = {
  transform: 'translateY(0px)',
  boxShadow: '0 2px 8px rgba(52, 152, 219, 0.3)',
};

const instructionsStyle: React.CSSProperties = {
  marginBottom: '12px',
  fontSize: '13px',
  color: '#5a6c7d',
  fontStyle: 'italic',
  fontFamily: 'Georgia, serif',
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
  border: '1px solid #d1ecf1',
  borderRadius: '6px',
  padding: '16px',
  marginBottom: '16px',
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  position: 'relative',
  fontFamily: 'Georgia, serif',
};

const fileCardHoverStyle: React.CSSProperties = {
  boxShadow: '0 4px 12px rgba(52, 152, 219, 0.15)',
  transform: 'translateY(-1px)',
  borderColor: '#3498db',
  background: '#f8f9ff',
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

const fileNameStyle: React.CSSProperties = {
  fontWeight: '600',
  color: '#2c3e50',
  wordBreak: 'break-all',
  marginBottom: '6px',
  fontSize: '15px',
  fontFamily: 'Georgia, serif',
};

const fileMetaStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#5a6c7d',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontFamily: 'Georgia, serif',
  fontStyle: 'italic',
};

const deleteButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: '8px',
  top: '8px',
  background: 'transparent',
  border: 'none',
  color: '#dc3545',
  padding: '4px 8px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: '600',
  transition: 'all 0.2s ease',
};

const emptyStateStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#5a6c7d',
  textAlign: 'center',
  padding: '24px',
  fontStyle: 'italic',
  fontFamily: 'Georgia, serif',
};

export const ToolsPanel: React.FC<ToolsPanelProps> = ({ onEcoreFileUpload, onEcoreFileDelete }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [uploadMessageType, setUploadMessageType] = useState<'success' | 'error'>('success');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'domain'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [apiModels, setApiModels] = useState<any[]>([]);
  const [apiError, setApiError] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingModels(true);
      setApiError('');
      
      try {
        const filters: any = {};
        
        // Add search filters
        if (searchTerm.trim()) {
          filters.name = searchTerm.trim();
        }
        
        // Add date filters
        if (dateFilter !== 'all') {
          const now = new Date();
          let createdFrom: Date;
          
          switch (dateFilter) {
            case 'today':
              createdFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              break;
            case 'week':
              createdFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              break;
            case 'month':
              createdFrom = new Date(now.getFullYear(), now.getMonth(), 1);
              break;
            case 'year':
              createdFrom = new Date(now.getFullYear(), 0, 1);
              break;
            default:
              createdFrom = new Date(0);
          }
          
          filters.createdFrom = createdFrom.toISOString();
          filters.createdTo = now.toISOString();
        }
        
        const response = await apiService.findMetaModels(filters);
        setApiModels(response.data || []);
      } catch (error) {
        console.error('Error fetching models from API:', error);
        setApiError(error instanceof Error ? error.message : 'Failed to fetch models');
      } finally {
        setIsLoadingModels(false);
      }
    };
    
    fetchData();
  }, [searchTerm, dateFilter]);

  // Sort API models
  const sortedModels = [...apiModels].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'date':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'domain':
        comparison = (a.domain || '').localeCompare(b.domain || '');
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const formatRelativeTime = (isoDate: string) => {
    const date = new Date(isoDate);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} at ${timeStr}`;
  };

  const handleButtonClick = () => {
    setShowCreateModal(true);
  };

  const getButtonStyle = () => {
    if (isProcessing) {
      return { ...createButtonStyle, ...createButtonActiveStyle, cursor: 'not-allowed' };
    }
    return createButtonStyle;
  };

  return (
    <div style={toolsPanelStyle}>
      <div style={titleStyle}>
        Meta Models
      </div>
      
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
      
      <button 
        style={getButtonStyle()}
        onClick={handleButtonClick}
        disabled={isProcessing}
        onMouseEnter={(e) => !isProcessing && Object.assign(e.currentTarget.style, createButtonHoverStyle)}
        onMouseLeave={(e) => !isProcessing && Object.assign(e.currentTarget.style, getButtonStyle())}
      >
        {isProcessing ? (
          <>
            Creating...
          </>
        ) : (
          <>
            Create New Model
          </>
        )}
      </button>

      {/* Meta Models List */}
      <div style={{
        marginTop: '16px',
        marginBottom: '8px',
        fontWeight: '700',
        fontSize: '13px',
        color: '#2c3e50',
        borderBottom: '1px solid #3498db',
        paddingBottom: '6px',
        fontFamily: 'Georgia, serif',
      }}>
        Meta Models
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
            const [newSortBy, newSortOrder] = e.target.value.split('-') as ['name' | 'date' | 'domain', 'asc' | 'desc'];
            setSortBy(newSortBy);
            setSortOrder(newSortOrder);
          }}
          style={sortDropdownStyle}
        >
          <option value="date-desc">Newest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="domain-asc">Domain A-Z</option>
          <option value="domain-desc">Domain Z-A</option>
        </select>
      </div>

      {/* Filters */}
      {showFilters && (
        <div style={filterContainerStyle}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#495057', marginBottom: '8px' }}>
            Filters
          </div>
          <div style={filterRowStyle}>
            <span style={filterLabelStyle}>Search:</span>
            <input
              type="text"
              placeholder="Filter by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={filterInputStyle}
            />
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

      {/* Error Message */}
      {apiError && (
        <div style={{
          padding: '8px 12px',
          margin: '8px 0',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: '500',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
        }}>
          {apiError}
        </div>
      )}

      {/* Loading State */}
      {isLoadingModels && (
        <div style={{
          padding: '16px',
          textAlign: 'center',
          fontSize: '13px',
          color: '#5a6c7d',
          fontStyle: 'italic',
          fontFamily: 'Georgia, serif',
        }}>
          Loading models...
        </div>
      )}

      {/* Models List */}
      <div>
        {sortedModels.map(model => (
          <div key={model.id} style={fileCardStyle}
            onClick={() => {
              // Handle API model selection
              if (onEcoreFileUpload) {
                onEcoreFileUpload(`name="${model.name}"`, { 
                  fileName: `${model.name}.ecore`, 
                  uploadId: model.id.toString(),
                  description: model.description,
                  keywords: model.keyword?.join(', '),
                  domain: model.domain,
                  createdAt: model.createdAt
                });
              }
            }}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, fileCardHoverStyle);
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, fileCardStyle);
            }}
          >
            <div style={fileNameStyle}>
              {model.name}
            </div>
            <div style={fileMetaStyle}>
              <span>Domain: <strong>{model.domain}</strong></span>
              {model.keyword && model.keyword.length > 0 && (
                <>
                  <span>•</span>
                  <span>Keywords: {model.keyword.join(', ')}</span>
                </>
              )}
              <span>•</span>
              <span title={new Date(model.createdAt).toLocaleString()}>
                {formatRelativeTime(model.createdAt)}
              </span>
            </div>
            {model.description && (
              <div style={{
                fontSize: '12px',
                color: '#6c757d',
                marginTop: '4px',
                fontStyle: 'italic',
                fontFamily: 'Georgia, serif',
              }}>
                {model.description}
              </div>
            )}
          </div>
        ))}
        {!isLoadingModels && sortedModels.length === 0 && !apiError && (
          <div style={emptyStateStyle}>
            No models available from server.
          </div>
        )}
      </div>
      
      {/* Create Model Modal */}
      <CreateModelModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(modelData) => {
          // Handle successful model creation
          setUploadMessage('Model created successfully!');
          setUploadMessageType('success');
          setTimeout(() => setUploadMessage(''), 3000);
          // Refresh the models list
          const fetchData = async () => {
            setIsLoadingModels(true);
            setApiError('');
            try {
              const filters: any = {};
              if (searchTerm.trim()) {
                filters.name = searchTerm.trim();
              }
              if (dateFilter !== 'all') {
                const now = new Date();
                let createdFrom: Date;
                switch (dateFilter) {
                  case 'today':
                    createdFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                  case 'week':
                    createdFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                  case 'month':
                    createdFrom = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                  case 'year':
                    createdFrom = new Date(now.getFullYear(), 0, 1);
                    break;
                  default:
                    createdFrom = new Date(0);
                }
                filters.createdFrom = createdFrom.toISOString();
                filters.createdTo = now.toISOString();
              }
              const response = await apiService.findMetaModels(filters);
              setApiModels(response.data || []);
            } catch (error) {
              console.error('Error fetching models from API:', error);
              setApiError(error instanceof Error ? error.message : 'Failed to fetch models');
            } finally {
              setIsLoadingModels(false);
            }
          };
          fetchData();
        }}
      />
    </div>
  );
};
