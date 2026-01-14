import React, { useEffect, useState } from 'react';
import { apiService } from '../../services/api';

interface MetaModelsPanelProps {
  activeVsumId?: number | null;
  selectedMetaModelIds?: number[];
  onAddToActiveVsum?: (model: any) => void;
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  background: '#ffffff',
  padding: '20px 16px 16px 16px',
  boxSizing: 'border-box',
  height: '100%',
  overflowY: 'auto',
};

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  marginBottom: 0,
  color: '#1f2937',
  textAlign: 'center',
  padding: '0 0 18px 0',
  fontFamily: 'Georgia, serif',
  letterSpacing: '0.02em',
};

const tabsContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 0,
  borderBottom: '2px solid #e5e7eb',
  marginBottom: 20,
  justifyContent: 'center',
};

const tabStyle: React.CSSProperties = {
  padding: '10px 32px',
  background: 'transparent',
  border: 'none',
  fontSize: 15,
  fontWeight: 600,
  fontFamily: 'Georgia, serif',
  color: '#6b7280',
  cursor: 'pointer',
  position: 'relative',
  transition: 'all 0.2s ease',
  borderBottom: '3px solid transparent',
  marginBottom: -2,
};

const tabActiveStyle: React.CSSProperties = {
  ...tabStyle,
  color: '#049484',
  borderBottom: '3px solid #049484',
};

const controlsRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  marginBottom: 20,
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  border: '2px solid #e9ecef',
  borderRadius: 8,
  fontSize: 14,
  lineHeight: 1.4,
  fontFamily: 'Georgia, serif',
  transition: 'all 0.2s ease',
  background: '#f8f9fa',
  boxSizing: 'border-box',
};

const sortDropdownStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  border: '2px solid #e9ecef',
  borderRadius: 8,
  background: '#ffffff',
  color: '#495057',
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
  fontWeight: 500,
  transition: 'all 0.2s ease',
  boxSizing: 'border-box',
};

const filtersBoxStyle: React.CSSProperties = {
  border: '2px solid #e9ecef',
  background: '#f8f9fa',
  borderRadius: 8,
  padding: 14,
  marginBottom: 16,
};

const fileCardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '2px solid #e9ecef',
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  transition: 'all 0.2s ease',
  cursor: 'default',
};

const fileCardHoverStyle: React.CSSProperties = {
  boxShadow: '0 6px 18px rgba(4, 148, 132, 0.12)',
  transform: 'translateY(-2px)',
  borderColor: '#049484',
  background: '#f8fcfb',
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
  color: '#1f2937',
  fontSize: 15,
  fontFamily: 'Georgia, serif',
  margin: 0,
  lineHeight: 1.4,
};

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: '#6b7280',
  fontSize: 12,
  flexWrap: 'wrap',
  marginTop: 8,
};

const dotStyle: React.CSSProperties = {
  width: 3,
  height: 3,
  borderRadius: '50%',
  background: '#9ca3af',
  display: 'inline-block',
};

const dateTextStyle: React.CSSProperties = {
  whiteSpace: 'nowrap',
  fontSize: 12,
  color: '#9ca3af',
};

const addBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  border: '2px solid #049484',
  borderRadius: 8,
  background: '#ffffff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  color: '#049484',
  transition: 'all 0.2s ease',
  fontFamily: 'Georgia, serif',
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
      const m = /^([a-zA-Z]+):(.+)$/.exec(part);
      if (!m) continue;
      const [, key, raw] = m;
      const value = raw.replaceAll('"', '');
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
        
        const parseDateValue = (v: string): { from?: string; to?: string } => {
          const toISO = (s: string) => (s === 'now' ? new Date().toISOString() : new Date(s).toISOString());
          if (v.includes('after:')) return { from: toISO(v.replace('after:', '')) };
          if (v.includes('before:')) return { to: toISO(v.replace('before:', '')) };
          if (v.includes('between:')) {
            const [a, b] = v.replace('between:', '').split('..');
            return a && b ? { from: new Date(a).toISOString(), to: new Date(b).toISOString() } : {};
          }
          return { from: new Date(v).toISOString(), to: new Date(`${v}T23:59:59`).toISOString() };
        };

        for (const f of parsedFilters) {
          const v = String(f.value);
          if (f.key === 'name' || f.key === 'domain' || f.key === 'description') {
            filters[f.key] = v;
          } else if (f.key === 'keywords') {
            filters.keywords = v;
          } else if (f.key === 'created' || f.key === 'updated') {
            const prefix = f.key === 'created' ? 'created' : 'updated';
            const { from, to } = parseDateValue(v);
            if (from) filters[`${prefix}From`] = from;
            if (to) filters[`${prefix}To`] = to;
          }
        }

        if (dateFilter !== 'all') {
          const hasDate = parsedFilters.some(f => f.key === 'created' || f.key === 'updated');
          if (!hasDate) {
            const now = new Date();
            const dateFilterMap: Record<string, () => Date> = {
              today: () => new Date(now.getFullYear(), now.getMonth(), now.getDate()),
              week: () => new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
              month: () => new Date(now.getFullYear(), now.getMonth(), 1),
              year: () => new Date(now.getFullYear(), 0, 1),
            };
            const from = dateFilterMap[dateFilter]?.() ?? new Date(0);
            filters.createdFrom = from.toISOString();
            filters.createdTo = now.toISOString();
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

      <div style={tabsContainerStyle}>
        <button
          style={!showAllModels ? tabActiveStyle : tabStyle}
          onClick={() => setShowAllModels(false)}
          onMouseEnter={(e) => {
            if (showAllModels) {
              e.currentTarget.style.color = '#049484';
            }
          }}
          onMouseLeave={(e) => {
            if (showAllModels) {
              e.currentTarget.style.color = '#6b7280';
            }
          }}
        >
          My Models
        </button>
        <button
          style={showAllModels ? tabActiveStyle : tabStyle}
          onClick={() => setShowAllModels(true)}
          onMouseEnter={(e) => {
            if (!showAllModels) {
              e.currentTarget.style.color = '#049484';
            }
          }}
          onMouseLeave={(e) => {
            if (!showAllModels) {
              e.currentTarget.style.color = '#6b7280';
            }
          }}
        >
          All Models
        </button>
      </div>

      <div style={controlsRowStyle}>
        <input
          placeholder="Search models..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={searchInputStyle}
          onKeyDown={handleSearchKeyDown}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#049484';
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(4, 148, 132, 0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#e9ecef';
            e.currentTarget.style.background = '#f8f9fa';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <select
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => {
            const [sb, so] = e.target.value.split('-') as ['name' | 'date' | 'domain', 'asc' | 'desc'];
            setSortBy(sb);
            setSortOrder(so);
          }}
          style={sortDropdownStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#049484';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#e9ecef';
          }}
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
        <div style={{ 
          padding: '10px 14px', 
          margin: '0 0 16px 0', 
          borderRadius: 8, 
          fontSize: 13, 
          background: '#fef2f2', 
          color: '#991b1b', 
          border: '2px solid #fecaca',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          {apiError}
        </div>
      )}

      {isLoadingModels && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '40px 20px',
          color: '#6c757d' 
        }}>
          <div style={{ 
            width: 40, 
            height: 40, 
            border: '3px solid #e9ecef', 
            borderTop: '3px solid #049484', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite',
            marginBottom: 12
          }} />
          <div style={{ fontSize: 14, fontFamily: 'Georgia, serif' }}>Loading models…</div>
        </div>
      )}

      <div>
        {sortedModels.map((model: any) => (
          <div
            key={model.id}
            role="article"
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
                    background: (selectedMetaModelIds || []).includes(model.id) ? '#f8f9fa' : '#ffffff',
                  }}
                  disabled={(selectedMetaModelIds || []).includes(model.id)}
                  onMouseEnter={(e) => {
                    if (!(selectedMetaModelIds || []).includes(model.id)) {
                      e.currentTarget.style.background = '#049484';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(selectedMetaModelIds || []).includes(model.id)) {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.color = '#049484';
                    }
                  }}
                >
                  {(selectedMetaModelIds || []).includes(model.id) ? '✓ Added' : '+ Add'}
                </button>
              )}
            </div>

            <div style={metaRowStyle}>
              {model.domain && (
                <>
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
                    Domain: <span style={{ color: '#049484', fontWeight: 600 }}>{model.domain}</span>
                  </span>
                  <span style={dotStyle} />
                </>
              )}
              <span style={dateTextStyle} title={new Date(model.createdAt).toLocaleString()}>
                {(() => {
                  const d = new Date(model.createdAt);
                  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                })()}
              </span>
            </div>
          </div>
        ))}

        {!isLoadingModels && !apiError && sortedModels.length === 0 && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '40px 20px',
            color: '#6c757d',
            textAlign: 'center'
          }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 16, opacity: 0.5 }}>
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: '#495057', fontFamily: 'Georgia, serif' }}>
              No meta models found
            </div>
            <div style={{ fontSize: 13, fontFamily: 'Georgia, serif' }}>
              {showAllModels ? 'No models available in the system.' : 'Create a new meta model to get started.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};