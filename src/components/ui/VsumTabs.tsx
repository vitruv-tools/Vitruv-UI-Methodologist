import React, { useEffect, useState } from 'react';
import { VsumDetails } from '../../types';
import {apiService, MetaModelRelationRequest} from '../../services/api';
import { WorkspaceSnapshot } from '../../types/workspace';

interface OpenTabInstance {
  instanceId: string;
  id: number;
}

interface VsumTabsProps {
  openTabs: OpenTabInstance[];
  activeInstanceId: string | null;
  onActivate: (instanceId: string) => void;
  onClose: (instanceId: string) => void;
  onAddMetaModels?: () => void;
  showAddButton?: boolean;
  requestWorkspaceSnapshot?: () => Promise<WorkspaceSnapshot | null>;
}

export const VsumTabs: React.FC<VsumTabsProps> = ({
                                                    openTabs,
                                                    activeInstanceId,
                                                    onActivate,
                                                    onClose,
                                                    onAddMetaModels,
                                                    showAddButton,
                                                    requestWorkspaceSnapshot,
                                                  }) => {
  const [detailsById, setDetailsById] = useState<Record<number, VsumDetails | undefined>>({});
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<WorkspaceSnapshot | null>(null);

  // ---- helpers ---------------------------------------------------

  const areIdArraysEqual = (a: number[] = [], b: number[] = []) => {
    if (a.length !== b.length) return false;
    const sa = [...a].sort((x, y) => x - y);
    const sb = [...b].sort((x, y) => x - y);
    for (let i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) return false;
    }
    return true;
  };

  const computeDirty = (
      backend: VsumDetails | undefined,
      snapshot: WorkspaceSnapshot | null
  ): boolean => {
    if (!backend || !snapshot) return false;

    // Compare meta-model IDs (sourceId on backend vs snapshot.metaModelIds)
    const backendSourceIds =
        backend.metaModels
            ?.map(mm => mm.sourceId)
            .filter((x): x is number => typeof x === 'number') ?? [];
    const snapIds = snapshot.metaModelIds ?? [];

    if (!areIdArraysEqual(backendSourceIds, snapIds)) {
      return true;
    }

    // Compare relations (sourceId, targetId, reactionFileId)
    const backendRelsRaw = (backend as any).metaModelsRelation ?? [];
    const backendRels = (backendRelsRaw as Array<any>)
        .map(r => `${r.sourceId}->${r.targetId}#${r.reactionFileId ?? ''}`)
        .sort();

    const snapRelsRaw = snapshot.metaModelRelationRequests ?? [];
    const snapRels = snapRelsRaw
        .map(r => `${r.sourceId}->${r.targetId}#${r.reactionFileId ?? ''}`)
        .sort();

    if (backendRels.length !== snapRels.length) return true;
    for (let i = 0; i < backendRels.length; i++) {
      if (backendRels[i] !== snapRels[i]) return true;
    }

    return false;
  };

  // ---- load VSUM details for active tab --------------------------

  useEffect(() => {
    const active = openTabs.find(t => t.instanceId === activeInstanceId);
    const activeId = active?.id;
    if (!activeId || detailsById[activeId]) return;

    const fetchDetails = async (id: number) => {
      setError('');
      try {
        const res = await apiService.getVsumDetails(id);
        setDetailsById(prev => ({ ...prev, [id]: res.data }));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load VSUM details');
      }
    };

    fetchDetails(activeId);
  }, [activeInstanceId, openTabs, detailsById]);

  // ---- keep workspace snapshot in sync (polling) -----------------

  useEffect(() => {
    if (!requestWorkspaceSnapshot || !activeInstanceId) {
      setWorkspaceSnapshot(null);
      return;
    }

    let cancelled = false;

    const update = async () => {
      try {
        const snap = await requestWorkspaceSnapshot();
        if (!cancelled) {
          setWorkspaceSnapshot(snap);
        }
      } catch (e) {
        console.warn('Failed to fetch workspace snapshot', e);
      }
    };

    // initial fetch
    update();

    // polling to keep dirty state in sync with canvas
    const intervalId = window.setInterval(update, 800);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [requestWorkspaceSnapshot, activeInstanceId]);

  // ---- save logic ------------------------------------------------

  const saveById = async (id: number) => {
    const backend = detailsById[id];
    if (!backend) return;

    // Make sure we have a fresh snapshot before saving
    let snap = workspaceSnapshot;
    if (!snap && requestWorkspaceSnapshot) {
      try {
        snap = await requestWorkspaceSnapshot();
      } catch (e) {
        console.warn('Failed to refresh workspace snapshot before save', e);
      }
    }
    if (!snap) {
      snap = { metaModelIds: [], metaModelRelationRequests: [] };
    }

    const backendMetaModels = backend.metaModels ?? [];

    // 1) PARENT collection: stable meta model IDs (sourceId)
    const parentMetaModelIds =
        backendMetaModels
            .map(mm => mm.sourceId)
            .filter((x): x is number => typeof x === 'number');

    // snap.metaModelIds currently holds CLONE ids from the canvas.
    // Map them back to parent sourceId. If that fails, fall back to all parents.
    const mappedParentIdsFromSnapshot =
        (snap.metaModelIds ?? [])
            .map(cloneId => {
              const mm = backendMetaModels.find(m => m.id === cloneId);
              return mm?.sourceId;
            })
            .filter((x): x is number => typeof x === 'number');

    const metaModelIds =
        mappedParentIdsFromSnapshot.length > 0
            ? mappedParentIdsFromSnapshot
            : parentMetaModelIds;

    if (metaModelIds.length === 0) {
      setError('At least one MetaModel is required');
      return;
    }

    // Then map relation sourceId/targetId from cloneId -> parent sourceId
    const mappedRelations = (snap?.metaModelRelationRequests ?? [])
        .map(rel => {
          const srcParent = backendMetaModels.find(m => m.id === rel.sourceId)?.sourceId;
          const tgtParent = backendMetaModels.find(m => m.id === rel.targetId)?.sourceId;

          if (typeof srcParent !== "number" || typeof tgtParent !== "number") {
            return null;
          }

          return {
            sourceId: srcParent,
            targetId: tgtParent,
            reactionFileId: rel.reactionFileId ?? null, // required by backend
          };
        })
        .filter((r): r is MetaModelRelationRequest => r !== null);

    const relationsToSend: MetaModelRelationRequest[] | null =
        mappedRelations.length > 0 ? mappedRelations : null;

    // --- send to backend -----------------------------------------

    setSaving(true);
    setError('');
    try {
      await apiService.updateVsumSyncChanges(id, {
        metaModelIds,                // PARENT IDs
        metaModelRelationRequests: relationsToSend, // mapped to PARENT IDs
      });

      // reload backend details so dirty calculation is correct
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
    const active = openTabs.find(t => t.instanceId === activeInstanceId);
    const id = active?.id;
    if (!id) return;
    await saveById(id);
  };

  // ---- derived UI state ------------------------------------------

  if (openTabs.length === 0) return null;

  const active = openTabs.find(t => t.instanceId === activeInstanceId);
  const anyDirty = active
      ? computeDirty(detailsById[active.id], workspaceSnapshot)
      : false;

  // ---- render ----------------------------------------------------

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
              cursor: saving ? 'progress' : 'default',
            }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
            <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  overflowX: 'auto',
                  flex: 1,
                }}
            >
              {openTabs.map(tab => {
                const isActive = tab.instanceId === activeInstanceId;
                const name = detailsById[tab.id]?.name || `VSUM #${tab.id}`;
                const isTabDirty = computeDirty(detailsById[tab.id], workspaceSnapshot);

                return (
                    <div
                        key={tab.instanceId}
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
                          boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                        }}
                        onClick={() => onActivate(tab.instanceId)}
                        aria-current={isActive ? 'page' : undefined}
                        title={name}
                    >
                      {isTabDirty && (
                          <span
                              aria-label="Unsaved changes"
                              title="Unsaved changes"
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 6,
                                background: '#f59e0b',
                                display: 'inline-block',
                              }}
                          />
                      )}
                      <span
                          style={{
                            fontWeight: 700,
                            color: '#1f2937',
                            fontSize: 12,
                            whiteSpace: 'nowrap',
                          }}
                      >
                    {name}
                  </span>
                      <button
                          onClick={e => {
                            e.stopPropagation();
                            onClose(tab.instanceId);
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
                            justifyContent: 'center',
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

            {activeInstanceId && (
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
                            fontSize: 11,
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
                            cursor: saving ? 'not-allowed' : 'pointer',
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
                  zIndex: 21,
                }}
                onClick={onAddMetaModels}
            >
              + ADD META MODELS
            </button>
        )}
      </>
  );
};