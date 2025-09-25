import React, { useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import { ConfirmDialog } from './ConfirmDialog';

interface MetaModelsPanelProps {
  activeVsumId?: number | null;
  selectedMetaModelIds?: number[];
  onAddToActiveVsum?: (model: any) => void;
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

const controlsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '12px',
  alignItems: 'center',
};

const searchInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 10px',
  border: '1px solid #ced4da',
  borderRadius: 6,
  fontSize: 13,
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
  minWidth: '140px',
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

export const MetaModelsPanel: React.FC<MetaModelsPanelProps> = ({ activeVsumId, selectedMetaModelIds, onAddToActiveVsum }) => {
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

    const candidates = ['name', 'description', 'domain', 'keywords', 'created', 'updated'];
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
    const filters: any[] = [];
    const parts = query.split(/\s+/).filter(part => part.trim());
    for (const part of parts) {
      const colonMatch = part.match(/^([a-zA-Z]+):(.+)$/);
      if (colonMatch) {
        const [, key, value] = colonMatch;
        const cleanValue = value.replace(/"/g, '');
        switch (key.toLowerCase()) {
          case 'name':
            filters.push({ key: 'name', value: cleanValue });
            break;
          case 'domain':
            filters.push({ key: 'domain', value: cleanValue });
            break;
          case 'keywords':
            filters.push({ key: 'keywords', value: cleanValue });
            break;
          case 'description':
            filters.push({ key: 'description', value: cleanValue });
            break;
          case 'created':
          case 'updated':
            filters.push({ key, value: cleanValue });
            break;
        }
      } else {
        // Ignore bare tokens (no default name:)
      }
    }
    return filters;
  };

  // Keep parsed filters in sync with searchTerm
  useEffect(() => {
    if (searchTerm.trim()) {
      setParsedFilters(parseSearchQuery(searchTerm));
    } else {
      setParsedFilters([]);
    }
  }, [searchTerm]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingModels(true);
      setApiError('');
      try {
        const filters: any = {};
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
              if (filter.value.includes('after:')) {
                const dateStr = filter.value.replace('after:', '');
                filters.createdFrom = dateStr === 'now' ? new Date().toISOString() : new Date(dateStr).toISOString();
              } else if (filter.value.includes('before:')) {
                const dateStr = filter.value.replace('before:', '');
                filters.createdTo = dateStr === 'now' ? new Date().toISOString() : new Date(dateStr).toISOString();
              } else if (filter.value.includes('between:')) {
                const dates = filter.value.replace('between:', '').split('..');
                if (dates.length === 2) {
                  filters.createdFrom = new Date(dates[0]).toISOString();
                  filters.createdTo = new Date(dates[1]).toISOString();
                }
              } else {
                filters.createdFrom = new Date(filter.value).toISOString();
                filters.createdTo = new Date(filter.value + 'T23:59:59').toISOString();
              }
              break;
            case 'updated':
              if (filter.value.includes('after:')) {
                const dateStr = filter.value.replace('after:', '');
                filters.updatedFrom = dateStr === 'now' ? new Date().toISOString() : new Date(dateStr).toISOString();
              } else if (filter.value.includes('before:')) {
                const dateStr = filter.value.replace('before:', '');
                filters.updatedTo = dateStr === 'now' ? new Date().toISOString() : new Date(dateStr).toISOString();
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

        // Add simple date range when no explicit created/updated filters are present
        if (dateFilter !== 'all') {
          const hasDateFilters = parsedFilters.some(f => f.key === 'created' || f.key === 'updated');
          if (!hasDateFilters) {
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
        }
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
  }, [parsedFilters, dateFilter]);

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

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>Meta Models</div>
      <div style={controlsRowStyle}>
        <input
          placeholder="Search (e.g. name:test domain:engineering)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={searchInputStyle}
          onKeyDown={handleSearchKeyDown}
        />
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
          onClick={() => setShowFilters(v => !v)}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #dee2e6', background: '#f8f9fa', cursor: 'pointer', fontWeight: 600 }}
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {showFilters && (
        <div style={{ position: 'relative', border: '1px solid #e9ecef', background: '#ffffff', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <button
            aria-label="Close filters"
            title="Close"
            style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, border: 'none', background: 'transparent', color: '#6c757d', fontSize: 14, cursor: 'pointer', borderRadius: 4 }}
            onClick={() => setShowFilters(false)}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f1f3f5'; (e.currentTarget as HTMLButtonElement).style.color = '#495057'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#6c757d'; }}
          >
            ×
          </button>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, minWidth: 60, color: '#495057' }}>Name:</span>
            <input
              type="text"
              placeholder="Filter by name..."
              style={{ flex: 1, padding: '6px 8px', border: '1px solid #ced4da', borderRadius: 4, fontSize: 12 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = (e.currentTarget as HTMLInputElement).value.trim();
                  if (value) setSearchTerm(prev => prev ? `${prev} name:${value}` : `name:${value}`);
                  (e.currentTarget as HTMLInputElement).value = '';
                }
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, minWidth: 60, color: '#495057' }}>Domain:</span>
            <input
              type="text"
              placeholder="Filter by domain..."
              style={{ flex: 1, padding: '6px 8px', border: '1px solid #ced4da', borderRadius: 4, fontSize: 12 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = (e.currentTarget as HTMLInputElement).value.trim();
                  if (value) setSearchTerm(prev => prev ? `${prev} domain:${value}` : `domain:${value}`);
                  (e.currentTarget as HTMLInputElement).value = '';
                }
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, minWidth: 60, color: '#495057' }}>Keywords:</span>
            <input
              type="text"
              placeholder="Filter by keywords..."
              style={{ flex: 1, padding: '6px 8px', border: '1px solid #ced4da', borderRadius: 4, fontSize: 12 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = (e.currentTarget as HTMLInputElement).value.trim();
                  if (value) setSearchTerm(prev => prev ? `${prev} keywords:${value}` : `keywords:${value}`);
                  (e.currentTarget as HTMLInputElement).value = '';
                }
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, minWidth: 60, color: '#495057' }}>Date:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              style={{ flex: 1, padding: '6px 8px', border: '1px solid #ced4da', borderRadius: 4, fontSize: 12, background: '#ffffff' }}
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="year">This year</option>
            </select>
          </div>
          <div style={{ fontSize: 10, color: '#6a737d', fontStyle: 'italic' }}>
            Tip: Use GitHub-style filters like <code>name:X domain:Y created:after:2024-01-01</code>
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
                      {(selectedMetaModelIds || []).includes(model.id) ? 'Added' : 'Add to vSUM'}
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


