import React, { useEffect, useState } from 'react';
import { apiService } from '../../services/api';

interface MetaModelsPanelProps {
  activeVsumId?: number | null;
  selectedMetaModelIds?: number[];
  onAddToActiveVsum?: (model: any) => void;
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  background: '#f8f9fa',
  padding: 16,
  boxSizing: 'border-box',
  height: '100%',
  overflowY: 'auto',
};

const titleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  marginBottom: 12,
  color: '#2c3e50',
  textAlign: 'left',
  padding: '8px 0 4px',
  borderBottom: '2px solid #3498db',
  fontFamily: 'Georgia, serif',
};

const controlsRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 14,
  flexWrap: 'wrap',
};

const searchInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 240,
  padding: '10px 12px',
  border: '1px solid #ced4da',
  borderRadius: 0,
  fontSize: 14,
  lineHeight: 1.2,
};

const sortDropdownStyle: React.CSSProperties = {
  padding: '10px 12px',
  border: '1px solid #dee2e6',
  borderRadius: 0,
  background: '#ffffff',
  color: '#495057',
  fontSize: 14,
  cursor: 'pointer',
  minWidth: 160,
};

const filterBtnStyle: React.CSSProperties = {
  padding: '10px 12px',
  border: '1px solid #dee2e6',
  borderRadius: 0,
  background: '#f8f9fa',
  cursor: 'pointer',
  fontWeight: 600,
};

const toggleBtnStyle: React.CSSProperties = {
  padding: '10px 12px',
  border: '1px solid #dee2e6',
  borderRadius: 0,
  background: '#ffffff',
  cursor: 'pointer',
  fontWeight: 600,
  transition: 'all 0.2s ease',
};

const toggleBtnActiveStyle: React.CSSProperties = {
  ...toggleBtnStyle,
  background: '#3498db',
  color: '#ffffff',
  borderColor: '#3498db',
};

const filtersBoxStyle: React.CSSProperties = {
  border: '1px solid #e9ecef',
  background: '#ffffff',
  borderRadius: 0,
  padding: 12,
  marginBottom: 12,
};

const fileCardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e7f5ff',
  borderRadius: 0,
  padding: 16,
  marginBottom: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  transition: 'box-shadow .2s ease, transform .2s ease, border-color .2s ease',
};

const fileCardHoverStyle: React.CSSProperties = {
  boxShadow: '0 6px 18px rgba(52,152,219,0.12)',
  transform: 'translateY(-1px)',
  borderColor: '#3498db',
  background: '#f8fbff',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 6,
};

const fileNameStyle: React.CSSProperties = {
  fontWeight: 700,
  color: '#2c3e50',
  fontSize: 18,
  fontFamily: 'Georgia, serif',
  margin: 0,
};

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  color: '#5a6c7d',
  fontSize: 14,
  fontStyle: 'italic',
  flexWrap: 'wrap',
};

const dotStyle: React.CSSProperties = {
  width: 4,
  height: 4,
  borderRadius: '50%',
  background: '#95a5a6',
  display: 'inline-block',
};

const dateTextStyle: React.CSSProperties = {
  whiteSpace: 'nowrap',
};

const addBtnStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #dee2e6',
  borderRadius: 8,
  background: '#ffffff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
};

export const MetaModelsPanel: React.FC<MetaModelsPanelProps> = ({
  activeVsumId,
  selectedMetaModelIds,
  onAddToActiveVsum,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'domain'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [apiModels, setApiModels] = useState<any[]>([]);
  const [apiError, setApiError] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [parsedFilters, setParsedFilters] = useState<any[]>([]);
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
    if (!lower) return;

    const candidates = ['name', 'description', 'domain', 'keywords', 'created', 'updated'];
    const match = candidates.find(k => k.startsWith(lower));
    const replacement = match ? `${match}:` : null;
    if (!replacement) return;

    e.preventDefault();
    const newValue = value.slice(0, start) + replacement + value.slice(end);
    const newCaret = start + replacement.length;
    setSearchTerm(newValue);
    requestAnimationFrame(() => input.setSelectionRange(newCaret, newCaret));
  };

  const parseSearchQuery = (query: string) => {
    const filters: any[] = [];
    const parts = query.split(/\s+/).filter(Boolean);
    for (const part of parts) {
      const m = part.match(/^([a-zA-Z]+):(.+)$/);
      if (!m) continue;
      const [, key, raw] = m;
      const value = raw.replace(/"/g, '');
      switch (key.toLowerCase()) {
        case 'name':
        case 'domain':
        case 'keywords':
        case 'description':
        case 'created':
        case 'updated':
          filters.push({ key: key.toLowerCase(), value });
          break;
      }
    }
    return filters;
  };

  // keep parsed filters synced
  useEffect(() => {
    setParsedFilters(searchTerm.trim() ? parseSearchQuery(searchTerm) : []);
  }, [searchTerm]);

  // fetch models
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingModels(true);
      setApiError('');
      try {
        const filters: any = {};
        
        // Set ownership filter
        filters.ownedByUser = !showAllModels;
        
        parsedFilters.forEach(f => {
          const v = String(f.value);
          switch (f.key) {
            case 'name':
            case 'domain':
            case 'description':
              filters[f.key] = v;
              break;
            case 'keywords':
              filters.keywords = v;
              break;
            case 'created':
            case 'updated': {
              const fromKey = f.key === 'created' ? 'createdFrom' : 'updatedFrom';
              const toKey = f.key === 'created' ? 'createdTo' : 'updatedTo';
              if (v.includes('after:')) {
                const dateStr = v.replace('after:', '');
                (filters as any)[fromKey] = dateStr === 'now' ? new Date().toISOString() : new Date(dateStr).toISOString();
              } else if (v.includes('before:')) {
                const dateStr = v.replace('before:', '');
                (filters as any)[toKey] = dateStr === 'now' ? new Date().toISOString() : new Date(dateStr).toISOString();
              } else if (v.includes('between:')) {
                const [a, b] = v.replace('between:', '').split('..');
                if (a && b) {
                  (filters as any)[fromKey] = new Date(a).toISOString();
                  (filters as any)[toKey] = new Date(b).toISOString();
                }
              } else {
                (filters as any)[fromKey] = new Date(v).toISOString();
                (filters as any)[toKey] = new Date(`${v}T23:59:59`).toISOString();
              }
              break;
            }
          }
        });

        if (dateFilter !== 'all') {
          const hasDate = parsedFilters.some(f => f.key === 'created' || f.key === 'updated');
          if (!hasDate) {
            const now = new Date();
            let from = new Date(0);
            if (dateFilter === 'today') from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (dateFilter === 'week') from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (dateFilter === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1);
            if (dateFilter === 'year') from = new Date(now.getFullYear(), 0, 1);
            (filters as any).createdFrom = from.toISOString();
            (filters as any).createdTo = now.toISOString();
          }
        }

        const res = await apiService.findMetaModels(filters);
        setApiModels(res.data || []);
      } catch (e: any) {
        setApiError(e?.message || 'Failed to fetch meta models');
      } finally {
        setIsLoadingModels(false);
      }
    };
    fetchData();
  }, [parsedFilters, dateFilter, showAllModels]);

  const sortedModels = [...apiModels].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
    if (sortBy === 'date') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sortBy === 'domain') cmp = (a.domain || '').localeCompare(b.domain || '');
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const formatWhen = (iso: string) => {
    const d = new Date(iso);
    const ds = d.toLocaleDateString();
    const ts = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${ds} at ${ts}`;
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
            const [sb, so] = e.target.value.split('-') as ['name' | 'date' | 'domain', 'asc' | 'desc'];
            setSortBy(sb);
            setSortOrder(so);
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
        <button style={filterBtnStyle} onClick={() => setShowFilters(v => !v)}>
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
        <button 
          style={showAllModels ? toggleBtnActiveStyle : toggleBtnStyle}
          onClick={() => setShowAllModels(v => !v)}
          title={showAllModels ? 'Showing all meta models' : 'Showing only my meta models'}
        >
          {showAllModels ? 'All Models' : 'My Models'}
        </button>
      </div>

      {showFilters && (
        <div style={filtersBoxStyle}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, minWidth: 60, color: '#495057' }}>Name:</span>
              <input
                type="text"
                placeholder="Filter by name…"
                style={{ flex: 1, padding: '6px 8px', border: '1px solid #ced4da', borderRadius: 6, fontSize: 12 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = (e.currentTarget as HTMLInputElement).value.trim();
                    if (v) setSearchTerm(p => (p ? `${p} name:${v}` : `name:${v}`));
                    (e.currentTarget as HTMLInputElement).value = '';
                  }
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, minWidth: 60, color: '#495057' }}>Domain:</span>
              <input
                type="text"
                placeholder="Filter by domain…"
                style={{ flex: 1, padding: '6px 8px', border: '1px solid #ced4da', borderRadius: 6, fontSize: 12 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = (e.currentTarget as HTMLInputElement).value.trim();
                    if (v) setSearchTerm(p => (p ? `${p} domain:${v}` : `domain:${v}`));
                    (e.currentTarget as HTMLInputElement).value = '';
                  }
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, minWidth: 60, color: '#495057' }}>Keywords:</span>
              <input
                type="text"
                placeholder="Filter by keywords…"
                style={{ flex: 1, padding: '6px 8px', border: '1px solid #ced4da', borderRadius: 6, fontSize: 12 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = (e.currentTarget as HTMLInputElement).value.trim();
                    if (v) setSearchTerm(p => (p ? `${p} keywords:${v}` : `keywords:${v}`));
                    (e.currentTarget as HTMLInputElement).value = '';
                  }
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, minWidth: 60, color: '#495057' }}>Date:</span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                style={{ flex: 1, padding: '6px 8px', border: '1px solid #ced4da', borderRadius: 6, fontSize: 12 }}
              >
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="year">This year</option>
              </select>
            </div>
            <div style={{ fontSize: 10, color: '#6a737d', fontStyle: 'italic' }}>
              Tip: Use filters like <code>name:X domain:Y created:after:2024-01-01</code>
            </div>
          </div>
        </div>
      )}

      {apiError && (
        <div style={{ padding: '8px 12px', margin: '8px 0', borderRadius: 8, fontSize: 12, background: '#fdecea', color: '#b3261e', border: '1px solid #f5c6cb' }}>
          {apiError}
        </div>
      )}

      {isLoadingModels && (
        <div style={{ padding: 16, textAlign: 'center', fontSize: 13, color: '#5a6c7d', fontStyle: 'italic' }}>
          Loading models…
        </div>
      )}

      <div>
        {sortedModels.map((model: any) => (
          <div
            key={model.id}
            style={fileCardStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, fileCardHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, fileCardStyle)}
          >
            <div style={cardHeaderStyle}>
              <h4 style={fileNameStyle}>{model.name}</h4>

              {activeVsumId && onAddToActiveVsum && (
                <button
                  onClick={() => onAddToActiveVsum(model)}
                  style={{
                    ...addBtnStyle,
                    opacity: (selectedMetaModelIds || []).includes(model.id) ? 0.6 : 1,
                    cursor: (selectedMetaModelIds || []).includes(model.id) ? 'not-allowed' : 'pointer',
                  }}
                  disabled={(selectedMetaModelIds || []).includes(model.id)}
                >
                  {(selectedMetaModelIds || []).includes(model.id) ? 'Added' : '+'}
                </button>
              )}
            </div>

            <div style={metaRowStyle}>
              <span>
                <em>Domain:</em>&nbsp;<strong>{model.domain || '—'}</strong>
              </span>
              <span style={dotStyle} />
              <span style={dateTextStyle} title={new Date(model.createdAt).toLocaleString()}>
                {formatWhen(model.createdAt)}
              </span>
            </div>
          </div>
        ))}

        {!isLoadingModels && !apiError && sortedModels.length === 0 && (
          <div style={{ padding: 16, fontSize: 13, color: '#6c757d', fontStyle: 'italic' }}>
            No meta models available.
          </div>
        )}
      </div>
    </div>
  );
};