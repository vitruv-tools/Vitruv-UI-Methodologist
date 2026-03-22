import React, { useEffect, useState } from 'react';
import { VsumDetails } from '../../types';
import { apiService, MetaModelRelationRequest } from '../../services/api';
import { WorkspaceSnapshot } from '../../types/workspace';
import { useProjectStore } from '../../store/Project';
import { ActiveVsumDetails } from '../../store/ActiveVsumDetails';
import { ConfirmDialog } from './ConfirmDialog';

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

const extractBackendError = (
    err: any,
    fallbackSummary: string,
    fallbackDetail?: string
): { summary: string; detail: string } => {
    const fallback = fallbackDetail ?? fallbackSummary;
    const data = err?.response?.data;

    if (data && typeof data === 'object') {
        const summary =
            typeof data.error === 'string' && data.error.trim()
                ? data.error
                : fallbackSummary;
        const detail =
            typeof data.message === 'string' && data.message.trim()
                ? data.message
                : summary;
        return { summary, detail };
    }

    if (typeof data === 'string' && data.trim()) {
        return { summary: fallbackSummary, detail: data };
    }

    if (typeof err?.message === 'string' && err.message.trim()) {
        return { summary: fallbackSummary, detail: err.message };
    }

    return { summary: fallbackSummary, detail: fallback };
};

const normalizeReactionFileId = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
    }
    return null;
};

const isReactionFilesNotFoundError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('reaction files not found');
};

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
    const [savedWorkspaceById, setSavedWorkspaceById] = useState<Record<number, WorkspaceSnapshot>>({});
    const [knownMissingReactionFileIds, setKnownMissingReactionFileIds] = useState<number[]>([]);

    const [popup, setPopup] = useState<{
        message: string;
        type: 'success' | 'error' | 'info';
    } | null>(null);

    const [checkingBuild, setCheckingBuild] = useState(false);
    const [downloadingArtifact, setDownloadingArtifact] = useState(false);
    const [closeConfirmInstanceId, setCloseConfirmInstanceId] = useState<string | null>(null);
    const [unsavedChangesAction, setUnsavedChangesAction] = useState<'build' | 'download' | null>(null);

    const areIdArraysEqual = (a: number[] = [], b: number[] = []) => {
        if (a.length !== b.length) return false;
        const sa = [...a].sort((x, y) => x - y);
        const sb = [...b].sort((x, y) => x - y);
        for (let i = 0; i < sa.length; i++) {
            if (sa[i] !== sb[i]) return false;
        }
        return true;
    };

    const toComparableSnapshot = (snapshot: WorkspaceSnapshot | null | undefined) => {
        const missingSet = new Set(knownMissingReactionFileIds);
        const ids = [...(snapshot?.metaModelIds ?? [])].sort((a, b) => a - b);
        const rels = [...(snapshot?.metaModelRelationRequests ?? [])]
            .map(r => {
                const normalizedId = normalizeReactionFileId(r.reactionFileId);
                const safeId = missingSet.has(normalizedId ?? 0) ? 0 : normalizedId;
                return `${r.sourceId}->${r.targetId}#${safeId}`;
            })
            .sort((a, b) => a.localeCompare(b));
        return { ids, rels };
    };

    const backendToSnapshot = (backend: VsumDetails): WorkspaceSnapshot => {
        const metaModelIds =
            backend.metaModels
                ?.map(mm => mm.sourceId)
                .filter((x): x is number => typeof x === 'number') ?? [];
        const metaModelRelationRequests =
            ((backend as any).metaModelsRelation ?? []).map((r: any) => ({
                sourceId: r.sourceId,
                targetId: r.targetId,
                reactionFileId: normalizeReactionFileId(r.reactionFileId ?? r.reactionFileStorageId),
            }));
        return { metaModelIds, metaModelRelationRequests };
    };

    const snapshotsEqual = (a: WorkspaceSnapshot | null | undefined, b: WorkspaceSnapshot | null | undefined): boolean => {
        const ca = toComparableSnapshot(a);
        const cb = toComparableSnapshot(b);
        if (!areIdArraysEqual(ca.ids, cb.ids)) return false;
        if (ca.rels.length !== cb.rels.length) return false;
        for (let i = 0; i < ca.rels.length; i++) {
            if (ca.rels[i] !== cb.rels[i]) return false;
        }
        return true;
    };

    const computeDirty = (backend: VsumDetails | undefined, snapshot: WorkspaceSnapshot | null, id?: number): boolean => {
        if (!snapshot) return false;

        // Prefer explicit local baseline captured after successful save.
        // This avoids stale backend/polling races causing false "unsaved" prompts.
        if (typeof id === 'number' && savedWorkspaceById[id]) {
            return !snapshotsEqual(savedWorkspaceById[id], snapshot);
        }

        if (!backend) return false;
        return !snapshotsEqual(backendToSnapshot(backend), snapshot);
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
                setSavedWorkspaceById(prev => (
                    prev[id]
                        ? prev
                        : { ...prev, [id]: backendToSnapshot(res.data) }
                ));
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load VSUM details');
            }
        };

        fetchDetails(activeId);
        useProjectStore.setState({ activeId: activeId });
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

    // ---- save logic ------------------------------------------------

    const saveById = async (id: number) => {
        const backend = detailsById[id];
        if (!backend) return;

        let snap = new ActiveVsumDetails().getAsWorkspaceSnapshot();

        const backendMetaModels = backend.metaModels ?? [];

        const backendSourceIds =
            backendMetaModels
                .map(mm => mm.sourceId)
                .filter((x): x is number => typeof x === 'number');

        const snapshotIds = snap.metaModelIds ?? [];

        // Use snapshot if available, otherwise fall back to backend data
        // Important: If snapshot exists but is empty, user intentionally removed all MetaModels
        const metaModelIds = snap.metaModelIds !== undefined ? snapshotIds : backendSourceIds;

        const relationCandidates =
            (snap.metaModelRelationRequests ?? [])
                .filter(rel => {
                    if (!metaModelIds.includes(rel.sourceId) || !metaModelIds.includes(rel.targetId)) {
                        return false;
                    }
                    // Coarse relation has no reaction file
                    if (rel.reactionFileId === 0) {
                        // Atleast one fine-grained relation must have a reaction file or be a low-code reaction
                        return rel.fineGranularMetaModelRelationSet.some(fineRel => {
                            // Fine-grained relation has a reaction file
                            if (fineRel.reactionFileStorageId != null) {
                                return true;
                            }
                            // Fine-grained relation has a low-code reaction template with params
                            if (fineRel.lowCodeReactionRequestBase != null) {
                                return true;
                            }
                            return false;
                        })
                    }
                    return true;
                })
                .map(rel => {
                    rel.reactionFileId = normalizeReactionFileId(rel.reactionFileId);
                    rel.fineGranularMetaModelRelationSet.forEach(fineRel => {
                        fineRel.reactionFileStorageId = normalizeReactionFileId(fineRel.reactionFileStorageId) ?? undefined;
                    });
                    return rel;
                });

        // Validate reaction file IDs before save to avoid backend
        // "Reaction files not found" errors for stale/deleted file IDs.
        const relationFileIds = Array.from(
            new Set(
                relationCandidates
                    .map(rel => rel.reactionFileId)
                    .filter((id): id is number => typeof id === 'number' && id > 0)
            )
        );

        const validRelationFileIds = new Set<number>();
        const missingRelationFileIds = new Set<number>();
        await Promise.all(
            relationFileIds.map(async (id) => {
                try {
                    await apiService.getFile(id);
                    validRelationFileIds.add(id);
                } catch {
                    missingRelationFileIds.add(id);
                    console.warn(`Skipping relation with missing reaction file id: ${id}`);
                }
            })
        );

        const sanitizedRelations: MetaModelRelationRequest[] = relationCandidates.map(rel =>
            validRelationFileIds.has(rel.reactionFileId ?? -1)
                ? rel
                : { ...rel, reactionFileId: null }
        );

        if (missingRelationFileIds.size > 0) {
            setKnownMissingReactionFileIds(prev => Array.from(new Set([...prev, ...Array.from(missingRelationFileIds)])));
        }

        const relationsToSend: MetaModelRelationRequest[] | null =
            sanitizedRelations.length > 0 ? sanitizedRelations : null;

        console.log('💾 Saving VSUM changes:', {
            vsumId: id,
            metaModelIds,
            relationCount: relationsToSend?.length ?? 0,
            relations: relationsToSend,
            note: 'Sending all valid relations; reactionFileId is 0 when no file is linked',
        });

        setSaving(true);
        setError('');
        setPopup(null);
        const applySuccessfulSave = async (savedRelations: MetaModelRelationRequest[], successMessage: string) => {
            setPopup({ message: successMessage, type: 'success' });

            const res = await apiService.getVsumDetails(id);
            setDetailsById(prev => ({ ...prev, [id]: res.data }));
            setWorkspaceSnapshot({
                metaModelIds,
                metaModelRelationRequests: savedRelations,
            });
            setSavedWorkspaceById(prev => ({
                ...prev,
                [id]: {
                    metaModelIds,
                    metaModelRelationRequests: savedRelations,
                },
            }));

            globalThis.dispatchEvent(new CustomEvent('vitruv.refreshVsums'));
        };
        try {
            const response: any = await apiService.updateVsumSyncChanges(id, {
                metaModelIds,
                metaModelRelationRequests: relationsToSend,
            });

            const backendMessage =
                response?.data?.message ||
                response?.message ||
                'VSUM successfully updated';

            await applySuccessfulSave(sanitizedRelations, backendMessage);
        } catch (e: any) {
            const parsed = extractBackendError(
                e,
                'Failed to save VSUM',
                'Failed to save VSUM'
            );

            // Recovery path: backend rejected one or more reaction file IDs.
            // Retry once with relation links kept but reactionFileId reset to 0.
            if (isReactionFilesNotFoundError(parsed.detail) && sanitizedRelations.length > 0) {
                const fallbackRelations = sanitizedRelations.map(rel => ({
                    ...rel,
                    reactionFileId: 0,
                }));

                const brokenIds = sanitizedRelations
                    .map(rel => rel.reactionFileId)
                    .filter((fileId): fileId is number => typeof fileId === 'number' && fileId > 0);

                if (brokenIds.length > 0) {
                    setKnownMissingReactionFileIds(prev => Array.from(new Set([...prev, ...brokenIds])));
                }

                try {
                    const retryResponse: any = await apiService.updateVsumSyncChanges(id, {
                        metaModelIds,
                        metaModelRelationRequests: fallbackRelations,
                    });

                    const retryMessage =
                        retryResponse?.data?.message ||
                        retryResponse?.message ||
                        'VSUM successfully updated';

                    await applySuccessfulSave(
                        fallbackRelations,
                        `${retryMessage} (Missing reaction files were unlinked automatically.)`
                    );
                    return;
                } catch (retryError: any) {
                    const retryParsed = extractBackendError(
                        retryError,
                        'Failed to save VSUM',
                        'Failed to save VSUM'
                    );
                    setError(retryParsed.detail);
                    setPopup({ message: retryParsed.detail, type: 'error' });
                    return;
                }
            }

            setError(parsed.detail);
            setPopup({ message: parsed.detail, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const onSave = async () => {
        const active = openTabs.find(t => t.instanceId === activeInstanceId);
        const id = active?.id;
        if (!id) return;
        try {
            await saveById(id);
        } catch (error) {
            console.error('Save failed:', error);
            setPopup({ 
                message: error instanceof Error ? error.message : 'Failed to save VSUM', 
                type: 'error' 
            });
        }
    };

    // ---- download artifact -------------------------------------
    const onDownloadArtifact = async () => {
        const active = openTabs.find(t => t.instanceId === activeInstanceId);
        if (!active) return;
        
        // Check for unsaved changes
        const isDirty = computeDirty(detailsById[active.id], workspaceSnapshot, active.id);
        if (isDirty) {
            setUnsavedChangesAction('download');
            return;
        }
        
        await performDownload();
    };

    const performDownload = async () => {
        const active = openTabs.find(t => t.instanceId === activeInstanceId);
        if (!active) return;
        
        setDownloadingArtifact(true);
        setError('');
        try {
            const blob = await apiService.downloadVsumArtifact(active.id);
            
            // Create a download link and trigger it
            const url = globalThis.URL.createObjectURL(blob);
            const link = globalThis.document.createElement('a');
            link.href = url;
            link.download = `vsum-${active.id}-artifact.zip`;
            globalThis.document.body.appendChild(link);
            link.click();
            link.remove();
            globalThis.URL.revokeObjectURL(url);
            
            setPopup({ message: 'Artifact downloaded successfully!', type: 'success' });
            setTimeout(() => setPopup(null), 3000);
        } catch (err: any) {
            const parsed = extractBackendError(
                err,
                'Failed to download artifact',
                'Artifact download failed.'
            );
            setError(parsed.summary);
            setPopup({ message: parsed.detail, type: 'error' });
            setTimeout(() => setPopup(null), 5000);
        } finally {
            setDownloadingArtifact(false);
        }
    };

    // ---- check build ------------------------------------------

    const onCheckBuild = async () => {
        const active = openTabs.find(t => t.instanceId === activeInstanceId);
        const id = active?.id;
        if (!id) return;

        // Check for unsaved changes
        const isDirty = computeDirty(detailsById[id], workspaceSnapshot, id);
        if (isDirty) {
            setUnsavedChangesAction('build');
            return;
        }

        await performBuild();
    };

    const performBuild = async () => {
        const active = openTabs.find(t => t.instanceId === activeInstanceId);
        const id = active?.id;
        if (!id) return;

        setCheckingBuild(true);
        setPopup({ message: 'Checking if this VSUM can be built…', type: 'info' });

        try {
            const res = await apiService.buildVsum(id);
            const msg =
                (res as any)?.message ||
                'This VSUM can be built successfully.';
            setPopup({ message: msg, type: 'success' });
        } catch (e: any) {
            const parsed = extractBackendError(
                e,
                'Build failed.',
                'Build check failed.'
            );
            setError(parsed.summary);
            setPopup({ message: parsed.detail, type: 'error' });
        } finally {
            setCheckingBuild(false);
        }
    };

    // ---- derived UI state ------------------------------------------

    if (openTabs.length === 0) return null;

    const active = openTabs.find(t => t.instanceId === activeInstanceId);
    const anyDirty = active
        ? computeDirty(detailsById[active.id], workspaceSnapshot, active.id)
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
                            const isTabDirty = computeDirty(detailsById[tab.id], workspaceSnapshot, tab.id);

                            return (
                                <div
                                    key={tab.instanceId}
                                    role="tab"
                                    tabIndex={0}
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
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            onActivate(tab.instanceId);
                                        }
                                    }}
                                    aria-selected={isActive}
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
                                            // Check if this tab has unsaved changes
                                            const tabHasUnsavedChanges = computeDirty(detailsById[tab.id], workspaceSnapshot, tab.id);
                                            if (tabHasUnsavedChanges && isActive) {
                                                setCloseConfirmInstanceId(tab.instanceId);
                                            } else {
                                                onClose(tab.instanceId);
                                            }
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
                            {checkingBuild && (
                                <div
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: 999,
                                        background: '#dcfce7',
                                        color: '#166534',
                                        fontSize: 11,
                                        fontWeight: 600,
                                    }}
                                >
                                    Checking…
                                </div>
                            )}

                            {error && (
                                <div
                                    role="alert"
                                    title={error}
                                    style={{
                                        padding: '4px 8px',
                                        border: '1px solid #fecaca',
                                        color: '#991b1b',
                                        background: '#fef2f2',
                                        borderRadius: 6,
                                        fontSize: 11,
                                        maxWidth: 520,
                                        whiteSpace: 'normal',
                                        overflowWrap: 'anywhere',
                                        lineHeight: 1.35,
                                    }}
                                >
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={onCheckBuild}
                                disabled={checkingBuild || saving}
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    border: '1px solid #16a34a',
                                    background: checkingBuild ? '#bbf7d0' : '#22c55e',
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    cursor: checkingBuild || saving ? 'not-allowed' : 'pointer',
                                    fontSize: 12,
                                }}
                            >
                                {checkingBuild ? 'Checking…' : 'Check build'}
                            </button>

                            <button
                                onClick={onDownloadArtifact}
                                disabled={downloadingArtifact || saving}
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    border: '1px solid #037368',
                                    background: downloadingArtifact ? '#a5d6d3' : '#049484',
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    cursor: downloadingArtifact || saving ? 'not-allowed' : 'pointer',
                                    fontSize: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                                onMouseEnter={(e) => {
                                    if (!downloadingArtifact && !saving) {
                                        e.currentTarget.style.background = '#037368';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!downloadingArtifact && !saving) {
                                        e.currentTarget.style.background = '#049484';
                                    }
                                }}
                            >
                                <span>{downloadingArtifact ? '⏳' : ''}</span>
                                <span>{downloadingArtifact ? 'Downloading…' : 'Download ZIP'}</span>
                            </button>

                            {anyDirty && (
                                <button
                                    onClick={onSave}
                                    disabled={saving}
                                    style={{
                                        padding: '6px 10px',
                                        border: '1px solid #037368',
                                        borderRadius: 8,
                                        background: saving ? '#a5d6d3' : '#049484',
                                        color: '#ffffff',
                                        fontWeight: 700,
                                        cursor: saving ? 'not-allowed' : 'pointer',
                                        fontSize: 12,
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!saving) {
                                            e.currentTarget.style.background = '#037368';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!saving) {
                                            e.currentTarget.style.background = '#049484';
                                        }
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
                        background: '#049484',
                        color: '#ffffff',
                        border: '1px solid #037368',
                        borderRadius: 6,
                        padding: '8px 12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        zIndex: 21,
                    }}
                    onClick={onAddMetaModels}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#037368';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#049484';
                    }}
                >
                    + ADD META MODELS
                </button>
            )}

            {popup && (
                <div
                    style={{
                        position: 'fixed',
                        right: 24,
                        bottom: 24,
                        zIndex: 9999,
                        minWidth: 260,
                        maxWidth: 600,
                        maxHeight: '70vh',
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
                    <div
                        style={{
                            flex: 1,
                            fontSize: 13,
                            fontWeight: 500,
                            whiteSpace: 'pre-wrap',
                            overflowY: 'auto',
                            maxHeight: '60vh',
                        }}
                        onWheel={e => {
                            // prevent React Flow canvas from handling scroll
                            e.stopPropagation();
                        }}
                    >
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

            <ConfirmDialog
                isOpen={closeConfirmInstanceId !== null}
                title="Unsaved Changes"
                message="You have unsaved changes in this project. Are you sure you want to close it? Your changes will be lost."
                confirmText="Close Anyway"
                cancelText="Keep Open"
                variant="danger"
                onConfirm={() => {
                    if (closeConfirmInstanceId) {
                        onClose(closeConfirmInstanceId);
                        setCloseConfirmInstanceId(null);
                    }
                }}
                onCancel={() => setCloseConfirmInstanceId(null)}
            />

            <ConfirmDialog
                isOpen={unsavedChangesAction !== null}
                title="Unsaved Changes Detected"
                message={
                    <>
                        <p style={{ margin: '0 0 12px 0', lineHeight: '1.6' }}>
                            {unsavedChangesAction === 'build' 
                                ? 'Your project has unsaved changes. The build check will not include these changes.'
                                : 'Your project has unsaved changes. The downloaded artifact will not include these changes.'}
                        </p>
                        <p style={{ margin: '0', fontWeight: 600, fontSize: '14px' }}>
                            Do you want to continue anyway?
                        </p>
                    </>
                }
                confirmText="Continue Anyway"
                cancelText="Close"
                variant="danger"
                onConfirm={async () => {
                    const action = unsavedChangesAction;
                    setUnsavedChangesAction(null);
                    
                    // Continue without saving
                    if (action === 'build') {
                        await performBuild();
                    } else if (action === 'download') {
                        await performDownload();
                    }
                }}
                onCancel={() => {
                    // Just close the dialog
                    setUnsavedChangesAction(null);
                }}
            />
        </>
    );
};