import React, { useEffect, useMemo, useState } from 'react';
import { apiService } from '../../services/api';
import { Vsum, VsumDetails } from '../../types';

const containerStyle: React.CSSProperties = {
  userSelect: 'none',
  width: '100%',
  background: '#f8f9fa',
  padding: '16px',
  boxSizing: 'border-box',
  height: '100%',
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

const sectionStyle: React.CSSProperties = {
  marginTop: '16px',
  marginBottom: '8px',
  fontWeight: 700,
  fontSize: '13px',
  color: '#2c3e50',
  borderBottom: '1px solid #3498db',
  paddingBottom: '6px',
  fontFamily: 'Georgia, serif',
};

const infoItemStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #d1ecf1',
  borderRadius: '6px',
  padding: '12px',
  marginBottom: '12px',
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
};

export const VsumsPanel: React.FC = () => {
  const [items, setItems] = useState<Vsum[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [createName, setCreateName] = useState('');
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [detailsById, setDetailsById] = useState<Record<number, VsumDetails | undefined>>({});
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Record<number, { name: string; metaModelIds: string }>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiService.getVsums();
        console.log(res.data);
        setItems(res.data || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load vSUMs');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshIndex]);

  useEffect(() => {
    const onRefresh = () => setRefreshIndex(v => v + 1);
    window.addEventListener('vitruv.refreshVsums', onRefresh as EventListener);
    return () => window.removeEventListener('vitruv.refreshVsums', onRefresh as EventListener);
  }, []);

  const onCreate = async () => {
    const name = createName.trim();
    if (!name) return;
    setLoading(true);
    setError('');
    try {
      await apiService.createVsum({ name });
      setCreateName('');
      setRefreshIndex(v => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create vSUM');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (id: number) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
      setExpandedIds(next);
      return;
    }
    next.add(id);
    setExpandedIds(next);
    if (!detailsById[id]) {
      try {
        const res = await apiService.getVsumDetails(id);
        setDetailsById(prev => ({ ...prev, [id]: res.data }));
        setEditing(prev => ({
          ...prev,
          [id]: {
            name: res.data.name,
            metaModelIds: (res.data.metaModels || []).map(m => m.id).join(',')
          }
        }));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load vSUM details');
      }
    }
  };

  const onDelete = async (id: number, name: string) => {
    const confirmed = window.confirm(`Delete vSUM "${name}"?`);
    if (!confirmed) return;
    setLoading(true);
    setError('');
    try {
      await apiService.deleteVsum(id);
      setRefreshIndex(v => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete vSUM');
    } finally {
      setLoading(false);
    }
  };

  const onSave = async (id: number) => {
    const edit = editing[id];
    if (!edit) return;
    const name = edit.name.trim();
    const metaModelIds = edit.metaModelIds
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter(n => Number.isFinite(n));
    if (!name) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiService.updateVsum(id, { name, metaModelIds });
      // refresh details and list
      const [details] = await Promise.all([
        apiService.getVsumDetails(id),
        apiService.getVsums()
      ]);
      setDetailsById(prev => ({ ...prev, [id]: details.data }));
      setItems(details ? (await apiService.getVsums()).data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update vSUM');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    const ds = d.toLocaleDateString();
    const ts = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${ds} ${ts}`;
  };

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [items]);

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>vSUMS</div>

      {error && (
        <div style={{
          padding: '8px 12px',
          margin: '8px 0',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 500,
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
        }}>
          {error}
        </div>
      )}

      <div style={infoItemStyle}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="New vSUM name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            style={{ flex: 1, padding: '8px 10px', border: '1px solid #ced4da', borderRadius: 6, fontSize: 13 }}
            disabled={loading}
          />
          <button
            onClick={onCreate}
            disabled={loading || !createName.trim()}
            style={{ padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 6, background: '#ffffff', cursor: 'pointer', fontWeight: 600 }}
          >
            Create
          </button>
        </div>
      </div>

      <div style={sectionStyle}>All vSUMs</div>
      {loading && (
        <div style={{ padding: 12, fontStyle: 'italic', color: '#5a6c7d' }}>Loading...</div>
      )}
      {!loading && sorted.length === 0 && (
        <div style={{ ...infoItemStyle, color: '#6c757d', fontStyle: 'italic' }}>No vSUMs available.</div>
      )}
      {sorted.map(item => {
        const details = detailsById[item.id];
        const isExpanded = expandedIds.has(item.id);
        const edit = editing[item.id] || { name: item.name, metaModelIds: '' };
        return (
          <div
            key={item.id}
            style={infoItemStyle}
            onDoubleClick={() => {
              window.dispatchEvent(new CustomEvent('vitruv.openVsum', { detail: { id: item.id } }));
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 700, color: '#2c3e50' }}>{item.name}</div>
                <div style={{ fontSize: 12, color: '#5a6c7d' }}>Created: {formatDateTime(item.createdAt)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => toggleExpand(item.id)}
                  style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, background: '#ffffff', cursor: 'pointer', fontWeight: 600 }}
                >
                  {isExpanded ? 'Hide details' : 'Details'}
                </button>
                <button
                  onClick={() => onDelete(item.id, item.name)}
                  style={{ padding: '6px 10px', border: '1px solid #f5c2c7', color: '#b02a37', borderRadius: 6, background: '#fff5f5', cursor: 'pointer', fontWeight: 600 }}
                >
                  Delete
                </button>
              </div>
            </div>

            {isExpanded && (
              <div style={{ marginTop: 12, borderTop: '1px solid #e9ecef', paddingTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Edit</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <input
                    placeholder="Name"
                    value={edit.name}
                    onChange={(e) => setEditing(prev => ({ ...prev, [item.id]: { ...edit, name: e.target.value } }))}
                    style={{ flex: 1, padding: '6px 8px', border: '1px solid #ced4da', borderRadius: 6, fontSize: 13 }}
                  />
                  <input
                    placeholder="metaModelIds (comma separated)"
                    value={edit.metaModelIds}
                    onChange={(e) => setEditing(prev => ({ ...prev, [item.id]: { ...edit, metaModelIds: e.target.value } }))}
                    style={{ flex: 1, padding: '6px 8px', border: '1px solid #ced4da', borderRadius: 6, fontSize: 13 }}
                  />
                  <button
                    onClick={() => onSave(item.id)}
                    style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, background: '#e7f5ff', cursor: 'pointer', fontWeight: 700 }}
                  >
                    Save
                  </button>
                </div>

                <div style={{ fontWeight: 700, marginBottom: 8 }}>Details</div>
                {!details && (
                  <div style={{ fontSize: 12, color: '#6c757d', fontStyle: 'italic' }}>Loading details...</div>
                )}
                {details && (
                  <div>
                    <div style={{ fontSize: 12, color: '#5a6c7d', marginBottom: 8 }}>
                      <span>ID: <strong>{details.id}</strong></span>
                      <span style={{ marginLeft: 8 }}>Updated: {formatDateTime(details.updatedAt)}</span>
                    </div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Meta Models ({details.metaModels?.length || 0})</div>
                    {(details.metaModels || []).length === 0 && (
                      <div style={{ fontSize: 12, color: '#6c757d', fontStyle: 'italic' }}>No meta models linked.</div>
                    )}
                    {(details.metaModels || []).map(mm => (
                      <div key={mm.id} style={{ border: '1px solid #e9ecef', borderRadius: 6, padding: 8, marginBottom: 6 }}>
                        <div style={{ fontWeight: 600 }}>{mm.name}</div>
                        <div style={{ fontSize: 12, color: '#6c757d' }}>
                          <span>Domain: {mm.domain}</span>
                          <span style={{ marginLeft: 6 }}>Keywords: {(mm.keyword || []).join(', ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};


