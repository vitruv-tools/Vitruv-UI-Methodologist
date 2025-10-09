// src/components/ui/VsumsPanel.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { apiService } from '../../services/api';
import { Vsum } from '../../types';
import { CreateVsumModal } from './CreateVsumModal';
import { VsumDetailsModal } from './VsumDetailsModal';

// ---- styles (same look & feel as your ToolsPanel) ----
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

const createButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 18px',
  margin: '12px 0 0 0',
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

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #d1ecf1',
  borderRadius: '6px',
  padding: '12px',
  marginBottom: '12px',
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
};

const errorStyle: React.CSSProperties = {
  padding: '8px 12px',
  margin: '8px 0',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 500,
  backgroundColor: '#f8d7da',
  color: '#721c24',
  border: '1px solid #f5c6cb',
};

// ------------------------------------------------------

export const VsumsPanel: React.FC = () => {
  const [items, setItems] = useState<Vsum[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const [showCreate, setShowCreate] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);

  // modal control
  const [detailsId, setDetailsId] = useState<number | null>(null);

  // load list
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiService.getVsums();
        setItems(res.data || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load vSUMs');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshIndex]);

  // external refresh event
  useEffect(() => {
    const onRefresh = () => setRefreshIndex(v => v + 1);
    window.addEventListener('vitruv.refreshVsums', onRefresh as EventListener);
    return () => window.removeEventListener('vitruv.refreshVsums', onRefresh as EventListener);
  }, []);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const sorted = useMemo(
      () => [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      [items]
  );

  return (
      <div style={containerStyle}>
        <div style={titleStyle}>vSUMS</div>

        <CreateVsumModal
            isOpen={showCreate}
            onClose={() => setShowCreate(false)}
            onSuccess={() => setRefreshIndex(v => v + 1)}
        />

        {error && <div style={errorStyle}>{error}</div>}

        <button
            onClick={() => setShowCreate(true)}
            style={createButtonStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, createButtonHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, createButtonStyle)}
        >
          Create vSUM
        </button>

        <div style={sectionStyle}>All vSUMs</div>

        {loading && <div style={{ padding: 12, fontStyle: 'italic', color: '#5a6c7d' }}>Loading...</div>}
        {!loading && sorted.length === 0 && (
            <div style={{ ...cardStyle, color: '#6c757d', fontStyle: 'italic' }}>No vSUMs available.</div>
        )}

        {sorted.map(item => (
            <div
                key={item.id}
                style={cardStyle}
                onDoubleClick={() => window.dispatchEvent(new CustomEvent('vitruv.openVsum', { detail: { id: item.id } }))}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 700, color: '#2c3e50' }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: '#5a6c7d' }}>Created: {formatDateTime(item.createdAt)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                      onClick={() => setDetailsId(item.id)}  // open modal
                      style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, background: '#ffffff', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
        ))}

        {/* The popup modal */}
        <VsumDetailsModal
            isOpen={detailsId !== null}
            vsumId={detailsId}
            onClose={() => setDetailsId(null)}
            onSaved={() => setRefreshIndex(v => v + 1)}   // refresh list after save
        />
      </div>
  );
};