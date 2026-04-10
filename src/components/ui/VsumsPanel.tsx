import React, { useEffect, useRef, useState, useCallback } from 'react';
import { apiService } from '../../services/api';
import { Vsum } from '../../types';
import { CreateVsumModal } from './CreateVsumModal';
import { VsumDetailsModal } from './VsumDetailsModal';
import { ConfirmDialog } from './ConfirmDialog';

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
    borderBottom: '2px solid #049484',
    fontFamily: 'Georgia, serif',
};

const createButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 18px',
    marginBottom: '12px',
    border: 'none',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #049484 0%, #037368 100%)',
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
    boxShadow: '0 2px 8px rgba(4, 148, 132, 0.25)',
    fontFamily: 'Georgia, serif',
};

const createButtonHoverStyle: React.CSSProperties = {
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(4, 148, 132, 0.35)',
    background: 'linear-gradient(135deg, #037368 0%, #025850 100%)',
};

const cardStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer',
};

const cardHoverStyle: React.CSSProperties = {
    boxShadow: '0 8px 24px rgba(4, 148, 132, 0.15)',
    transform: 'translateY(-2px)',
    borderColor: '#049484',
};

const errorStyle: React.CSSProperties = {
    padding: '10px 14px',
    margin: '8px 0',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: '#f8d7da',
    color: '#721c24',
    border: '1px solid #f5c6cb',
};

const successStyle: React.CSSProperties = {
    padding: '10px 14px',
    margin: '8px 0',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: '#d1fae5',
    color: '#065f46',
    border: '1px solid #a7f3d0',
};

export const VsumsPanel: React.FC = () => {
    const [items, setItems] = useState<Vsum[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');
    const [search, setSearch] = useState('');
    const [showDeleted, setShowDeleted] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [detailsId, setDetailsId] = useState<number | null>(null);
    const [recoveringId, setRecoveringId] = useState<number | null>(null);
    const [recoverConfirmId, setRecoverConfirmId] = useState<number | null>(null);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const requestSeq = useRef(0);
    const PAGE_SIZE = 10;

    const formatDateTime = (iso: string) => {
        const d = new Date(iso);
        return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    };

    // Returns how many days remain before auto-deletion (backend deletes after 30 days).
    const getDaysLeft = (removedAt: string | null | undefined): number => {
        if (!removedAt) return 30;
        const deletedMs = new Date(removedAt).getTime();
        const elapsedDays = (Date.now() - deletedMs) / (1000 * 60 * 60 * 24);
        return Math.max(0, Math.floor(30 - elapsedDays));
    };

    // Returns urgency level: 'critical' | 'warning' | 'caution' | 'safe'
    const getDaysLeftUrgency = (days: number) => {
        if (days <= 3)  return 'critical' as const;
        if (days <= 7)  return 'warning'  as const;
        if (days <= 14) return 'caution'  as const;
        return 'safe' as const;
    };

    const URGENCY_COLORS = {
        critical: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5', dot: '#ef4444' },
        warning:  { bg: '#fff7ed', text: '#c2410c', border: '#fdba74', dot: '#f97316' },
        caution:  { bg: '#fefce8', text: '#854d0e', border: '#fde68a', dot: '#eab308' },
        safe:     { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0', dot: '#22c55e' },
    };

    const loadFirstPage = useCallback(async () => {
        const mySeq = ++requestSeq.current;
        setLoading(true);
        setError('');
        setSuccess('');
        setItems([]);
        setPage(0);
        setHasMore(true);
        if (containerRef.current) containerRef.current.scrollTop = 0;
        try {
            const res = showDeleted
                ? await apiService.getRemovedVsumsPaginated(0, PAGE_SIZE)
                : await apiService.getVsumsPaginated(search, 0, PAGE_SIZE);
            if (mySeq !== requestSeq.current) return;
            const newData: Vsum[] = res.data || [];
            setItems(newData);
            setPage(1);
            setHasMore(newData.length === PAGE_SIZE);
        } catch (e) {
            if (mySeq !== requestSeq.current) return;
            setError(e instanceof Error ? e.message : 'Failed to load VSUMs');
        } finally {
            if (mySeq === requestSeq.current) setLoading(false);
        }
    }, [search, showDeleted]);

    const loadNextPage = useCallback(async () => {
        if (loading || !hasMore) return;
        const mySeq = requestSeq.current;
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const res = showDeleted
                ? await apiService.getRemovedVsumsPaginated(page, PAGE_SIZE)
                : await apiService.getVsumsPaginated(search, page, PAGE_SIZE);
            if (mySeq !== requestSeq.current) return;
            const newData: Vsum[] = res.data || [];
            setItems(prev => [...prev, ...newData]);
            setPage(prev => prev + 1);
            setHasMore(newData.length === PAGE_SIZE);
        } catch (e) {
            if (mySeq !== requestSeq.current) return;
            setError(e instanceof Error ? e.message : 'Failed to load VSUMs');
        } finally {
            if (mySeq === requestSeq.current) setLoading(false);
        }
    }, [search, page, hasMore, loading, showDeleted]);

    useEffect(() => {
        loadFirstPage();
    }, [loadFirstPage]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onScroll = () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                if (loading || !hasMore) return;
                const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
                if (nearBottom) loadNextPage();
            });
        };
        el.addEventListener('scroll', onScroll);
        return () => {
            el.removeEventListener('scroll', onScroll);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [hasMore, loading, loadNextPage]);

    const recoverVsum = useCallback(async (id: number) => {
        if (recoveringId) return;
        setError('');
        setSuccess('');
        setRecoveringId(id);
        try {
            await apiService.recoverVsum(id);
            setSuccess('VSUM recovered successfully.');
            // refresh deleted list
            await loadFirstPage();
            globalThis.dispatchEvent(new CustomEvent('vitruv.refreshVsums'));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to recover VSUM');
        } finally {
            setRecoveringId(null);
        }
    }, [recoveringId, loadFirstPage]);

    return (
        <div ref={containerRef} style={containerStyle}>
            <style>{`
                @keyframes pulseBadge {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.55; }
                }
            `}</style>
            <div style={titleStyle}>Projects</div>

            <CreateVsumModal
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                onSuccess={() => loadFirstPage()}
            />

            {error && <div style={errorStyle}>{error}</div>}
            {!error && success && <div style={successStyle}>{success}</div>}

            <button
                onClick={() => setShowCreate(true)}
                style={createButtonStyle}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, createButtonHoverStyle)}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, createButtonStyle)}
            >
                Create New Project
            </button>

            {/* View Toggle Tabs */}
            <div style={{ 
                display: 'flex', 
                gap: 0, 
                marginBottom: 16,
                borderBottom: '2px solid #e5e7eb',
            }}>
                <button
                    onClick={() => setShowDeleted(false)}
                    style={{
                        flex: 1,
                        padding: '12px 16px',
                        border: 'none',
                        borderBottom: showDeleted ? '3px solid transparent' : '3px solid #049484',
                        background: showDeleted ? 'transparent' : '#f0f9ff',
                        color: showDeleted ? '#6b7280' : '#049484',
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        fontFamily: 'Georgia, serif',
                    }}
                    onMouseEnter={(e) => {
                        if (showDeleted) e.currentTarget.style.background = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                        if (showDeleted) e.currentTarget.style.background = 'transparent';
                    }}
                >
                    Active Projects
                </button>
                <button
                    onClick={() => setShowDeleted(true)}
                    style={{
                        flex: 1,
                        padding: '12px 16px',
                        border: 'none',
                        borderBottom: showDeleted ? '3px solid #049484' : '3px solid transparent',
                        background: showDeleted ? '#f0f9ff' : 'transparent',
                        color: showDeleted ? '#049484' : '#6b7280',
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        fontFamily: 'Georgia, serif',
                    }}
                    onMouseEnter={(e) => {
                        if (!showDeleted) e.currentTarget.style.background = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                        if (!showDeleted) e.currentTarget.style.background = 'transparent';
                    }}
                >
                    Deleted Projects
                </button>
            </div>

            {/* 30-day auto-deletion notice — styled to match project teal theme */}
            {showDeleted && (
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '11px 14px',
                    marginBottom: 14,
                    borderRadius: 8,
                    background: '#f0fdf9',
                    border: '1px solid #99e6da',
                    fontSize: 12,
                    color: '#065f46',
                    lineHeight: 1.6,
                    fontFamily: 'Georgia, serif',
                }}>
                    {/* Clock icon using project teal */}
                    <svg style={{ flexShrink: 0, marginTop: 1 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#049484" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>
                        Deleted projects are <strong style={{ color: '#049484' }}>permanently removed after 30 days</strong>. Restore before time runs out.
                    </span>
                </div>
            )}

            {/* Search Bar */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
                <svg 
                    style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                >
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            loadFirstPage();
                        }
                    }}
                    placeholder="Search projects... (press Enter)"
                    style={{
                        width: '100%',
                        padding: '12px 14px 12px 42px',
                        borderRadius: '8px',
                        border: '2px solid #e5e7eb',
                        fontSize: 14,
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box',
                    }}
                    onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#049484';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(4, 148, 132, 0.1)';
                    }}
                    onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                />
            </div>

            {(items
                .filter(item => showDeleted ? !!item.removedAt : !item.removedAt)
                .sort((a, b) => {
                    // Sort by date: newest first (descending order)
                    // For deleted items, use removedAt or updatedAt; for regular items, use createdAt
                    const getSortDate = (item: Vsum): number => {
                        if (showDeleted) {
                            return item.removedAt 
                                ? new Date(item.removedAt).getTime() 
                                : new Date(item.updatedAt).getTime();
                        }
                        return new Date(item.createdAt).getTime();
                    };
                    
                    return getSortDate(b) - getSortDate(a); // Descending order (newest first)
                })
            ).map((item) => {
                const role = (item as any).role as string | undefined;
                const canManage = role === 'OWNER';
                return (
                    <div
                        key={item.id}
                        style={cardStyle}
                        onMouseEnter={(e) => Object.assign(e.currentTarget.style, cardHoverStyle)}
                        onMouseLeave={(e) => Object.assign(e.currentTarget.style, cardStyle)}
                        onDoubleClick={() => {
                            if (!showDeleted) {
                                globalThis.dispatchEvent(new CustomEvent('vitruv.openVsum', { detail: { id: item.id } }));
                            }
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                                <div style={{ 
                                    fontWeight: 700, 
                                    color: '#1f2937', 
                                    fontSize: 16,
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 8,
                                    flexWrap: 'wrap',
                                    fontFamily: 'Georgia, serif',
                                }}>
                                    {item.name}
                                    {role && (
                                        <span
                                            style={{
                                                padding: '3px 8px',
                                                borderRadius: 6,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                border: '1px solid #e5e7eb',
                                                background: role === 'OWNER' ? '#ecfdf5' : '#f3f4f6',
                                                color: role === 'OWNER' ? '#065f46' : '#374151',
                                            }}
                                        >
                                            {role}
                                        </span>
                                    )}
                                    {showDeleted && (
                                        <span
                                            style={{
                                                padding: '3px 8px',
                                                borderRadius: 6,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                border: '1px solid #fecaca',
                                                background: '#fef2f2',
                                                color: '#991b1b',
                                            }}
                                            title={item.removedAt ? `Deleted at ${formatDateTime(item.removedAt)}` : 'Deleted'}
                                        >
                                            Deleted
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 12, color: '#9ca3af' }}>
                                        {showDeleted
                                            ? `Deleted: ${(() => {
                                                const d = new Date(item.removedAt || item.updatedAt);
                                                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                            })()}`
                                            : `Created: ${(() => {
                                                const d = new Date(item.createdAt);
                                                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                            })()}`}
                                    </span>

                                    {/* Days-left countdown — inline with the date, matches project style */}
                                    {showDeleted && (() => {
                                        const daysLeft = getDaysLeft(item.removedAt);
                                        const urgency = getDaysLeftUrgency(daysLeft);
                                        const c = URGENCY_COLORS[urgency];
                                        const dayWord = daysLeft === 1 ? 'day' : 'days';
                                        const daysLeftLabel = daysLeft === 0
                                            ? 'Deleting soon'
                                            : `${daysLeft} ${dayWord} left`;
                                        return (
                                            <span
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 5,
                                                    padding: '2px 8px',
                                                    borderRadius: 20,
                                                    border: `1px solid ${c.border}`,
                                                    background: c.bg,
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    color: c.text,
                                                    letterSpacing: '0.2px',
                                                    animation: urgency === 'critical' ? 'pulseBadge 1.4s ease-in-out infinite' : 'none',
                                                    fontFamily: `'Segoe UI', system-ui, sans-serif`,
                                                    whiteSpace: 'nowrap',
                                                }}
                                                title={`Permanently deleted in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (30-day policy)`}
                                            >
                                                {/* Coloured dot indicator */}
                                                <span style={{
                                                    width: 6, height: 6,
                                                    borderRadius: '50%',
                                                    background: c.dot,
                                                    flexShrink: 0,
                                                    display: 'inline-block',
                                                }} />
                                                {daysLeftLabel}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>

                            {canManage && !showDeleted && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDetailsId(item.id);
                                    }}
                                    style={{
                                        padding: '8px 16px',
                                        border: '1px solid #049484',
                                        borderRadius: 8,
                                        background: '#ffffff',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: 13,
                                        color: '#049484',
                                        transition: 'all 0.2s ease',
                                        whiteSpace: 'nowrap',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#049484';
                                        e.currentTarget.style.color = '#ffffff';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = '#ffffff';
                                        e.currentTarget.style.color = '#049484';
                                    }}
                                >
                                    View Details
                                </button>
                            )}

                            {showDeleted && (
                                <button
                                    onClick={() => setRecoverConfirmId(item.id)}
                                    disabled={recoveringId === item.id}
                                    style={{
                                        padding: '8px 16px',
                                        border: 'none',
                                        borderRadius: 8,
                                        background: recoveringId === item.id 
                                            ? '#86efac' 
                                            : '#10b981',
                                        color: '#ffffff',
                                        cursor: recoveringId === item.id ? 'not-allowed' : 'pointer',
                                        fontWeight: 600,
                                        fontSize: 13,
                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                                        whiteSpace: 'nowrap',
                                    }}
                                    title="Click to restore this project"
                                    onMouseEnter={(e) => {
                                        if (recoveringId !== item.id) {
                                            e.currentTarget.style.background = '#059669';
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.35)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (recoveringId !== item.id) {
                                            e.currentTarget.style.background = '#10b981';
                                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.25)';
                                        }
                                    }}
                                >
                                    {recoveringId === item.id ? 'Restoring...' : 'Restore'}
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}

            {!loading && items.filter(item => showDeleted ? !!item.removedAt : !item.removedAt).length === 0 && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    padding: '64px 24px',
                    textAlign: 'center',
                }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                        <path d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <div style={{ fontWeight: 600, fontSize: 16, color: '#374151' }}>
                        {showDeleted ? 'No Deleted Projects' : 'No Projects Found'}
                    </div>
                    <div style={{ fontSize: 13, color: '#9ca3af', maxWidth: 280 }}>
                        {showDeleted 
                            ? 'You don\'t have any deleted projects.' 
                            : 'Create your first project to get started.'}
                    </div>
                </div>
            )}

            {loading && (
                <div style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                }}>
                    <div style={{
                        width: 40,
                        height: 40,
                        border: '4px solid #e5e7eb',
                        borderTop: '4px solid #049484',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                    }} />
                    <div style={{
                        fontSize: '14px',
                        color: '#6b7280',
                        fontWeight: 500,
                    }}>
                        Loading projects...
                    </div>
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                        @keyframes pulseBadge {
                            0%, 100% { opacity: 1; }
                            50% { opacity: 0.55; }
                        }
                    `}</style>
                </div>
            )}

            <ConfirmDialog
                isOpen={recoverConfirmId !== null}
                title="Restore Project"
                message={
                    <>
                        Are you sure you want to restore this project?
                        <br />
                        <br />
                        This will move it back to your active projects list.
                    </>
                }
                confirmText="Restore"
                cancelText="Cancel"
                variant="success"
                onConfirm={() => {
                    if (recoverConfirmId !== null) {
                        recoverVsum(recoverConfirmId);
                        setRecoverConfirmId(null);
                    }
                }}
                onCancel={() => setRecoverConfirmId(null)}
            />

            <VsumDetailsModal
                isOpen={detailsId !== null}
                vsumId={detailsId}
                onClose={() => setDetailsId(null)}
                onSaved={() => loadFirstPage()}
            />
        </div>
    );
};