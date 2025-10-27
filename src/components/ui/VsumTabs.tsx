import React, { useEffect, useMemo, useState } from 'react';
import { VsumDetails } from '../../types';
import { apiService } from '../../services/api';

interface VsumTabsProps {
  openVsums: number[];
  activeVsumId: number | null;
  onActivate: (id: number) => void;
  onClose: (id: number) => void;
  onAddMetaModels?: () => void;
  showAddButton?: boolean;
}

export const VsumTabs: React.FC<VsumTabsProps> = ({ openVsums, activeVsumId, onActivate, onClose, onAddMetaModels, showAddButton }) => {
  const [detailsById, setDetailsById] = useState<Record<number, VsumDetails | undefined>>({});
  const [error, setError] = useState<string>('');
  const [edits, setEdits] = useState<Record<number, { metaModelSourceIds: number[] }>>({});
  const [saving, setSaving] = useState(false);

  // util
  const areIdArraysEqual = (a: number[] = [], b: number[] = []) => {
    if (a.length !== b.length) return false;
    const sa = [...a].sort((x, y) => x - y);
    const sb = [...b].sort((x, y) => x - y);
    for (let i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) return false;
    }
    return true;
  };

  // dirty = compare by sourceId arrays
  const dirtyById = useMemo(() => {
    const map: Record<number, boolean> = {};
    openVsums.forEach((id) => {
      const edit = edits[id];
      const details = detailsById[id];
      if (!edit || !details) { map[id] = false; return; }
      map[id] = !areIdArraysEqual(edit.metaModelSourceIds);
    });
    return map;
  }, [openVsums, edits, detailsById]);

  // load details for active vsum and seed edits using sourceId
  useEffect(() => {
    const fetchDetails = async (id: number) => {
      setError('');
      try {
        const res = await apiService.getVsumDetails(id);
        setDetailsById(prev => ({ ...prev, [id]: res.data }));
        
        // Seed initial edit state with sourceIds from metaModels
        const sourceIds = res.data.metaModels?.map(mm => mm.sourceId) || [];
        setEdits(prev => ({
          ...prev,
          [id]: { metaModelSourceIds: sourceIds }
        }));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load VSUM details');
      }
    };
    if (activeVsumId && !detailsById[activeVsumId]) {
      fetchDetails(activeVsumId);
    }
  }, [activeVsumId, detailsById]);

  // save changes: send sourceIds in metaModelIds field + metaModelRelationRequests: null
  const saveById = async (
      id: number,
      override?: { metaModelSourceIds?: number[] }
  ) => {
    const edit = edits[id];

    // fallback from details using sourceId
    const fallbackSourceIds = detailsById[id]?.metaModels?.map(mm => mm.sourceId);

    const metaModelSourceIds =
        override?.metaModelSourceIds ?? edit?.metaModelSourceIds ?? fallbackSourceIds;

    if (!metaModelSourceIds || metaModelSourceIds.length === 0) {
      setError('At least one MetaModel is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      // IMPORTANT: backend param is "metaModelIds" but we pass SOURCE IDs here
      await apiService.updateVsumSyncChanges(id, {
        metaModelIds: metaModelSourceIds,
        metaModelRelationRequests: null, // not implemented yet
      });

      const res = await apiService.getVsumDetails(id);
      setDetailsById(prev => ({ ...prev, [id]: res.data }));

      window.dispatchEvent(new CustomEvent('vitruv.refreshVsums'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save VSUM');
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    if (!activeVsumId) return;
    await saveById(activeVsumId);
  };

  // handle external "add meta model" event
  useEffect(() => {
    const onAdd = (e: Event) => {
      const ce = e as CustomEvent<{ id?: number; sourceId?: number }>;
      if (!activeVsumId) return;

      // Prefer sourceId; if only id is provided and in your app that id is the global source id, this still works.
      // If your event sends cloned ids instead, adjust the emitter to pass sourceId.
      const sourceId = typeof ce.detail?.sourceId === 'number'
          ? ce.detail.sourceId
          : (typeof ce.detail?.id === 'number' ? ce.detail.id : undefined);

      if (typeof sourceId !== 'number') return;

      const current = edits[activeVsumId];

      // Initialize if not exists
      if (!current) {
        setEdits(prev => ({
          ...prev,
          [activeVsumId!]: { metaModelSourceIds: [sourceId] }
        }));
        return;
      }

      if (current.metaModelSourceIds.includes(sourceId)) return;

      setEdits(prev => ({
        ...prev,
        [activeVsumId!]: { metaModelSourceIds: [...current.metaModelSourceIds, sourceId] }
      }));
    };

    window.addEventListener('vitruv.addMetaModelToActiveVsum', onAdd as EventListener);
    return () => window.removeEventListener('vitruv.addMetaModelToActiveVsum', onAdd as EventListener);
  }, [activeVsumId, edits, detailsById]);

  if (openVsums.length === 0) return null;

  const anyDirty = activeVsumId ? !!dirtyById[activeVsumId] : false;

  return (
      <>
        <div
            style={{
              background: '#ffffff',
              borderBottom: '1px solid #e5e7eb',
              position: 'sticky',
              top: 0,
              zIndex: 20,
              boxShadow: 'inset 0 -1px 0 #e5e7eb',
              cursor: saving ? 'progress' : 'default'
            }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', flex: 1 }}>
              {openVsums.map(id => {
              const isActive = id === activeVsumId;
              const name = detailsById[id]?.name || `VSUM #${id}`;
              const isDirty = !!dirtyById[id];
              return (
                  <div
                      key={id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 12px',
                        border: isActive ? '1px solid #bfdbfe' : '1px solid #e5e7eb',
                        borderBottom: isActive ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                        borderRadius: 8,
                        background: isActive ? '#f0f7ff' : '#ffffff',
                        cursor: 'pointer',
                        boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.04)' : 'none'
                      }}
                      onClick={() => onActivate(id)}
                      aria-current={isActive ? 'page' : undefined}
                      title={name}
                  >
                    {isDirty && (
                        <span
                            aria-label="Unsaved changes"
                            title="Unsaved changes"
                            style={{ width: 6, height: 6, borderRadius: 6, background: '#f59e0b', display: 'inline-block' }}
                        />
                    )}
                    <span style={{ fontWeight: 700, color: '#1f2937', fontSize: 12, whiteSpace: 'nowrap' }}>{name}</span>
                    <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose(id);
                        }}
                        style={{
                          border: '1px solid transparent',
                          background: 'transparent',
                          color: '#64748b',
                          cursor: 'pointer',
                          borderRadius: 4,
                          lineHeight: 1,
                          width: 16,
                          height: 16,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        aria-label={`Close ${name}`}
                        title="Close"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>

            {activeVsumId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {error && (
                    <div
                        role="alert"
                        style={{
                          padding: '4px 8px',
                          border: '1px solid #fecaca',
                          color: '#991b1b',
                          background: '#fef2f2',
                          borderRadius: 6,
                          fontSize: 11
                        }}
                    >
                      {error}
                    </div>
                )}
                {anyDirty && (
                    <button
                        onClick={onSave}
                        disabled={saving}
                        style={{
                          padding: '6px 10px',
                          border: '1px solid #3b82f6',
                          borderRadius: 8,
                          background: saving ? '#bfdbfe' : '#3b82f6',
                          color: '#ffffff',
                          fontWeight: 700,
                          cursor: saving ? 'not-allowed' : 'pointer'
                        }}
                    >
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                )}
              </div>
          )}
        </div>
      </div>
      {showAddButton && onAddMetaModels && (
        <button
          style={{
            position: 'absolute',
            right: 16,
            top: 56,
            background: '#3498db',
            color: '#ffffff',
            border: '1px solid #2980b9',
            borderRadius: 6,
            padding: '8px 12px',
            fontWeight: 700,
            cursor: 'pointer',
            zIndex: 21
          }}
          onClick={onAddMetaModels}
        >
          + ADD META MODELS
        </button>
      )}
      </>
  );
};