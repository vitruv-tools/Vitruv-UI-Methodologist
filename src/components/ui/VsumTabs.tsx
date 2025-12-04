import React, { useEffect, useState } from 'react';
import { VsumDetails } from '../../types';
import { apiService, MetaModelRelationRequest } from '../../services/api';
import { WorkspaceSnapshot } from '../../types/workspace';

const POPUP_STYLES = {
    success: { background: '#ecfdf3', border: '1px solid #bbf7d0', color: '#166534', icon: '✅' },
    error: { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', icon: '⚠️' },
    info: { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', icon: 'ℹ️' },
} as const;

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

    const [popup, setPopup] = useState<{
        message: string;
        type: 'success' | 'error' | 'info';
    } | null>(null);

    const areIdArraysEqual = (a: number[] = [], b: number[] = []) => {
        if (a.length !== b.length) return false;
        const sa = [...a].sort((x, y) => x - y);
        const sb = [...b].sort((x, y) => x - y);
        for (let i = 0; i < sa.length; i++) {
            if (sa[i] !== sb[i]) return false;
        }
        return true;
    };

    const computeDirty = (backend: VsumDetails | undefined, snapshot: WorkspaceSnapshot | null): boolean => {
        if (!backend || !snapshot) return false;

        const backendSourceIds =
            backend.metaModels
                ?.map(mm => mm.sourceId)
                .filter((x): x is number => typeof x === 'number') ?? [];
        const snapIds = snapshot.metaModelIds ?? [];

        if (!areIdArraysEqual(backendSourceIds, snapIds)) {
            return true;
        }

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

        update();
        const intervalId = globalThis.setInterval(update, 800);

        return () => {
            cancelled = true;
            globalThis.clearInterval(intervalId);
        };
    }, [requestWorkspaceSnapshot, activeInstanceId]);

    useEffect(() => {
        if (!popup) return;
        const timer = globalThis.setTimeout(() => {
            setPopup(null);
        }, 4000);
        return () => globalThis.clearTimeout(timer);
    }, [popup]);

    // ---- save logic ------------------------------------------------

    const saveById = async (id: number) => {
        const backend = detailsById[id];
        if (!backend) return;

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

        const backendSourceIds =
            backendMetaModels
                .map(mm => mm.sourceId)
                .filter((x): x is number => typeof x === 'number');

        const snapshotIds = snap.metaModelIds ?? [];

        const metaModelIds = snapshotIds.length > 0 ? snapshotIds : backendSourceIds;

        if (metaModelIds.length === 0) {
            const msg = 'At least one MetaModel is required';
            setError(msg);
            setPopup({ message: msg, type: 'error' });
            return;
        }

        const filteredRelations =
            (snap.metaModelRelationRequests ?? []).filter(rel =>
                metaModelIds.includes(rel.sourceId) &&
                metaModelIds.includes(rel.targetId) &&
                rel.reactionFileId > 0
            );

        const relationsToSend: MetaModelRelationRequest[] | null =
            filteredRelations.length > 0 ? filteredRelations : null;

        console.log('💾 Saving VSUM changes:', {
            vsumId: id,
            metaModelIds,
            relationCount: relationsToSend?.length ?? 0,
            relations: relationsToSend,
            note: 'Only sending relations with valid reaction files (reactionFileId > 0)',
        });

        setSaving(true);
        setError('');
        setPopup(null);
        try {
            const response: any = await apiService.updateVsumSyncChanges(id, {
                metaModelIds,
                metaModelRelationRequests: relationsToSend,
            });

            const backendMessage =
                response?.data?.message ||
                response?.message ||
                'VSUM successfully updated';

            setPopup({ message: backendMessage, type: 'success' });

            const res = await apiService.getVsumDetails(id);
            setDetailsById(prev => ({ ...prev, [id]: res.data }));

            globalThis.dispatchEvent(new CustomEvent('vitruv.refreshVsums'));
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to save VSUM';
            setError(msg);
            setPopup({ message: msg, type: 'error' });
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

            {/* 🔹 Popup / toast */}
            {popup && (
                <div
                    style={{
                        position: 'fixed',
                        right: 24,
                        bottom: 24,
                        zIndex: 9999,
                        minWidth: 260,
                        maxWidth: 400,
                        padding: '10px 14px',
                        borderRadius: 10,
                        boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
                        background: POPUP_STYLES[popup.type].background,
                        border: POPUP_STYLES[popup.type].border,
                        color: POPUP_STYLES[popup.type].color,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                    }}
                >
                    <div style={{ fontSize: 16 }}>
                        {POPUP_STYLES[popup.type].icon}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, whiteSpace: 'pre-wrap' }}>
                        {popup.message}
                    </div>
                    <button
                        onClick={() => setPopup(null)}
                        style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'inherit',
                            cursor: 'pointer',
                            fontSize: 16,
                            lineHeight: 1,
                            padding: 0,
                            marginLeft: 4,
                        }}
                        aria-label="Close notification"
                    >
                        ×
                    </button>
                </div>
            )}
        </>
    );
};