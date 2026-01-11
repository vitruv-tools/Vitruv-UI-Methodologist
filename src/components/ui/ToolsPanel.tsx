import React, { useState, useEffect, useCallback } from 'react';
import { CreateModelModal } from './CreateModelModal';
import { EditMetaModelModal } from './EditMetaModelModal';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

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
  fontSize: '18px',
  fontWeight: 700,
  marginBottom: '16px',
  color: '#2c3e50',
  textAlign: 'left',
  padding: '8px 0',
  borderBottom: '1px solid #2c3e50',
  fontFamily: 'Georgia, serif',
};

const createButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 18px',
  marginBottom: '12px',
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

// Pure helper functions moved outside component to avoid recreation on each render
const SEARCH_KEY_MAP: Record<string, string> = {
  name: 'name',
  domain: 'domain',
  keyword: 'keywords',
  keywords: 'keywords',
  description: 'description',
  desc: 'description',
  created: 'created',
  updated: 'updated',
};

const tokenizeQuery = (query: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (const ch of query) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    const isWhitespace = !inQuotes && /\s/.test(ch);
    if (isWhitespace) {
      if (current.trim()) tokens.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  
  if (current.trim()) tokens.push(current);
  return tokens;
};

const parseTimeFilter = (cleanValue: string) => {
  const isBeforeNow = cleanValue === 'beforenow' || cleanValue === 'before:now';
  if (isBeforeNow) {
    return { key: 'created', value: 'before:now', display: 'time:beforenow' };
  }
  const isAfterNow = cleanValue === 'afternow' || cleanValue === 'after:now';
  if (isAfterNow) {
    return { key: 'created', value: 'after:now', display: 'time:afternow' };
  }
  return { key: 'created', value: cleanValue, display: `time:${cleanValue}` };
};

const parseDateValue = (dateStr: string): string => {
  return dateStr === 'now' ? new Date().toISOString() : new Date(dateStr).toISOString();
};

const parseDateRangeFilter = (value: string): { from?: string; to?: string } => {
  const v = String(value);
  
  if (v.includes('after:')) {
    return { from: parseDateValue(v.replace('after:', '')) };
  }
  if (v.includes('before:')) {
    return { to: parseDateValue(v.replace('before:', '')) };
  }
  if (v.includes('between:')) {
    const dates = v.replace('between:', '').split('..');
    if (dates.length === 2) {
      return { from: new Date(dates[0]).toISOString(), to: new Date(dates[1]).toISOString() };
    }
    return {};
  }
  if (v === 'before:now') {
    return { to: new Date().toISOString() };
  }
  if (v === 'after:now') {
    return { from: new Date().toISOString() };
  }
  return { from: new Date(v).toISOString(), to: new Date(`${v}T23:59:59`).toISOString() };
};

const checkModelOwnership = (viewModel: any, user: any): boolean => {
  const userId = user?.id ? String(user.id) : null;
  if (!userId || !viewModel) return false;
  
  return (
    String(viewModel.ownerId) === userId ||
    String(viewModel.userId) === userId ||
    viewModel.ownedByUser ||
    String(viewModel.owner?.id) === userId ||
    String(viewModel.createdBy) === userId ||
    String(viewModel.createdById) === userId
  );
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
  const [parsedFilters, setParsedFilters] = useState<any[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string>('');
  const [viewModel, setViewModel] = useState<any>(null);
  const [showAllModels, setShowAllModels] = useState(false);
  const [metaModelModalTab, setMetaModelModalTab] = useState<'details' | 'edit'>('details');
  const [showEditModal, setShowEditModal] = useState(false);
  const { user } = useAuth();
  const [metaModelDeleteConfirmOpen, setMetaModelDeleteConfirmOpen] = useState(false);
  const [metaModelDeleting, setMetaModelDeleting] = useState(false);
  const [metaModelDeleteError, setMetaModelDeleteError] = useState<string>('');

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

  const parseSearchQuery = useCallback((query: string) => {
    const result: any[] = [];
    const tokens = tokenizeQuery(query);

    for (const token of tokens) {
      const match = /^([a-zA-Z]+):(.+)$/.exec(token);
      if (!match) continue;

      const key = match[1].toLowerCase();
      const cleanValue = match[2].trim();

      if (key === 'time') {
        result.push(parseTimeFilter(cleanValue));
        continue;
      }

      const mappedKey = SEARCH_KEY_MAP[key];
      if (mappedKey) {
        result.push({ key: mappedKey, value: cleanValue, display: `${mappedKey}:${cleanValue}` });
      }
    }

    return result;
  }, []);

  const getLegacyDateFrom = (filter: string): Date => {
    const now = new Date();
    const dateMap: Record<string, () => Date> = {
      today: () => new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      week: () => new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      month: () => new Date(now.getFullYear(), now.getMonth(), 1),
      year: () => new Date(now.getFullYear(), 0, 1),
    };
    return dateMap[filter]?.() ?? new Date(0);
  };

  const applyFilterToResult = useCallback((filters: any, filter: { key: string; value: string }) => {
    const simpleKeys = ['name', 'domain', 'description'];
    if (simpleKeys.includes(filter.key)) {
      filters[filter.key] = filter.value;
      return;
    }

    if (filter.key === 'keywords') {
      const values = String(filter.value).split(',').map(v => v.trim()).filter(v => v.length > 0);
      if (values.length > 0) filters.keyword = values;
      return;
    }

    if (filter.key === 'created') {
      const range = parseDateRangeFilter(filter.value);
      if (range.from) filters.createdFrom = range.from;
      if (range.to) filters.createdTo = range.to;
      return;
    }

    if (filter.key === 'updated') {
      const range = parseDateRangeFilter(filter.value);
      if (range.from) filters.updatedFrom = range.from;
      if (range.to) filters.updatedTo = range.to;
    }
  }, []);

  const buildApiFiltersFromParsedFilters = useCallback((filtersParsed: any[], includeLegacyDate = true) => {
    const filters: any = {};
    filters.ownedByUser = !showAllModels;
    
    filtersParsed.forEach(filter => applyFilterToResult(filters, filter));

    const shouldApplyLegacyDate = includeLegacyDate && dateFilter !== 'all';
    const hasDateFilters = filters.createdFrom || filters.createdTo || filters.updatedFrom || filters.updatedTo;
    
    if (shouldApplyLegacyDate && !hasDateFilters) {
      const now = new Date();
      filters.createdFrom = getLegacyDateFrom(dateFilter).toISOString();
      filters.createdTo = now.toISOString();
    }

    return filters;
  }, [dateFilter, showAllModels, applyFilterToResult]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filters = parseSearchQuery(searchTerm);
      setParsedFilters(filters);
    } else {
      setParsedFilters([]);
    }
  }, [searchTerm, parseSearchQuery]);

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

  const formatRelativeTime = (isoDate: string) => {
    const date = new Date(isoDate);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} at ${timeStr}`;
  };

  const handleButtonClick = () => {
    setShowCreateModal(true);
  };

  const panelStyle: React.CSSProperties = { ...toolsPanelStyle, borderRight: showBorder ? toolsPanelStyle.borderRight : 'none' };

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
        style={createButtonStyle}
        onClick={handleButtonClick}
        disabled={isProcessing}
        onMouseEnter={(e) => !isProcessing && Object.assign(e.currentTarget.style, createButtonHoverStyle)}
        onMouseLeave={(e) => !isProcessing && Object.assign(e.currentTarget.style, createButtonStyle)}
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
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              onClick={() => {
                const filters = buildApiFiltersFromParsedFilters(parseSearchQuery(searchTerm), true);
                const fetchData = async () => {
                  setIsLoadingModels(true);
                  setApiError('');
                  try {
                    const response = await apiService.findMetaModels(filters);
                    setApiModels(response.data || []);
                    setCurrentPage(1);
                  } catch (error) {
                    setApiError(error instanceof Error ? error.message : 'Failed to fetch meta models');
                  } finally {
                    setIsLoadingModels(false);
                  }
                };
                fetchData();
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Search
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                background: '#ffffff',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {showFilters ? 'Hide' : 'Show'} Advanced Search
              <span style={{ fontSize: 10 }}>{showFilters ? '▼' : '▶'}</span>
            </button>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-') as ['name' | 'date' | 'domain', 'asc' | 'desc'];
                setSortBy(newSortBy);
                setSortOrder(newSortOrder);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                background: '#ffffff',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                color: '#374151',
                outline: 'none',
              }}
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="domain-asc">Domain A-Z</option>
              <option value="domain-desc">Domain Z-A</option>
            </select>
            <button 
              onClick={() => setShowAllModels(v => !v)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                background: '#ffffff',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                color: '#374151',
              }}
              title={showAllModels ? 'Show only my meta models' : 'Show all meta models'}
            >
              {showAllModels ? 'All Models' : 'My Models'}
            </button>
          </div>

          <div
            style={{
              marginTop: '16px',
              marginBottom: '8px',
              fontWeight: 700,
              fontSize: '13px',
              color: '#2c3e50',
              borderBottom: '1px solid #2c3e50',
              paddingBottom: '6px',
              fontFamily: 'Georgia, serif',
            }}
          >
            {showAllModels ? 'All' : 'My Models'}
          </div>
        </>
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
              {parsedFilters.map((filter) => (
                <div key={`${filter.key}-${filter.value}`} style={filterTagStyle}>
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
          <div
            key={model.id}
            style={fileCardStyle}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!enableItemClick) return;
                console.log('=== BACKEND RESPONSE - Meta Model Data (from card click) ===');
                console.log('Full model object:', model);
                console.log('Model keys:', Object.keys(model));
                console.log('Ownership fields check:', {
                  ownerId: model.ownerId,
                  userId: model.userId,
                  ownedByUser: model.ownedByUser,
                  owner: model.owner,
                  currentUser: user,
                });
                console.log('==========================================');
                setViewModel(model);
              }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 700, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {model.name}
                </div>
                <div style={{ fontSize: 12, color: '#5a6c7d' }}>
                  Created: {(() => {
                    const d = new Date(model.createdAt);
                    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                  })()}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewModel(model);
                }}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #dee2e6',
                  borderRadius: 6,
                  background: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Details
              </button>
            </div>
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
          <dialog
              open
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                height: '100%',
                margin: 0,
                padding: 0,
                border: 'none',
                background: 'transparent',
                zIndex: 9998,
              }}
          >
            <div
              role="presentation"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                zIndex: -1,
              }}
              onClick={() => setViewModel(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
                  e.preventDefault();
                  setViewModel(null);
                }
              }}
              tabIndex={0}
              aria-hidden="true"
            />
            <div
                style={{
                  position: 'relative',
                  width: 900,
                  maxWidth: '95vw',
                  maxHeight: '90vh',
                  background: '#fff',
                  borderRadius: 12,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  fontFamily: 'Georgia, serif',
                  margin: 'auto',
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="dialog-title"
                onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 id="dialog-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#2c3e50' }}>{viewModel.name ?? 'Meta Model Details'}</h3>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                      onClick={() => setMetaModelModalTab('details')}
                      style={{
                        border: '1px solid #dee2e6',
                        background: metaModelModalTab === 'details' ? '#e7f5ff' : '#fff',
                        borderRadius: 6,
                        padding: '6px 10px',
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                  >
                    Details
                  </button>
                  
                  {/* Edit button - temporarily visible for all to debug ownership */}
                  {(() => {
                    const isOwner = checkModelOwnership(viewModel, user);
                    
                    // Detailed debug logging - expand this in console to see all fields
                    if (viewModel) {
                      const userId = user?.id ? String(user.id) : null;
                      console.log('=== EDIT BUTTON OWNERSHIP DEBUG ===');
                      console.log('Current User:', user);
                      console.log('User ID (string):', userId);
                      console.log('Meta Model Object:', viewModel);
                      console.log('All Meta Model Keys:', Object.keys(viewModel));
                      console.log('Ownership Field Values:', {
                        ownerId: viewModel.ownerId,
                        userId: viewModel.userId,
                        ownedByUser: viewModel.ownedByUser,
                        owner: viewModel.owner,
                        createdBy: viewModel.createdBy,
                        createdById: viewModel.createdById,
                      });
                      console.log('Comparison Results:', {
                        'ownerId === userId': String(viewModel.ownerId) === userId,
                        'userId === userId': String(viewModel.userId) === userId,
                        'ownedByUser === true': viewModel.ownedByUser === true,
                        'owner.id === userId': String(viewModel.owner?.id) === userId,
                        'createdBy === userId': String(viewModel.createdBy) === userId,
                        'createdById === userId': String(viewModel.createdById) === userId,
                      });
                      console.log('Final isOwner result:', isOwner);
                      console.log('===================================');
                    }
                    
                    return (
                      <button
                          onClick={() => {
                            setShowEditModal(true);
                          }}
                          style={{
                            border: '1px solid #dee2e6',
                            background: metaModelModalTab === 'edit' ? '#e7f5ff' : '#fff',
                            borderRadius: 6,
                            padding: '6px 10px',
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                      >
                        Edit
                      </button>
                    );
                  })()}

                  <button aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#6c757d' }} onClick={() => setViewModel(null)}>
                    ×
                  </button>
                </div>
              </div>

              <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
                {metaModelModalTab === 'edit' && (
                    <div style={{ fontSize: 13, color: '#6c757d', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                      Click the "Edit" button above to open the edit modal.
                    </div>
                )}
                {metaModelModalTab === 'details' && (
                    <>
                      <div style={{ fontSize: 12, color: '#6c757d', marginBottom: 10 }}>
                        {viewModel.updatedAt && (
                            <>
                              <strong>Updated:</strong> {new Date(viewModel.updatedAt).toLocaleDateString()}
                            </>
                        )}
                      </div>

                      <div style={{ fontSize: 12, fontWeight: 700, color: '#495057', marginTop: 12, marginBottom: 6 }}>Name</div>
                      <div style={{ fontSize: 13, color: '#2c3e50', marginBottom: 12 }}>{viewModel.name}</div>

                      <div style={{ fontSize: 12, fontWeight: 700, color: '#495057', marginTop: 12, marginBottom: 6 }}>Description</div>
                      <div style={{ fontSize: 13, color: '#2c3e50', marginBottom: 12 }}>
                        {viewModel.description || <span style={{ fontStyle: 'italic', color: '#6c757d' }}>No description provided.</span>}
                      </div>

                      <div style={{ fontSize: 12, fontWeight: 700, color: '#495057', marginTop: 12, marginBottom: 6 }}>Domain</div>
                      <div style={{ fontSize: 13, color: '#2c3e50', marginBottom: 12 }}>{viewModel.domain || '—'}</div>

                      <div style={{ fontSize: 12, fontWeight: 700, color: '#495057', marginTop: 12, marginBottom: 6 }}>Keywords</div>
                      <div style={{ fontSize: 13, color: '#2c3e50', marginBottom: 12 }}>
                        {viewModel.keyword && viewModel.keyword.length > 0
                            ? viewModel.keyword.join(', ')
                            : '—'}
                      </div>

                      {viewModel.createdAt && (
                          <>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#495057', marginTop: 12, marginBottom: 6 }}>Created At</div>
                            <div style={{ fontSize: 13, color: '#2c3e50', marginBottom: 12 }}>
                              {formatRelativeTime(viewModel.createdAt)}
                            </div>
                          </>
                      )}

                      {viewModel.updatedAt && (
                          <>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#495057', marginTop: 12, marginBottom: 6 }}>Updated At</div>
                            <div style={{ fontSize: 13, color: '#2c3e50', marginBottom: 12 }}>
                              {formatRelativeTime(viewModel.updatedAt)}
                            </div>
                          </>
                      )}
                    </>
                )}
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid #e9ecef', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <button
                    style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      border: '1px solid #dee2e6',
                      background: '#fff',
                      color: '#495057',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    onClick={() => setViewModel(null)}
                >
                  Close
                </button>

                <div style={{ display: 'flex', gap: 8 }}>
                  {metaModelModalTab === 'details' && (
                      <button
                          style={{
                            padding: '8px 14px',
                            borderRadius: 6,
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#dc2626',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          onClick={() => setMetaModelDeleteConfirmOpen(true)}
                      >
                        Delete
                      </button>
                  )}
                </div>
              </div>
            </div>
          </dialog>
      )}

      {/* Meta Model Delete Confirmation */}
      {metaModelDeleteConfirmOpen && viewModel && (
          <div
              role="dialog"
              aria-modal="true"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                height: '100%',
                margin: 0,
                padding: 0,
                border: 'none',
                background: 'transparent',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
          >
            <div
              role="presentation"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                zIndex: -1,
              }}
              onClick={() => { if (!metaModelDeleting) setMetaModelDeleteConfirmOpen(false); }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') && !metaModelDeleting) {
                  e.preventDefault();
                  setMetaModelDeleteConfirmOpen(false);
                }
              }}
              tabIndex={0}
              aria-hidden="true"
            />
            <div
                style={{
                  position: 'relative',
                  width: 420,
                  maxWidth: '90vw',
                  background: '#fff',
                  borderRadius: 10,
                  boxShadow: '0 14px 34px rgba(0,0,0,0.25)',
                  overflow: 'hidden',
                  fontFamily: 'Georgia, serif',
                  margin: 'auto',
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-dialog-title"
                onClick={(e) => e.stopPropagation()}
            >
              <h2 id="delete-dialog-title" style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, color: '#1f2937', margin: 0, fontSize: 16 }}>
                Are you sure?
              </h2>

              <div style={{ padding: '16px', color: '#4b5563', fontSize: 14 }}>
                This action will permanently delete this Meta Model and cannot be undone.
                {metaModelDeleteError && (
                    <div
                        style={{
                          marginTop: 12,
                          padding: 10,
                          border: '1px solid #f5c6cb',
                          background: '#f8d7da',
                          color: '#721c24',
                          borderRadius: 6,
                          fontSize: 12,
                        }}
                    >
                      {metaModelDeleteError}
                    </div>
                )}
              </div>

              <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                    onClick={() => {
                      setMetaModelDeleteConfirmOpen(false);
                      setMetaModelDeleteError('');
                    }}
                    disabled={metaModelDeleting}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      border: '1px solid #dee2e6',
                      background: '#fff',
                      color: '#374151',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                >
                  Cancel
                </button>

                <button
                    onClick={async () => {
                      if (!viewModel?.id) return;
                      setMetaModelDeleteError('');
                      setMetaModelDeleting(true);
                      try {
                        await apiService.deleteMetaModel(viewModel.id);
                        setMetaModelDeleteConfirmOpen(false);
                        setViewModel(null);
                        setUploadMessage('Meta Model deleted successfully!');
                        setUploadMessageType('success');
                        const filters = buildApiFiltersFromParsedFilters(parsedFilters, true);
                        const response = await apiService.findMetaModels(filters);
                        setApiModels(response.data || []);
                        setTimeout(() => setUploadMessage(''), 3000);
                      } catch (error: any) {
                        let msg = 'Failed to delete meta model';
                        if (error?.response?.data?.message) {
                          msg = error.response.data.message;
                        } else if (error?.message) {
                          msg = error.message;
                        }
                        setMetaModelDeleteError(msg);
                      } finally {
                        setMetaModelDeleting(false);
                      }
                    }}
                    disabled={metaModelDeleting}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#dc2626',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                >
                  {metaModelDeleting ? 'Deleting…' : 'Delete'}
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

      {/* Edit Meta Model Modal */}
      {showEditModal && viewModel && (
        <EditMetaModelModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setMetaModelModalTab('details');
          }}
          onSuccess={async () => {
            // Refresh the meta models list and get updated model data
            // This handles all 3 backend scenarios:
            // 1. Original owned by user -> updates original
            // 2. Clone owned by user, original also owned -> updates both
            // 3. Clone owned by user, original owned by different user -> creates new source, updates both
            const refreshData = async () => {
              setIsLoadingModels(true);
              setApiError('');
              try {
                // First, refresh the list
                const filters = buildApiFiltersFromParsedFilters(parsedFilters, true);
                const listResponse = await apiService.findMetaModels(filters);
                setApiModels(listResponse.data || []);
                
                // Then, fetch the specific meta model to get latest data including any new source relationships
                // This is important for scenario 3 where a new source might be created
                try {
                  const modelResponse = await apiService.getMetaModel(String(viewModel.id));
                  if (modelResponse.data) {
                    setViewModel(modelResponse.data);
                  } else {
                    // Fallback: find in the list
                    const updatedModel = listResponse.data?.find((m: any) => m.id === viewModel.id);
                    if (updatedModel) {
                      setViewModel(updatedModel);
                    }
                  }
                } catch (modelError) {
                  // If fetching specific model fails, use the list data
                  console.warn('Could not fetch specific model, using list data:', modelError);
                  const updatedModel = listResponse.data?.find((m: any) => m.id === viewModel.id);
                  if (updatedModel) {
                    setViewModel(updatedModel);
                  }
                }
              } catch (error) {
                console.error('Error refreshing meta models:', error);
              } finally {
                setIsLoadingModels(false);
              }
            };
            await refreshData();
          }}
          metaModel={viewModel}
          isOwner={checkModelOwnership(viewModel, user)}
        />
      )}
    </div>
  );
};