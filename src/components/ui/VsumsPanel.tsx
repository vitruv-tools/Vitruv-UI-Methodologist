import React, { useEffect, useRef, useState, useCallback } from 'react';
import { apiService } from '../../services/api';
import { Vsum } from '../../types';
import { CreateVsumModal } from './CreateVsumModal';
import { VsumDetailsModal } from './VsumDetailsModal';

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
    marginBottom: '12px',
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

const successStyle: React.CSSProperties = {
    padding: '8px 12px',
    margin: '8px 0',
    borderRadius: '6px',
    fontSize: '12px',
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

    const containerRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const requestSeq = useRef(0);
    const PAGE_SIZE = 10;

    const formatDateTime = (iso: string) => {
        const d = new Date(iso);
        return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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
                Create
            </button>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name..."
                    style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: 14,
                        outline: 'none',
                    }}
                />
                <button
                    onClick={() => loadFirstPage()}
                    style={{
                        padding: '8px 14px',
                        borderRadius: 6,
                        background: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                    }}
                >
                    Search
                </button>
            </div>

            <div
                style={{
                    ...sectionStyle,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                <span>{showDeleted ? 'Deleted' : 'All'}</span>
                <button
                    onClick={() => {
                        // Toggle view; loadFirstPage will auto-run via effect due to dependency on showDeleted
                        setShowDeleted(prev => !prev);
                    }}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid #e5e7eb',
                        background: '#ffffff',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 12,
                        color: '#374151'
                    }}
                    title={showDeleted ? 'Show all VSUMs' : 'Show deleted VSUMs'}
                    aria-label={showDeleted ? 'Show all VSUMs' : 'Show deleted VSUMs'}
                >
                    {/* Academic-styled archive/trash icon (inline SVG, slightly larger) */}
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        focusable="false"
                        style={{ display: 'block' }}
                    >
                        {/* Lid */}
                        <path d="M9 4h6" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" />
                        {/* Handle */}
                        <path d="M10.5 4c0-1 1-2 1.5-2s1.5 1 1.5 2" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" />
                        {/* Top line */}
                        <path d="M4 6h16" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" />
                        {/* Body */}
                        <path d="M6 6l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" stroke="#374151" strokeWidth="1.6" strokeLinejoin="round" />
                        {/* Inner lines */}
                        <path d="M10 10v7M14 10v7" stroke="#6B7280" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    {showDeleted ? 'Show All' : 'Deleted'}
                </button>
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
                        role="button"
                        tabIndex={0}
                        style={cardStyle}
                        onDoubleClick={() => {
                            globalThis.dispatchEvent(new CustomEvent('vitruv.openVsum', { detail: { id: item.id } }));
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                globalThis.dispatchEvent(new CustomEvent('vitruv.openVsum', { detail: { id: item.id } }));
                            }
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontWeight: 700, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {item.name}
                                    {role && (
                                        <span
                                            style={{
                                                padding: '2px 6px',
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
                                                padding: '2px 6px',
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
                                <div style={{ fontSize: 12, color: '#5a6c7d' }}>
                                    {showDeleted
                                        ? `Deleted: ${formatDateTime(item.removedAt || item.updatedAt)}`
                                        : `Created: ${formatDateTime(item.createdAt)}`}
                                </div>
                            </div>

                            {canManage && !showDeleted && (
                                <button
                                    onClick={() => setDetailsId(item.id)}
                                    style={{
                                        padding: '6px 10px',
                                        border: '1px solid #dee2e6',
                                        borderRadius: 6,
                                        background: '#ffffff',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                    }}
                                >
                                    Details
                                </button>
                            )}

                            {showDeleted && (
                                <button
                                    onDoubleClick={() => recoverVsum(item.id)}
                                    disabled={recoveringId === item.id}
                                    style={{
                                        padding: '4px 8px',
                                        border: '1px solid #10b981',
                                        borderRadius: 6,
                                        background: recoveringId === item.id ? '#d1fae5' : '#10b981',
                                        color: '#ffffff',
                                        cursor: recoveringId === item.id ? 'not-allowed' : 'pointer',
                                        fontWeight: 700,
                                        fontSize: 12,
                                    }}
                                    title="Double-click to recover this VSUM"
                                >
                                    {recoveringId === item.id ? 'Recovering…' : 'Recover (double‑click)'}
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}

            {!loading && items.filter(item => showDeleted ? !!item.removedAt : !item.removedAt).length === 0 && (
                <div style={{ textAlign: 'center', color: '#6b7280', marginTop: 40, fontStyle: 'italic' }}>
                    {showDeleted ? 'No deleted VSUMs.' : 'No VSUMs found. Create one to get started.'}
                </div>
            )}

            {loading && (
                <div style={{ padding: 12, fontStyle: 'italic', color: '#5a6c7d', marginTop: 12 }}>
                    Loading...
                </div>
            )}

            <VsumDetailsModal
                isOpen={detailsId !== null}
                vsumId={detailsId}
                onClose={() => setDetailsId(null)}
                onSaved={() => loadFirstPage()}
            />
        </div>
    );
};