import React, { useState, useEffect, useCallback } from 'react';
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
  maxWidth: '100%',
  background: '#f8f9fa',
  padding: 'clamp(8px, 2vw, 16px)',
  boxSizing: 'border-box',
  height: 'auto',
  overflowY: 'auto',
  borderRight: '1px solid #e9ecef',
  minWidth: '200px',
};

const titleStyle: React.CSSProperties = {
  fontSize: 'clamp(14px, 3vw, 18px)',
  fontWeight: 700,
  marginBottom: 'clamp(8px, 2vw, 16px)',
  color: '#2c3e50',
  textAlign: 'left',
  padding: 'clamp(4px, 1vw, 8px) 0',
  borderBottom: '2px solid #3498db',
  fontFamily: 'Georgia, serif',
  lineHeight: '1.2',
};

const createButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: 'clamp(10px, 2vw, 14px) clamp(12px, 3vw, 18px)',
  margin: 'clamp(8px, 2vw, 12px) 0 clamp(12px, 3vw, 20px) 0',
  border: 'none',
  borderRadius: '6px',
  background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
  color: '#ffffff',
  fontSize: 'clamp(12px, 2.5vw, 15px)',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'clamp(6px, 1.5vw, 10px)',
  userSelect: 'none',
  boxShadow: '0 3px 10px rgba(52, 152, 219, 0.3)',
  fontFamily: 'Georgia, serif',
  minHeight: '44px',
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

const filterCloseButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '6px',
  right: '6px',
  width: '24px',
  height: '24px',
  border: 'none',
  background: 'transparent',
  color: '#6c757d',
  fontSize: '16px',
  lineHeight: '24px',
  cursor: 'pointer',
  borderRadius: '4px',
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
  padding: '12px',
  marginBottom: '12px',
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  position: 'relative',
  fontFamily: 'Georgia, serif',
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  minHeight: '60px',
  display: 'flex',
  flexDirection: 'column',
};

const fileCardHoverStyle: React.CSSProperties = {
  boxShadow: '0 4px 12px rgba(52, 152, 219, 0.15)',
  transform: 'translateY(-1px)',
  borderColor: '#3498db',
  background: '#f8f9ff',
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

const ownershipToggleStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #dee2e6',
  borderRadius: '6px',
  background: '#ffffff',
  color: '#495057',
  fontSize: '12px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  minWidth: '100px',
};

const ownershipToggleActiveStyle: React.CSSProperties = {
  ...ownershipToggleStyle,
  background: '#3498db',
  color: '#ffffff',
  borderColor: '#3498db',
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
  wordBreak: 'break-word',
  marginBottom: '6px',
  fontSize: 'clamp(13px, 2.5vw, 15px)',
  fontFamily: 'Georgia, serif',
  lineHeight: '1.3',
  overflowWrap: 'break-word',
};

const fileMetaStyle: React.CSSProperties = {
  fontSize: 'clamp(11px, 2vw, 13px)',
  color: '#5a6c7d',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontFamily: 'Georgia, serif',
  fontStyle: 'italic',
  flexWrap: 'wrap',
  lineHeight: '1.4',
};

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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string>('');
  const [viewModel, setViewModel] = useState<any | null>(null);
  const [showAllModels, setShowAllModels] = useState(false);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Tab') return;
    const input = e.currentTarget;
    const value = input.value;
    const caret = input.selectionStart ?? value.length;
    let start = caret - 1;
    while (start >= 0 && !/\s/.test(value[start])) start--;
    start++;
    let end = caret;
    while (end < value.length && !/\s/.test(value[end])) end++;
    const token = value.slice(start, end);
    const lower = token.toLowerCase().replace(/:$/, '');

    const candidates = ['name', 'description', 'domain', 'keywords', 'created', 'updated', 'time'];
    const match = candidates.find(k => k.startsWith(lower));
    const replacement = match ? `${match}:` : null;
    if (!replacement) return;

    e.preventDefault();
    const newValue = value.slice(0, start) + replacement + value.slice(end);
    const newCaret = start + replacement.length;
    setSearchTerm(newValue);
    requestAnimationFrame(() => {
      input.setSelectionRange(newCaret, newCaret);
    });
  };

  const parseSearchQuery = (query: string) => {
    const result: any[] = [];

    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < query.length; i++) {
      const ch = query[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && /\s/.test(ch)) {
        if (current.trim().length > 0) tokens.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim().length > 0) tokens.push(current);

    for (const token of tokens) {
      const match = token.match(/^([a-zA-Z]+):(.+)$/);
      if (match) {
        const key = match[1].toLowerCase();
        const rawValue = match[2];
        const cleanValue = rawValue.trim();
        switch (key) {
          case 'name':
            result.push({ key: 'name', value: cleanValue, display: `name:${cleanValue}` });
            break;
          case 'domain':
            result.push({ key: 'domain', value: cleanValue, display: `domain:${cleanValue}` });
            break;
          case 'keyword':
          case 'keywords': {
            result.push({ key: 'keywords', value: cleanValue, display: `keywords:${cleanValue}` });
            break;
          }
          case 'description':
          case 'desc':
            result.push({ key: 'description', value: cleanValue, display: `description:${cleanValue}` });
            break;
          case 'created':
            result.push({ key: 'created', value: cleanValue, display: `created:${cleanValue}` });
            break;
          case 'updated':
            result.push({ key: 'updated', value: cleanValue, display: `updated:${cleanValue}` });
            break;
          case 'time': {
            if (cleanValue === 'beforenow' || cleanValue === 'before:now') {
              result.push({ key: 'created', value: 'before:now', display: 'time:beforenow' });
            } else if (cleanValue === 'afternow' || cleanValue === 'after:now') {
              result.push({ key: 'created', value: 'after:now', display: 'time:afternow' });
            } else {
              result.push({ key: 'created', value: cleanValue, display: `time:${cleanValue}` });
            }
            break;
          }
          default:
        }
      }
    }

    return result;
  };

  const buildApiFiltersFromParsedFilters = useCallback((filtersParsed: any[], includeLegacyDate = true) => {
    const filters: any = {};
    
    // Set ownership filter
    filters.ownedByUser = !showAllModels;
    
    filtersParsed.forEach(filter => {
      switch (filter.key) {
        case 'name':
          filters.name = filter.value;
          break;
        case 'domain':
          filters.domain = filter.value;
          break;
        case 'keywords': {
          const values = String(filter.value)
            .split(',')
            .map(v => v.trim())
            .filter(v => v.length > 0);
          if (values.length > 0) filters.keyword = values;
          break;
        }
        case 'description':
          filters.description = filter.value;
          break;
        case 'created': {
          const v = String(filter.value);
          if (v.includes('after:')) {
            const dateStr = v.replace('after:', '');
            filters.createdFrom = dateStr === 'now' ? new Date().toISOString() : new Date(dateStr).toISOString();
          } else if (v.includes('before:')) {
            const dateStr = v.replace('before:', '');
            filters.createdTo = dateStr === 'now' ? new Date().toISOString() : new Date(dateStr).toISOString();
          } else if (v.includes('between:')) {
            const dates = v.replace('between:', '').split('..');
            if (dates.length === 2) {
              filters.createdFrom = new Date(dates[0]).toISOString();
              filters.createdTo = new Date(dates[1]).toISOString();
            }
          } else if (v === 'before:now') {
            filters.createdTo = new Date().toISOString();
          } else if (v === 'after:now') {
            filters.createdFrom = new Date().toISOString();
          } else {
            filters.createdFrom = new Date(v).toISOString();
            filters.createdTo = new Date(`${v}T23:59:59`).toISOString();
          }
          break;
        }
        case 'updated': {
          const v = String(filter.value);
          if (v.includes('after:')) {
            const dateStr = v.replace('after:', '');
            filters.updatedFrom = dateStr === 'now' ? new Date().toISOString() : new Date(dateStr).toISOString();
          } else if (v.includes('before:')) {
            const dateStr = v.replace('before:', '');
            filters.updatedTo = dateStr === 'now' ? new Date().toISOString() : new Date(dateStr).toISOString();
          } else if (v.includes('between:')) {
            const dates = v.replace('between:', '').split('..');
            if (dates.length === 2) {
              filters.updatedFrom = new Date(dates[0]).toISOString();
              filters.updatedTo = new Date(dates[1]).toISOString();
            }
          } else {
            filters.updatedFrom = new Date(v).toISOString();
            filters.updatedTo = new Date(`${v}T23:59:59`).toISOString();
          }
          break;
        }
      }
    });

    if (includeLegacyDate && dateFilter !== 'all') {
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
      const hasDateFilters = filters.createdFrom || filters.createdTo || filters.updatedFrom || filters.updatedTo;
      if (!hasDateFilters) {
        filters.createdFrom = createdFrom.toISOString();
        filters.createdTo = now.toISOString();
      }
    }

    return filters;
  }, [dateFilter, showAllModels]);

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
        const filters = buildApiFiltersFromParsedFilters(parsedFilters, true);
        
        const response = await apiService.findMetaModels(filters);
        setApiModels(response.data || []);
        setCurrentPage(1);
      } catch (error) {
        console.error('Error fetching meta models from API:', error);
        setApiError(error instanceof Error ? error.message : 'Failed to fetch meta models');
      } finally {
        setIsLoadingModels(false);
      }
    };
    
    fetchData();
  }, [parsedFilters, dateFilter, suppressApi, showAllModels, buildApiFiltersFromParsedFilters]);

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

  const totalItems = sortedModels.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageItems = sortedModels.slice(startIndex, endIndex);

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

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setDeleteError('');
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await apiService.deleteMetaModel(deletingId);
      setUploadMessage('Meta Model deleted successfully!');
      setUploadMessageType('success');
      const filters = buildApiFiltersFromParsedFilters(parsedFilters, true);
      const response = await apiService.findMetaModels(filters);
      setApiModels(response.data || []);
      setDeleteConfirmOpen(false);
      setDeletingId(null);
      setDeleteError('');
      setTimeout(() => setUploadMessage(''), 3000);
    } catch (error: any) {
      let msg = 'Failed to delete meta model';
      if (error?.response?.data?.message) {
        msg = error.response.data.message;
      } else if (error?.message) {
        msg = error.message;
      }
      setDeleteError(msg);
      setUploadMessage(msg);
      setUploadMessageType('error');
    }
  };

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
            Building...
          </>
        ) : (
          <>
            Import Meta Model
          </>
        )}
      </button>

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
        <div style={{
          display: 'flex',
          gap: '8px',
          margin: '8px 0',
          alignItems: 'stretch',
        }}>
          {/* Left column: Show Advanced Search */}
          <button
            style={{
              ...toggleButtonStyle,
              flex: '0 0 auto',
              minWidth: '150px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
            }}
            onClick={() => setShowFilters(!showFilters)}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, {
                ...toggleButtonHoverStyle,
                justifyContent: 'center',
              });
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, {
                ...toggleButtonStyle,
                justifyContent: 'center',
              });
            }}
          >
            <span style={{ textAlign: 'center', lineHeight: '1.3' }}>
              {showFilters ? 'Hide' : 'Show'}<br />Advanced Search
            </span>
            <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
              {showFilters ? '▼' : '▶'}
            </span>
          </button>
          
          {/* Right column: Sort + Ownership stacked */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flex: '1',
          }}>
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
            
            <button 
              style={showAllModels ? ownershipToggleActiveStyle : ownershipToggleStyle}
              onClick={() => setShowAllModels(v => !v)}
              title={showAllModels ? 'Showing all meta models' : 'Showing only my meta models'}
            >
              {showAllModels ? 'All Models' : 'My Models'}
            </button>
          </div>
        </div>
      )}

      {showFilters && (
        <div style={filterContainerStyle}>
          <button
            aria-label="Close filters"
            title="Close"
            style={filterCloseButtonStyle}
            onClick={() => setShowFilters(false)}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f3f5'; e.currentTarget.style.color = '#495057'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6c757d'; }}
          >
            ×
          </button>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#495057', marginBottom: '8px' }}>
            Advanced Search
          </div>
          
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
              onKeyDown={handleSearchKeyDown}
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
          
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e9ecef' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#495057', marginBottom: '8px' }}>
              Quick Filters
            </div>
            
            <div style={filterRowStyle}>
              <span style={filterLabelStyle}>Name:</span>
              <input
                type="text"
                placeholder="Filter by name..."
                style={filterInputStyle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = e.currentTarget.value.trim();
                    if (value) {
                      setSearchTerm(prev => prev ? `${prev} name:${value}` : `name:${value}`);
                      e.currentTarget.value = '';
                    }
                  }
                }}
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
      <div style={{ 
        height: 'calc(100vh - 311px)', 
        overflowY: 'auto',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
      }}>
        {!suppressApi && currentPageItems.map(model => (
          <div key={model.id} style={fileCardStyle}
               onClick={() => {
                 if (!enableItemClick) return;
                 setViewModel(model);
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(model.id);
                }}
                style={{
                  padding: '4px 8px',
                  border: '1px solid #dee2e6',
                  borderRadius: 6,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 'clamp(10px, 1.8vw, 12px)',
                  fontWeight: 600,
                  color: '#e03131',
                  marginLeft: 'auto',
                  minWidth: 'fit-content',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                title="Delete this meta model"
              >
                Delete
              </button>
            </div>
            {expandedCard === model.id && (
              <>
                {model.keyword && model.keyword.length > 0 && (
                  <div style={{
                    fontSize: 'clamp(11px, 2vw, 12px)',
                    color: '#495057',
                    marginTop: '6px',
                    fontFamily: 'Georgia, serif',
                    wordBreak: 'break-word',
                    lineHeight: '1.4'
                  }}>
                    <strong>Keywords:</strong> {model.keyword.join(', ')}
                  </div>
                )}
                {model.description && (
                  <div style={{
                    fontSize: 'clamp(11px, 2vw, 12px)',
                    color: '#6c757d',
                    marginTop: '4px',
                    fontStyle: 'italic',
                    fontFamily: 'Georgia, serif',
                    lineHeight: '1.4',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word'
                  }}>
                    <strong>Description:</strong> {model.description}
                  </div>
                )}
              </>
            )}
            
            {expandedCard !== model.id && (
              <div style={{
                fontSize: 'clamp(9px, 1.5vw, 10px)',
                color: '#adb5bd',
                marginTop: '4px',
                fontStyle: 'italic',
                fontFamily: 'Georgia, serif',
                lineHeight: '1.3'
              }}>
                Right-click to view details
              </div>
            )}
          </div>
        ))}
        {!suppressApi && !isLoadingModels && sortedModels.length === 0 && !apiError && (
          <div style={emptyStateStyle}>
            No meta models available.
          </div>
        )}
      </div>
      )}

      {viewModel && (
          <div
              style={{
                userSelect: 'text',
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                zIndex: 9998,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
          >
            <div
                style={{
                  background: '#ffffff',
                  borderRadius: 10,
                  boxShadow: '0 6px 24px rgba(0,0,0,0.2)',
                  padding: '24px 28px',
                  maxWidth: 520,
                  width: '90%',
                  fontFamily: 'Georgia, serif',
                }}
            >
              <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                  }}
              >
                <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#2c3e50',
                    }}
                >
                  Meta Model Details
                </div>
                <button
                    onClick={() => setViewModel(null)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: 18,
                      cursor: 'pointer',
                      color: '#6c757d',
                    }}
                    aria-label="Close"
                    title="Close"
                >
                  ×
                </button>
              </div>

              <div
                  style={{
                    fontSize: 13,
                    color: '#495057',
                    lineHeight: 1.5,
                  }}
              >
                <p>
                  <strong>Name:</strong> {viewModel.name}
                </p>
                <p style={{ marginTop: 12 }}>
                  <strong>Description:</strong>
                  <br />
                  <span style={{ fontStyle: 'italic' }}>
                  {viewModel.description || 'No description provided.'}
                </span>
                </p>
                <p>
                  <strong>Domain:</strong> {viewModel.domain || '—'}
                </p>
                <p>
                  <strong>Keywords:</strong>{' '}
                  {viewModel.keyword && viewModel.keyword.length > 0
                      ? viewModel.keyword.join(', ')
                      : '—'}
                </p>
                <p>
                  <strong>Created At:</strong>{' '}
                  {viewModel.createdAt
                      ? formatRelativeTime(viewModel.createdAt)
                      : '—'}
                </p>
                {viewModel.updatedAt && (
                    <p>
                      <strong>Updated At:</strong>{' '}
                      {formatRelativeTime(viewModel.updatedAt)}
                    </p>
                )}
              </div>

              <div
                  style={{
                    marginTop: 20,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 8,
                  }}
              >
                {onEcoreFileUpload && (
                    <button
                        onClick={() => {
                          onEcoreFileUpload(`name="${viewModel.name}"`, {
                            fileName: `${viewModel.name}.ecore`,
                            uploadId: viewModel.id?.toString(),
                            description: viewModel.description,
                            keywords: viewModel.keyword?.join(', '),
                            domain: viewModel.domain,
                            createdAt: viewModel.createdAt,
                          });
                        }}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 6,
                          border: '1px solid #3498db',
                          background: '#3498db',
                          color: '#ffffff',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                    >
                      Load into workspace
                    </button>
                )}
                <button
                    onClick={() => setViewModel(null)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      border: '1px solid #dee2e6',
                      background: '#ffffff',
                      color: '#495057',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
      )}

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
              const shouldShow = 
                page === 1 || 
                page === totalPages || 
                Math.abs(page - currentPage) <= 1;
              
              if (!shouldShow) {
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
              const filters = buildApiFiltersFromParsedFilters(parsedFilters, true);
              const response = await apiService.findMetaModels(filters);
              setApiModels(response.data || []);
            } catch (error) {
              setApiError(error instanceof Error ? error.message : 'Failed to fetch meta models');
            } finally {
              setIsLoadingModels(false);
            }
          };
          fetchData();
        }}
      />

      {deleteConfirmOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.25)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            padding: '32px 24px',
            minWidth: 320,
            textAlign: 'center',
            fontFamily: 'Georgia, serif'
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#e03131' }}>
              Are you sure you want to delete this meta model?
            </div>
            <div style={{ fontSize: 13, color: '#495057', marginBottom: 24 }}>
              This action cannot be undone.
            </div>
            {deleteError && (
              <div style={{
                color: '#e03131',
                background: '#f8d7da',
                border: '1px solid #f5c6cb',
                borderRadius: 6,
                padding: '8px',
                marginBottom: '16px',
                fontSize: 13,
                fontWeight: 500,
              }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#e03131',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14
                }}
                onClick={handleConfirmDelete}
              >
                Confirm
              </button>
              <button
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  border: '1px solid #dee2e6',
                  background: '#fff',
                  color: '#495057',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14
                }}
                onClick={() => { setDeleteConfirmOpen(false); setDeletingId(null); setDeleteError(''); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};