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

export const VsumsPanel: React.FC = () => {
    const [items, setItems] = useState<Vsum[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [detailsId, setDetailsId] = useState<number | null>(null);

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
        setItems([]);
        setPage(0);
        setHasMore(true);
        if (containerRef.current) containerRef.current.scrollTop = 0;
        try {
            const res = await apiService.getVsumsPaginated(search, 0, PAGE_SIZE);
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
    }, [search]);

    const loadNextPage = useCallback(async () => {
        if (loading || !hasMore) return;
        const mySeq = requestSeq.current;
        setLoading(true);
        setError('');
        try {
            const res = await apiService.getVsumsPaginated(search, page, PAGE_SIZE);
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
    }, [search, page, hasMore, loading]);

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

    return (
        <div ref={containerRef} style={containerStyle}>
            <div style={titleStyle}>Projects</div>

            <CreateVsumModal
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                onSuccess={() => loadFirstPage()}
            />

            {error && <div style={errorStyle}>{error}</div>}

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

            <div style={sectionStyle}>All</div>

            {items.map((item) => (
                <div
                    key={item.id}
                    style={cardStyle}
                    onDoubleClick={() =>
                        window.dispatchEvent(new CustomEvent('vitruv.openVsum', { detail: { id: item.id } }))
                    }
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ fontWeight: 700, color: '#2c3e50' }}>{item.name}</div>
                            <div style={{ fontSize: 12, color: '#5a6c7d' }}>
                                Created: {formatDateTime(item.createdAt)}
                            </div>
                        </div>
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
                    </div>
                </div>
            ))}

            {!loading && items.length === 0 && (
                <div style={{ textAlign: 'center', color: '#6b7280', marginTop: 40, fontStyle: 'italic' }}>
                    No VSUMs found. Create one to get started.
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