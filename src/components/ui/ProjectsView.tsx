import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { Vsum } from '../../types';
import { CreateVsumModal } from './CreateVsumModal';
import { VsumDetailsModal } from './VsumDetailsModal';
import { ConfirmDialog } from './ConfirmDialog';

// ── Icons ──────────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const DotsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
  </svg>
);

const FolderIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────

const formatDate = (iso: string) => {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getDaysLeft = (removedAt: string | null | undefined) => {
  if (!removedAt) return 30;
  const elapsed = (Date.now() - new Date(removedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.floor(30 - elapsed));
};

type Urgency = 'critical' | 'warning' | 'caution' | 'safe';

const getUrgency = (days: number): Urgency => {
  if (days <= 3) return 'critical';
  if (days <= 7) return 'warning';
  if (days <= 14) return 'caution';
  return 'safe';
};

const URGENCY = {
  critical: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5', dot: '#ef4444' },
  warning: { bg: '#fff7ed', text: '#c2410c', border: '#fdba74', dot: '#f97316' },
  caution: { bg: '#fefce8', text: '#854d0e', border: '#fde68a', dot: '#eab308' },
  safe: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0', dot: '#22c55e' },
};

// ── RowActionsMenu ──────────────────────────────────────────────────────────

interface RowActionsMenuProps {
  item: Vsum;
  canManage: boolean;
  onDetails: () => void;
  onDelete: () => void;
  onOpen: () => void;
}

const RowActionsMenu: React.FC<RowActionsMenuProps> = ({ item, canManage, onDetails, onDelete, onOpen }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; }}
      >
        <DotsIcon />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 300, minWidth: 160, overflow: 'hidden' }}>
          <MenuItem label="Open" onClick={() => { onOpen(); setOpen(false); }} />
          {canManage && <MenuItem label="Details" onClick={() => { onDetails(); setOpen(false); }} />}
          {canManage && <div style={{ height: 1, background: '#f3f4f6', margin: '2px 0' }} />}
          {canManage && <MenuItem label="Delete" onClick={() => { onDelete(); setOpen(false); }} danger />}
        </div>
      )}
    </div>
  );
};

const MenuItem: React.FC<{ label: string; onClick: () => void; danger?: boolean }> = ({ label, onClick, danger }) => (
  <button
    onClick={onClick}
    style={{ display: 'block', width: '100%', padding: '9px 14px', border: 'none', background: 'transparent', fontSize: 13, color: danger ? '#dc2626' : '#374151', cursor: 'pointer', textAlign: 'left' }}
    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = danger ? '#fef2f2' : '#f9fafb'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
  >
    {label}
  </button>
);

// ── ProjectRow ─────────────────────────────────────────────────────────────

interface ProjectRowProps {
  item: Vsum;
  showDeleted: boolean;
  onDetails: () => void;
  onDelete: () => void;
  onRecover: () => void;
}

const ProjectRow: React.FC<ProjectRowProps> = ({ item, showDeleted, onDetails, onDelete, onRecover }) => {
  const [hovered, setHovered] = useState(false);
  const role = (item as any).role as string | undefined;
  const canManage = role === 'OWNER';

  const navigate = useNavigate();
  const openVsum = () => {
    if (!showDeleted) navigate(`/canvas/${item.id}`);
  };

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={!showDeleted ? openVsum : undefined}
      style={{ borderBottom: '1px solid #f9fafb', background: hovered ? '#fafafa' : '#fff', transition: 'background 0.1s', cursor: showDeleted ? 'default' : 'pointer' }}
    >
      {/* Name */}
      <td style={{ padding: '13px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{item.name}</span>
          {role && (
            <span style={{
              padding: '2px 7px', borderRadius: 5, fontSize: 11, fontWeight: 700,
              background: role === 'OWNER' ? '#ecfdf5' : '#f3f4f6',
              color: role === 'OWNER' ? '#065f46' : '#374151',
              border: '1px solid', borderColor: role === 'OWNER' ? '#a7f3d0' : '#e5e7eb',
            }}>
              {role}
            </span>
          )}
        </div>
      </td>

      {/* Date */}
      <td style={{ padding: '13px 16px', fontSize: 14, color: '#6b7280', whiteSpace: 'nowrap' }}>
        {showDeleted
          ? formatDate(item.removedAt || item.updatedAt)
          : formatDate(item.createdAt)}
      </td>

      {/* Status */}
      <td style={{ padding: '13px 16px' }}>
        {showDeleted ? (() => {
          const days = getDaysLeft(item.removedAt);
          const u = getUrgency(days);
          const c = URGENCY[u];
          return (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 9px', borderRadius: 20,
              background: c.bg, border: `1px solid ${c.border}`,
              fontSize: 12, fontWeight: 600, color: c.text,
              animation: u === 'critical' ? 'pulseBadge 1.4s ease-in-out infinite' : 'none',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
              {days === 0 ? 'Deleting soon' : `${days} day${days === 1 ? '' : 's'} left`}
            </span>
          );
        })() : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 12, fontWeight: 600, color: '#166534' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
            Active
          </span>
        )}
      </td>

      {/* Actions */}
      <td style={{ padding: '13px 16px' }} onClick={e => e.stopPropagation()}>
        {showDeleted ? (
          <button
            onClick={onRecover}
            style={{ padding: '6px 14px', border: 'none', borderRadius: 7, background: '#10b981', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#059669'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#10b981'; }}
          >
            Restore
          </button>
        ) : (
          <RowActionsMenu
            item={item}
            canManage={canManage}
            onOpen={openVsum}
            onDetails={onDetails}
            onDelete={onDelete}
          />
        )}
      </td>
    </tr>
  );
};

// ── ProjectsView (main export) ─────────────────────────────────────────────

export const ProjectsView: React.FC = () => {
  const [items, setItems] = useState<Vsum[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detailsId, setDetailsId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [recoverConfirmId, setRecoverConfirmId] = useState<number | null>(null);
  const [recoveringId, setRecoveringId] = useState<number | null>(null);

  const tableBodyRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const requestSeq = useRef(0);
  const PAGE_SIZE = 20;

  // ── data loading ──────────────────────────────────────────────────────────

  const loadFirstPage = useCallback(async () => {
    const mySeq = ++requestSeq.current;
    setLoading(true);
    setError('');
    setItems([]);
    setPage(0);
    setHasMore(true);
    try {
      const res = showDeleted
        ? await apiService.getRemovedVsumsPaginated(0, PAGE_SIZE)
        : await apiService.getVsumsPaginated(search, 0, PAGE_SIZE);
      if (mySeq !== requestSeq.current) return;
      const data: Vsum[] = res.data || [];
      setItems(data);
      setPage(1);
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      if (mySeq !== requestSeq.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (mySeq === requestSeq.current) setLoading(false);
    }
  }, [search, showDeleted]);

  const loadNextPage = useCallback(async () => {
    if (loading || !hasMore) return;
    const mySeq = requestSeq.current;
    setLoading(true);
    try {
      const res = showDeleted
        ? await apiService.getRemovedVsumsPaginated(page, PAGE_SIZE)
        : await apiService.getVsumsPaginated(search, page, PAGE_SIZE);
      if (mySeq !== requestSeq.current) return;
      const data: Vsum[] = res.data || [];
      setItems(prev => [...prev, ...data]);
      setPage(prev => prev + 1);
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      if (mySeq !== requestSeq.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (mySeq === requestSeq.current) setLoading(false);
    }
  }, [search, page, hasMore, loading, showDeleted]);

  useEffect(() => { loadFirstPage(); }, [loadFirstPage]);

  // infinite scroll on the table container
  useEffect(() => {
    const el = tableBodyRef.current;
    if (!el) return;
    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (loading || !hasMore) return;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) loadNextPage();
      });
    };
    el.addEventListener('scroll', onScroll);
    return () => { el.removeEventListener('scroll', onScroll); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [hasMore, loading, loadNextPage]);

  // ── actions ───────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await apiService.deleteVsum(deletingId);
      setDeletingId(null);
      setDeleteError('');
      loadFirstPage();
    } catch (e: any) {
      setDeleteError(e?.message || 'Failed to delete');
    }
  };

  const handleRecover = async () => {
    if (!recoverConfirmId) return;
    setRecoveringId(recoverConfirmId);
    setRecoverConfirmId(null);
    try {
      await apiService.recoverVsum(recoverConfirmId);
      globalThis.dispatchEvent(new CustomEvent('vitruv.refreshVsums'));
      loadFirstPage();
    } catch (e: any) {
      setError(e?.message || 'Failed to restore');
    } finally {
      setRecoveringId(null);
    }
  };

  // sorted list
  const sorted = [...items]
    .filter(i => showDeleted ? !!i.removedAt : !i.removedAt)
    .sort((a, b) => {
      const t = (i: Vsum) => showDeleted
        ? new Date(i.removedAt || i.updatedAt).getTime()
        : new Date(i.createdAt).getTime();
      return t(b) - t(a);
    });

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        @keyframes pulseBadge { 0%,100%{opacity:1} 50%{opacity:.55} }
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
      `}</style>

      {/* Page header */}
      <div style={{ padding: '32px 40px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>Dashboard / Projects</h1>
        <button
          onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: '#0B1720', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 4px rgba(37,99,235,0.25)', transition: 'background 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#0B1720'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#049484'; }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
          <span>New project</span>
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ padding: '20px 40px 0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none', display: 'flex' }}>
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') loadFirstPage(); }}
            placeholder="Search projects..."
            style={{ width: '100%', padding: '8px 12px 8px 34px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#374151', outline: 'none', boxSizing: 'border-box', background: '#fff', transition: 'border-color 0.15s' }}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#049484'; }}
            onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#e5e7eb'; }}
          />
        </div>

        {/* Active / Deleted tabs */}
        <div style={{ display: 'flex', gap: 0, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
          {[
            { key: false, label: 'Active projects' },
            { key: true, label: 'Deleted projects' },
          ].map(({ key, label }) => (
            <button
              key={String(key)}
              onClick={() => setShowDeleted(key)}
              style={{
                padding: '7px 14px', border: 'none', fontSize: 13, fontWeight: showDeleted === key ? 600 : 400,
                background: showDeleted === key ? '#f0faf8' : '#fff',
                color: showDeleted === key ? '#049484' : '#6b7280',
                cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Deleted notice */}
      {showDeleted && (
        <div style={{ margin: '12px 40px 0', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 8, background: '#f0fdf9', border: '1px solid #99e6da', fontSize: 13, color: '#065f46', flexShrink: 0 }}>
          <svg style={{ flexShrink: 0, marginTop: 1 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#049484" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          <span>Deleted projects will be permanently removed after <strong style={{ color: '#049484' }}>30 days</strong>. Restore them before they expire.</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ margin: '10px 40px 0', padding: '9px 13px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', flexShrink: 0 }}>{error}</div>
      )}

      {/* Table */}
      <div ref={tableBodyRef} style={{ flex: 1, padding: '16px 40px 24px', overflow: 'auto' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                {['Name', showDeleted ? 'Deleted on' : 'Created on', 'Status', 'Actions'].map((col, i) => (
                  <th key={col} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', letterSpacing: '0.04em', textTransform: 'uppercase', background: '#fafafa', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap', width: i === 3 ? 120 : undefined }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && !loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: '56px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#9ca3af' }}>
                      <FolderIcon />
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>
                        {showDeleted ? 'No deleted projects' : 'No projects yet'}
                      </div>
                      <div style={{ fontSize: 13 }}>
                        {showDeleted ? 'You have no deleted projects.' : 'Create your first project.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map(item => (
                  <ProjectRow
                    key={item.id}
                    item={item}
                    showDeleted={showDeleted}
                    onDetails={() => setDetailsId(item.id)}
                    onDelete={() => setDeletingId(item.id)}
                    onRecover={() => setRecoverConfirmId(item.id)}
                  />
                ))
              )}
              {loading && (
                <tr>
                  <td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#6b7280', fontSize: 13 }}>
                      <div style={{ width: 18, height: 18, border: '2px solid #e5e7eb', borderTop: '2px solid #049484', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Loading...
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <CreateVsumModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => { setShowCreate(false); loadFirstPage(); }}
      />
      <VsumDetailsModal
        isOpen={detailsId !== null}
        vsumId={detailsId}
        onClose={() => setDetailsId(null)}
        onSaved={() => loadFirstPage()}
      />
      <ConfirmDialog
        isOpen={!!deletingId}
        title="Delete project"
        message={deleteError || 'Do you really want to delete this project? It will be kept in deleted projects for 30 days.'}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => { setDeletingId(null); setDeleteError(''); }}
      />
      <ConfirmDialog
        isOpen={recoverConfirmId !== null}
        title="Restore project"
        message={recoveringId !== null ? 'Restoring...' : 'Should this project be restored? It will be moved back to your active projects.'}
        confirmText="Restore"
        cancelText="Cancel"
        variant="success"
        onConfirm={handleRecover}
        onCancel={() => setRecoverConfirmId(null)}
      />
    </div>
  );
};
