// src/components/ui/VsumDetailsModal.tsx
import React, { useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import { VsumDetails } from '../../types';
import { VsumUsersTab } from './VsumUsersTab';

interface Props {
  isOpen: boolean;
  vsumId: number | null;
  onClose: () => void;
  onSaved?: () => void;
}

// ---- styles ----
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
};
const dialog: React.CSSProperties = {
  width: 900, maxWidth: '95vw', maxHeight: '90vh',
  background: '#fff', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
  overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'Georgia, serif',
};
const header: React.CSSProperties = {
  padding: '16px 20px', borderBottom: '1px solid #e9ecef',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const title: React.CSSProperties = { margin: 0, fontSize: 18, fontWeight: 700, color: '#2c3e50' };
const closeBtn: React.CSSProperties = { border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#6c757d' };
const body: React.CSSProperties = { padding: 20, overflowY: 'auto' };
const footer: React.CSSProperties = { padding: '12px 20px', borderTop: '1px solid #e9ecef', display: 'flex', justifyContent: 'flex-end', gap: 8 };
// field styles
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#495057', marginTop: 12, marginBottom: 6 };
const textInput: React.CSSProperties = { width:'100%', padding:'8px 10px', border:'1px solid #dee2e6', borderRadius:6, fontSize:13 };
// --------------

export const VsumDetailsModal: React.FC<Props> = ({ isOpen, vsumId, onClose, onSaved }) => {
  const [details, setDetails] = useState<VsumDetails | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'users'>('details');
  const [loading, setLoading] = useState(false);

  // lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, [isOpen]);

  // load vsum details
  useEffect(() => {
    const load = async () => {
      if (!isOpen || !vsumId) return;
      setLoading(true);
      setError('');
      try {
        const res = await apiService.getVsumDetails(vsumId);
        const d = res.data;
        setDetails(d);
        setName(d.name ?? '');
      } catch (e: any) {
        setError(e?.message || 'Failed to load details');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, vsumId]);

  // save name (preserve existing meta model links)
  const save = async () => {
    if (!vsumId || !details) return;
    setSaving(true);
    setError('');
    try {
      const currentMetaModelIds = (details.metaModels || []).map(m => m.id);
      await apiService.updateVsum(vsumId, { name: name.trim(), metaModelIds: currentMetaModelIds });
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  // Helper: date only (no clock)
  const updatedDateOnly = details?.updatedAt ? new Date(details.updatedAt).toLocaleDateString() : '';

  return (
      <div style={overlay} onClick={onClose} role="dialog" aria-modal="true">
        <div style={dialog} onClick={(e)=>e.stopPropagation()}>
          <div style={header}>
            <h3 style={title}>{details?.name ?? 'VSUM Details'}</h3>
            <div style={{ display:'flex', gap:8 }}>
              <button
                  onClick={()=>setActiveTab('details')}
                  style={{ border:'1px solid #dee2e6', background: activeTab==='details' ? '#e7f5ff' : '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontWeight: 700 }}
              >
                Details
              </button>
              <button
                  onClick={()=>setActiveTab('users')}
                  style={{ border:'1px solid #dee2e6', background: activeTab==='users' ? '#e7f5ff' : '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontWeight: 700 }}
              >
                Manage Users
              </button>
              <button aria-label="Close" style={closeBtn} onClick={onClose}>×</button>
            </div>
          </div>

          <div style={body}>
            {error && (
                <div style={{marginBottom:12, padding:10, border:'1px solid #f5c6cb', background:'#f8d7da', color:'#721c24', borderRadius:6, fontSize:12}}>
                  {error}
                </div>
            )}

            {activeTab === 'details' ? (
                loading || !details ? (
                    <div style={{fontStyle:'italic', color:'#6c757d'}}>Loading…</div>
                ) : (
                    <>
                      {/* 🔹 Removed ID; show date-only */}
                      <div style={{ fontSize: 12, color: '#6c757d', marginBottom: 10 }}>
                        <strong>Updated:</strong> {updatedDateOnly}
                      </div>

                      {/* Name (editable) */}
                      <div style={label}>Name</div>
                      <input
                          style={textInput}
                          value={name}
                          onChange={(e)=>setName(e.target.value)}
                      />

                      {/* Meta Models — read-only list by name */}
                      <div style={label}>Meta Models</div>
                      {(details.metaModels && details.metaModels.length > 0) ? (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {details.metaModels.map(mm => (
                                <li key={mm.id} style={{ marginBottom: 6 }}>
                                  <span style={{ fontWeight: 700, color: '#2c3e50' }}>{mm.name}</span>
                                  {/* optional extra info:
                        <span style={{ color:'#6c757d', marginLeft: 6 }}>
                          {mm.domain ? `• ${mm.domain}` : ''} {mm.keyword?.length ? `• ${mm.keyword.join(', ')}` : ''}
                        </span>
                        */}
                                </li>
                            ))}
                          </ul>
                      ) : (
                          <div style={{ fontSize: 12, color: '#6c757d', fontStyle: 'italic' }}>
                            No meta models linked.
                          </div>
                      )}
                    </>
                )
            ) : (
                !vsumId
                    ? <div style={{fontStyle:'italic', color:'#6c757d'}}>No VSUM selected.</div>
                    : <VsumUsersTab vsumId={vsumId} onChanged={onSaved} />
            )}
          </div>

          <div style={footer}>
            <button
                style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #dee2e6', background: '#fff', color: '#495057', fontWeight: 700, cursor: 'pointer' }}
                onClick={onClose}
            >
              Close
            </button>
            {activeTab === 'details' && (
                <button
                    style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#3498db', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                    onClick={save}
                    disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
            )}
          </div>
        </div>
      </div>
  );
};