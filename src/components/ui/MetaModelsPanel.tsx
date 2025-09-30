import React, { useEffect, useState, useCallback } from 'react';
import { apiService } from '../../services/api';
import { ConfirmDialog } from './ConfirmDialog';

interface MetaModelsPanelProps {
  activeVsumId?: number | null;
  selectedMetaModelIds?: number[];
  onAddToActiveVsum?: (model: any) => void;
  initialWidth?: number;
}

const containerStyle: React.CSSProperties = {
  userSelect: 'none',
  width: '100%',
  background: '#f8f9fa',
  padding: '16px',
  boxSizing: 'border-box',
  height: '100%',
  overflowY: 'auto',
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

// Removed unused controlsRowStyle

// Match ToolsPanel toggle and sort styles
const toggleContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  margin: '8px 0',
  alignItems: 'center',
};

const toggleButtonStyle: React.CSSProperties = {
  flex: 1,
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

// Exact Advanced Search dropdown styles from ToolsPanel
const filterContainerStyle: React.CSSProperties = {
  position: 'fixed',
  top: '160px',
  right: '15px',
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
  padding: '16px',
  marginBottom: '12px',
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
  transition: 'all 0.3s ease',
};

const fileCardHoverStyle: React.CSSProperties = {
  boxShadow: '0 4px 12px rgba(52, 152, 219, 0.15)',
  transform: 'translateY(-1px)',
  borderColor: '#3498db',
  background: '#f8f9ff',
};

const fileNameStyle: React.CSSProperties = {
  fontWeight: 600,
  color: '#2c3e50',
  wordBreak: 'break-all',
  marginBottom: '6px',
  fontSize: 15,
  fontFamily: 'Georgia, serif',
};

const fileMetaStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#5a6c7d',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontFamily: 'Georgia, serif',
  fontStyle: 'italic',
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

export const MetaModelsPanel: React.FC<MetaModelsPanelProps> = ({ activeVsumId, selectedMetaModelIds, onAddToActiveVsum, initialWidth }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'domain'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [apiModels, setApiModels] = useState<any[]>([]);
  const [apiError, setApiError] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [parsedFilters, setParsedFilters] = useState<any[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    if (!lower) return;

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

    // Tokenize respecting quotes
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
            // Unknown key: ignore
        }
      } else if (token.trim().length > 0) {
        // Bare word ignored
      }
    }

    return result;
  };

  const filterTagsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginBottom: '8px',
    minHeight: '24px',
  };

  const filterTagStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '16px',
    fontSize: 11,
    fontWeight: 500,
    color: '#0366d6',
    background: '#f1f8ff',
    border: '1px solid #c8e1ff',
    margin: '2px',
    userSelect: 'none',
  };

  const enhancedSearchInputStyle: React.CSSProperties = {
    ...filterInputStyle,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    fontSize: '13px',
  };

  // Keep parsed filters in sync with searchTerm
  useEffect(() => {
    if (searchTerm.trim()) {
      setParsedFilters(parseSearchQuery(searchTerm));
    } else {
      setParsedFilters([]);
    }
  }, [searchTerm]);

  const buildApiFiltersFromParsedFilters = useCallback((filtersParsed: any[], includeLegacyDate = true) => {
    const filters: any = {};
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
  }, [dateFilter]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingModels(true);
      setApiError('');
      try {
        const filters = buildApiFiltersFromParsedFilters(parsedFilters, true);
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
  }, [parsedFilters, dateFilter, buildApiFiltersFromParsedFilters]);

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

  const formatRelativeTime = (isoDate: string) => {
    const date = new Date(isoDate);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} at ${timeStr}`;
  };

  const panelStyle: React.CSSProperties = { 
    ...containerStyle, 
    width: initialWidth ? `${initialWidth}px` : containerStyle.width
  };

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>Meta Models</div>
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

      {showFilters && (
        <div style={filterContainerStyle}>
          <button
            aria-label="Close filters"
            title="Close"
            style={filterCloseButtonStyle}
            onClick={() => setShowFilters(false)}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f1f3f5'; (e.currentTarget as HTMLButtonElement).style.color = '#495057'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#6c757d'; }}
          >
            ×
          </button>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#495057', marginBottom: '8px' }}>
            Advanced Search
          </div>

          {parsedFilters.length > 0 && (
            <div style={filterTagsContainerStyle}>
              {parsedFilters.map((filter, index) => (
                <div key={index} style={filterTagStyle}>{filter.display}</div>
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
              onChange={(e) => setDateFilter(e.target.value as any)}
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
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#495057', marginBottom: '8px' }}>
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
                    const value = (e.currentTarget as HTMLInputElement).value.trim();
                    if (value) {
                      setSearchTerm(prev => prev ? `${prev} name:${value}` : `name:${value}`);
                      (e.currentTarget as HTMLInputElement).value = '';
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
                    const domainValue = (e.currentTarget as HTMLInputElement).value.trim();
                    if (domainValue) {
                      setSearchTerm(prev => prev ? `${prev} domain:${domainValue}` : `domain:${domainValue}`);
                      (e.currentTarget as HTMLInputElement).value = '';
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
                    const keywordValue = (e.currentTarget as HTMLInputElement).value.trim();
                    if (keywordValue) {
                      setSearchTerm(prev => prev ? `${prev} keywords:${keywordValue}` : `keywords:${keywordValue}`);
                      (e.currentTarget as HTMLInputElement).value = '';
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
                  const dateValue = (e.target as HTMLInputElement).value;
                  if (dateValue) {
                    setSearchTerm(prev => prev ? `${prev} created:${dateValue}` : `created:${dateValue}`);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

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

      <div>
        {currentPageItems.map(model => (
          <div
            key={model.id}
            style={fileCardStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, fileCardHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, fileCardStyle)}
          >
            <div style={fileNameStyle}>{model.name}</div>
            <div style={fileMetaStyle}>
              <span>Domain: <strong>{model.domain}</strong></span>
              <span>•</span>
              <span title={new Date(model.createdAt).toLocaleString()}>{formatRelativeTime(model.createdAt)}</span>
              <span>•</span>
              <button
                onClick={() => { setDeletingId(model.id); setConfirmOpen(true); }}
                style={{ padding: '4px 8px', border: '1px solid #dee2e6', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#e03131' }}
              >
                Delete
              </button>
              {activeVsumId ? (
                <>
                  <span>•</span>
                  {onAddToActiveVsum && (
                    <button
                      onClick={() => onAddToActiveVsum(model)}
                      style={{ padding: '4px 8px', border: '1px solid #dee2e6', borderRadius: 6, background: '#ffffff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      disabled={(selectedMetaModelIds || []).includes(model.id)}
                    >
                      {(selectedMetaModelIds || []).includes(model.id) ? 'Added' : 'Add to Vsum'}
                    </button>
                  )}
                </>
              ) : null}
            </div>
          </div>
        ))}
        {!isLoadingModels && sortedModels.length === 0 && !apiError && (
          <div style={{ padding: 16, fontSize: 13, color: '#6c757d', fontStyle: 'italic' }}>
            No meta models available from server.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={paginationContainerStyle}>
          <div style={paginationInfoStyle}>
            Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} models
          </div>
          <div style={paginationControlsStyle}>
            <button
              style={{ ...paginationButtonStyle, ...(currentPage === 1 ? paginationButtonDisabledStyle : {}) }}
              onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              onMouseEnter={(e) => { if (currentPage > 1) Object.assign(e.currentTarget.style, paginationButtonHoverStyle); }}
              onMouseLeave={(e) => { if (currentPage > 1) Object.assign(e.currentTarget.style, paginationButtonStyle); }}
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
              const shouldShow = page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
              if (!shouldShow) {
                if (page === 2 && currentPage > 4) return <span key={`ellipsis-${page}`} style={{ padding: '0 4px', color: '#6c757d' }}>...</span>;
                if (page === totalPages - 1 && currentPage < totalPages - 3) return <span key={`ellipsis-${page}`} style={{ padding: '0 4px', color: '#6c757d' }}>...</span>;
                return null;
              }
              return (
                <button
                  key={page}
                  style={{ ...paginationButtonStyle, ...(page === currentPage ? paginationButtonActiveStyle : {}) }}
                  onClick={() => setCurrentPage(page)}
                  onMouseEnter={(e) => { if (page !== currentPage) Object.assign(e.currentTarget.style, paginationButtonHoverStyle); }}
                  onMouseLeave={(e) => { if (page !== currentPage) Object.assign(e.currentTarget.style, paginationButtonStyle); }}
                >
                  {page}
                </button>
              );
            })}
            <button
              style={{ ...paginationButtonStyle, ...(currentPage === totalPages ? paginationButtonDisabledStyle : {}) }}
              onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              onMouseEnter={(e) => { if (currentPage < totalPages) Object.assign(e.currentTarget.style, paginationButtonHoverStyle); }}
              onMouseLeave={(e) => { if (currentPage < totalPages) Object.assign(e.currentTarget.style, paginationButtonStyle); }}
            >
              ›
            </button>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete meta model?"
        message="This action cannot be undone."
        confirmText={isDeleting ? 'Deleting…' : 'Delete'}
        cancelText="Cancel"
        onConfirm={async () => {
          if (deletingId == null) return;
          setIsDeleting(true);
          setApiError('');
          try {
            await apiService.deleteMetaModel(String(deletingId));
            setApiModels(prev => prev.filter(m => m.id !== deletingId));
          } catch (err) {
            setApiError(err instanceof Error ? err.message : 'Failed to delete meta model');
          } finally {
            setIsDeleting(false);
            setConfirmOpen(false);
            setDeletingId(null);
          }
        }}
        onCancel={() => { if (!isDeleting) { setConfirmOpen(false); setDeletingId(null); } }}
      />
    </div>
  );
};


