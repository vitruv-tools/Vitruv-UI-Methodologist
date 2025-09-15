import React, { useState, useEffect } from 'react';
import { CreateModelModal } from './CreateModelModal';
import { apiService } from '../../services/api';

interface ToolsPanelProps {
  onEcoreFileUpload?: (fileContent: string, meta?: { fileName?: string; uploadId?: string; description?: string; keywords?: string; domain?: string; createdAt?: string }) => void;
  onEcoreFileDelete?: (fileName: string) => void;
  title?: string;
  allowCreate?: boolean;
  enableItemClick?: boolean;
  showBorder?: boolean;
  suppressApi?: boolean;
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

// ... existing code ...

const filterContainerStyle: React.CSSProperties = {
  position: 'fixed',
  top: '230px',
  left: '16px',
  right: '16px',
  zIndex: 1000,
  padding: '12px',
  background: '#ffffff',
  maxWidth: '320px',
  borderRadius: '8px',
  border: '1px solid #e9ecef',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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

// ... existing code ...

const emptyStateStyle: React.CSSProperties = {
  height: 'calc(100vh - 254px)',
  overflowY: 'auto',
  fontSize: '13px',
  color: '#5a6c7d',
  textAlign: 'center',
  padding: '24px',
  fontStyle: 'italic',
  fontFamily: 'Georgia, serif',
};

const paginationContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 0',
  marginTop: '8px',
  borderTop: '1px solid #e9ecef',
  fontFamily: 'Georgia, serif',
};

const paginationInfoStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6c757d',
  fontWeight: '500',
};

const paginationControlsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  alignItems: 'center',
};

const paginationButtonStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #dee2e6',
  borderRadius: '4px',
  background: '#ffffff',
  color: '#495057',
  fontSize: '12px',
  fontWeight: '500',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  minWidth: '32px',
  textAlign: 'center',
};

const paginationButtonHoverStyle: React.CSSProperties = {
  background: '#e9ecef',
  borderColor: '#adb5bd',
};

const paginationButtonActiveStyle: React.CSSProperties = {
  background: '#3498db',
  color: '#ffffff',
  borderColor: '#3498db',
};

const paginationButtonDisabledStyle: React.CSSProperties = {
  background: '#f8f9fa',
  color: '#6c757d',
  borderColor: '#dee2e6',
  cursor: 'not-allowed',
};

// GitHub-style filter tag styles
const filterTagStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: '16px',
  fontSize: '11px',
  fontWeight: '500',
  color: '#0366d6',
  background: '#f1f8ff',
  border: '1px solid #c8e1ff',
  margin: '2px',
  userSelect: 'none',
};

const filterTagsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
  marginBottom: '8px',
  minHeight: '24px',
};

const enhancedSearchInputStyle: React.CSSProperties = {
  ...filterInputStyle,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  fontSize: '13px',
};

export const ToolsPanel: React.FC<ToolsPanelProps> = ({ onEcoreFileUpload, onEcoreFileDelete, title = 'Meta Models', allowCreate = true, enableItemClick = true, showBorder = true, suppressApi = false }) => {
  const [isProcessing] = useState(false);
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [parsedFilters, setParsedFilters] = useState<any[]>([]);

  // Parse GitHub-style search syntax
  const parseSearchQuery = (query: string) => {
    const filters: any[] = [];
    const parts = query.split(/\s+/).filter(part => part.trim());
    
    for (const part of parts) {
      // Check if it's a parameter:value format
      const colonMatch = part.match(/^([a-zA-Z]+):(.+)$/);
      if (colonMatch) {
        const [, key, value] = colonMatch;
        const cleanValue = value.replace(/"/g, '');
        
        // Map GitHub-style parameters to our API parameters
        switch (key.toLowerCase()) {
          case 'name':
            filters.push({ key: 'name', value: cleanValue, display: `name:${cleanValue}` });
            break;
          case 'domain':
            filters.push({ key: 'domain', value: cleanValue, display: `domain:${cleanValue}` });
            break;
          case 'keywords':
            filters.push({ key: 'keywords', value: cleanValue, display: `keywords:${cleanValue}` });
            break;
          case 'description':
            filters.push({ key: 'description', value: cleanValue, display: `description:${cleanValue}` });
            break;
          case 'created':
            filters.push({ key: 'created', value: cleanValue, display: `created:${cleanValue}` });
            break;
          case 'updated':
            filters.push({ key: 'updated', value: cleanValue, display: `updated:${cleanValue}` });
            break;
          case 'time':
            // Handle time shortcuts
            if (cleanValue === 'beforenow' || cleanValue === 'before:now') {
              filters.push({ key: 'created', value: 'before:now', display: `time:beforenow` });
            } else if (cleanValue === 'afternow' || cleanValue === 'after:now') {
              filters.push({ key: 'created', value: 'after:now', display: `time:afternow` });
            } else {
              filters.push({ key: 'created', value: cleanValue, display: `time:${cleanValue}` });
            }
            break;
        }
      } else {
        // Regular text search - treat as name search
        filters.push({ key: 'name', value: part, display: `name:${part}` });
      }
    }
    
    return filters;
  };

  // Update parsed filters when search term changes
  useEffect(() => {
    if (searchTerm.trim()) {
      const filters = parseSearchQuery(searchTerm);
      setParsedFilters(filters);
    } else {
      setParsedFilters([]);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (suppressApi) {
      setIsLoadingModels(false);
      setApiError('');
      setApiModels([]);
      return;
    }
    const fetchData = async () => {
      setIsLoadingModels(true);
      setApiError('');
      
      try {
        const filters: any = {};
        
        // Process GitHub-style search filters
        parsedFilters.forEach(filter => {
          switch (filter.key) {
            case 'name':
              filters.name = filter.value;
              break;
            case 'domain':
              filters.domain = filter.value;
              break;
            case 'keywords':
              filters.keywords = filter.value;
              break;
            case 'description':
              filters.description = filter.value;
              break;
            case 'created':
              // Handle date filters
              if (filter.value.includes('after:')) {
                const dateStr = filter.value.replace('after:', '');
                if (dateStr === 'now') {
                  filters.createdFrom = new Date().toISOString();
                } else {
                  filters.createdFrom = new Date(dateStr).toISOString();
                }
              } else if (filter.value.includes('before:')) {
                const dateStr = filter.value.replace('before:', '');
                if (dateStr === 'now') {
                  filters.createdTo = new Date().toISOString();
                } else {
                  filters.createdTo = new Date(dateStr).toISOString();
                }
              } else if (filter.value.includes('between:')) {
                const dates = filter.value.replace('between:', '').split('..');
                if (dates.length === 2) {
                  filters.createdFrom = new Date(dates[0]).toISOString();
                  filters.createdTo = new Date(dates[1]).toISOString();
                }
              } else {
                // Specific date
                filters.createdFrom = new Date(filter.value).toISOString();
                filters.createdTo = new Date(filter.value + 'T23:59:59').toISOString();
              }
              break;
            case 'updated':
              // Similar to created but for updated field
              if (filter.value.includes('after:')) {
                const dateStr = filter.value.replace('after:', '');
                if (dateStr === 'now') {
                  filters.updatedFrom = new Date().toISOString();
                } else {
                  filters.updatedFrom = new Date(dateStr).toISOString();
                }
              } else if (filter.value.includes('before:')) {
                const dateStr = filter.value.replace('before:', '');
                if (dateStr === 'now') {
                  filters.updatedTo = new Date().toISOString();
                } else {
                  filters.updatedTo = new Date(dateStr).toISOString();
                }
              } else if (filter.value.includes('between:')) {
                const dates = filter.value.replace('between:', '').split('..');
                if (dates.length === 2) {
                  filters.updatedFrom = new Date(dates[0]).toISOString();
                  filters.updatedTo = new Date(dates[1]).toISOString();
                }
              } else {
                filters.updatedFrom = new Date(filter.value).toISOString();
                filters.updatedTo = new Date(filter.value + 'T23:59:59').toISOString();
              }
              break;
          }
        });
        
        // Add legacy date filters (keep existing functionality)
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
          
          // Only add legacy date filters if no GitHub-style date filters are present
          const hasDateFilters = parsedFilters.some(f => f.key === 'created' || f.key === 'updated');
          if (!hasDateFilters) {
            filters.createdFrom = createdFrom.toISOString();
            filters.createdTo = now.toISOString();
          }
        }
        
        const response = await apiService.findMetaModels(filters);
        setApiModels(response.data || []);
        setCurrentPage(1); // Reset to first page when filters change
      } catch (error) {
        console.error('Error fetching meta models from API:', error);
        setApiError(error instanceof Error ? error.message : 'Failed to fetch meta models');
      } finally {
        setIsLoadingModels(false);
      }
    };
    
    fetchData();
  }, [parsedFilters, dateFilter, suppressApi]);

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

  // Pagination calculations
  const totalItems = sortedModels.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageItems = sortedModels.slice(startIndex, endIndex);

  // Pagination handlers
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleCardRightClick = (e: React.MouseEvent, modelId: number) => {
    e.preventDefault();
    setExpandedCard(expandedCard === modelId ? null : modelId);
  };

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

  const panelStyle: React.CSSProperties = { ...toolsPanelStyle, borderRight: showBorder ? toolsPanelStyle.borderRight : 'none' };

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>
        {title}
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
            Upload New Meta Model
          </>
        )}
      </button>

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

      <div style={toggleContainerStyle}>
        <button
          style={toggleButtonStyle}
          onClick={() => setShowFilters(!showFilters)}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, toggleButtonHoverStyle)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, toggleButtonStyle)}
        >
          {isProcessing ? (
            <>
              Creating...
            </>
          ) : (
            <>
              Create New Meta Model
            </>
          )}
        </button>
      </div>

      {!suppressApi && (
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
          {title}
        </div>
      )}

      {!suppressApi && (
        <div style={toggleContainerStyle}>
          <button
            style={toggleButtonStyle}
            onClick={() => setShowFilters(!showFilters)}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, toggleButtonHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, toggleButtonStyle)}
          >
            <span>{showFilters ? 'Hide' : 'Show'} Advanced Search</span>
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
      )}

      {showFilters && (
        <div style={filterContainerStyle}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#495057', marginBottom: '8px' }}>
            Advanced Search
          </div>
          
          {/* Filter Tags Display */}
          {parsedFilters.length > 0 && (
            <div style={filterTagsContainerStyle}>
              {parsedFilters.map((filter, index) => (
                <div key={index} style={filterTagStyle}>
                  {filter.display}
                </div>
              ))}
            </div>
          )}
          
          <div style={filterRowStyle}>
            <span style={filterLabelStyle}>Search:</span>
            <input
              type="text"
              placeholder="name:test domain:engineering time:beforenow created:after:2023-01-01"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={enhancedSearchInputStyle}
            />
          </div>
          
          <div style={{ fontSize: '10px', color: '#6a737d', marginTop: '4px', fontStyle: 'italic' }}>
            Use GitHub-style syntax: name:test domain:engineering time:beforenow created:after:2023-01-01
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
          
          {/* Original Filter Style */}
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e9ecef' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#495057', marginBottom: '8px' }}>
              Quick Filters
            </div>
            
            <div style={filterRowStyle}>
              <span style={filterLabelStyle}>Name:</span>
              <input
                type="text"
                placeholder="Filter by name..."
                value={searchTerm.includes(':') ? '' : searchTerm}
                onChange={(e) => {
                  if (!e.target.value.includes(':')) {
                    setSearchTerm(e.target.value);
                  }
                }}
                style={filterInputStyle}
              />
            </div>
            
            <div style={filterRowStyle}>
              <span style={filterLabelStyle}>Domain:</span>
              <input
                type="text"
                placeholder="Filter by domain..."
                style={filterInputStyle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const domainValue = e.currentTarget.value.trim();
                    if (domainValue) {
                      setSearchTerm(prev => prev ? `${prev} domain:${domainValue}` : `domain:${domainValue}`);
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
            </div>
            
            <div style={filterRowStyle}>
              <span style={filterLabelStyle}>Keywords:</span>
              <input
                type="text"
                placeholder="Filter by keywords..."
                style={filterInputStyle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const keywordValue = e.currentTarget.value.trim();
                    if (keywordValue) {
                      setSearchTerm(prev => prev ? `${prev} keywords:${keywordValue}` : `keywords:${keywordValue}`);
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
            </div>
            
            <div style={filterRowStyle}>
              <span style={filterLabelStyle}>Date:</span>
              <input
                type="date"
                style={filterInputStyle}
                onChange={(e) => {
                  const dateValue = e.target.value;
                  if (dateValue) {
                    setSearchTerm(prev => prev ? `${prev} created:${dateValue}` : `created:${dateValue}`);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {!suppressApi && apiError && (
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

      {!suppressApi && isLoadingModels && (
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

      {!suppressApi && (
      <div style={{ height: 'calc(100vh - 311px)', overflowY: 'auto' }}>
        {!suppressApi && currentPageItems.map(model => (
          <div key={model.id} style={fileCardStyle}
            onClick={() => {
              if (!enableItemClick) return;
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
            onContextMenu={(e) => handleCardRightClick(e, model.id)}
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
              <span>•</span>
              <span title={new Date(model.createdAt).toLocaleString()}>
                {formatRelativeTime(model.createdAt)}
              </span>
              {expandedCard === model.id && (
                <>
                  <span>•</span>
                  <span style={{ fontSize: '11px', color: '#6c757d' }}>
                    Right-click to collapse details
                  </span>
                </>
              )}
            </div>
            
            {/* Expanded content - only show when card is expanded */}
            {expandedCard === model.id && (
              <>
                {model.keyword && model.keyword.length > 0 && (
                  <div style={{
                    fontSize: '12px',
                    color: '#495057',
                    marginTop: '6px',
                    fontFamily: 'Georgia, serif',
                  }}>
                    <strong>Keywords:</strong> {model.keyword.join(', ')}
                  </div>
                )}
                {model.description && (
                  <div style={{
                    fontSize: '12px',
                    color: '#6c757d',
                    marginTop: '4px',
                    fontStyle: 'italic',
                    fontFamily: 'Georgia, serif',
                    lineHeight: '1.4',
                  }}>
                    <strong>Description:</strong> {model.description}
                  </div>
                )}
              </>
            )}
            
            {/* Hint for collapsed state */}
            {expandedCard !== model.id && (
              <div style={{
                fontSize: '10px',
                color: '#adb5bd',
                marginTop: '4px',
                fontStyle: 'italic',
                fontFamily: 'Georgia, serif',
              }}>
                Right-click to view details
              </div>
            )}
          </div>
        ))}
        {!suppressApi && !isLoadingModels && sortedModels.length === 0 && !apiError && (
          <div style={emptyStateStyle}>
            No meta models available from server.
          </div>
        )}
      </div>
      )}

      {/* Pagination Controls */}
      {!suppressApi && totalPages > 1 && (
        <div style={paginationContainerStyle}>
          <div style={paginationInfoStyle}>
            Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} models
          </div>
          <div style={paginationControlsStyle}>
            <button
              style={{
                ...paginationButtonStyle,
                ...(currentPage === 1 ? paginationButtonDisabledStyle : {})
              }}
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              onMouseEnter={(e) => {
                if (currentPage > 1) {
                  Object.assign(e.currentTarget.style, paginationButtonHoverStyle);
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage > 1) {
                  Object.assign(e.currentTarget.style, paginationButtonStyle);
                }
              }}
            >
              ‹
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
              // Show first page, last page, current page, and pages around current page
              const shouldShow = 
                page === 1 || 
                page === totalPages || 
                Math.abs(page - currentPage) <= 1;
              
              if (!shouldShow) {
                // Show ellipsis for gaps
                if (page === 2 && currentPage > 4) {
                  return <span key={`ellipsis-${page}`} style={{ padding: '0 4px', color: '#6c757d' }}>...</span>;
                }
                if (page === totalPages - 1 && currentPage < totalPages - 3) {
                  return <span key={`ellipsis-${page}`} style={{ padding: '0 4px', color: '#6c757d' }}>...</span>;
                }
                return null;
              }
              
              return (
                <button
                  key={page}
                  style={{
                    ...paginationButtonStyle,
                    ...(page === currentPage ? paginationButtonActiveStyle : {})
                  }}
                  onClick={() => goToPage(page)}
                  onMouseEnter={(e) => {
                    if (page !== currentPage) {
                      Object.assign(e.currentTarget.style, paginationButtonHoverStyle);
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (page !== currentPage) {
                      Object.assign(e.currentTarget.style, paginationButtonStyle);
                    }
                  }}
                >
                  {page}
                </button>
              );
            })}
            
            <button
              style={{
                ...paginationButtonStyle,
                ...(currentPage === totalPages ? paginationButtonDisabledStyle : {})
              }}
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              onMouseEnter={(e) => {
                if (currentPage < totalPages) {
                  Object.assign(e.currentTarget.style, paginationButtonHoverStyle);
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage < totalPages) {
                  Object.assign(e.currentTarget.style, paginationButtonStyle);
                }
              }}
            >
              ›
            </button>
          </div>
        </div>
      )}
      
      <CreateModelModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(modelData) => {
          setUploadMessage('Meta Model created successfully!');
          setUploadMessageType('success');
          setTimeout(() => setUploadMessage(''), 3000);
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
              console.error('Error fetching meta models from API:', error);
              setApiError(error instanceof Error ? error.message : 'Failed to fetch meta models');
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
