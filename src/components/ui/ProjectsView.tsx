import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { Vsum } from '../../types';
import { CreateVsumModal } from './CreateVsumModal';
import { VsumDetailsModal } from './VsumDetailsModal';
import { ConfirmDialog } from './ConfirmDialog';
import {
  DELETED_PROJECT_RETENTION_DAYS,
  DELETION_URGENCY_STYLES,
  filterRestorableDeletedVsums,
  formatDaysRemainingLabel,
  getDaysUntilPermanentDelete,
  getDeletionUrgency,
} from '../../utils/deletedProjectUtils';
import { isSharedProject, matchesProjectListView, ProjectListView } from '../../utils/vsumProjectList';
import { sharedByFromVsum, resolveVsumAccessRole, mergeStoredProjectAccess } from '../../utils/vsumMemberUtils';
import { readSeenSharedProjectIds } from '../../utils/sharedProjectNotifications';
import { PortalRowActionsMenu } from './PortalRowActionsMenu';

// ── Icons ──────────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
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

const formatAccessRoleLabel = (role: string): string => {
  if (role === 'VIEWER') return 'Viewer';
  if (role === 'OWNER') return 'Owner';
  return 'Member';
};

const emptyProjectListTitle = (view: ProjectListView): string => {
  if (view === 'deleted') return 'No deleted projects';
  if (view === 'shared') return 'No shared projects';
  return 'No projects yet';
};

const emptyProjectListHint = (view: ProjectListView): string => {
  if (view === 'deleted') return 'You have no deleted projects.';
  if (view === 'shared') return 'Projects shared with you by other owners will appear here.';
  return 'Create your first project.';
};

const DeletedProjectStatusBadge: React.FC<{ removedAt?: string | null }> = ({ removedAt }) => {
  const days = getDaysUntilPermanentDelete(removedAt);
  const urgency = getDeletionUrgency(days);
  const colors = DELETION_URGENCY_STYLES[urgency];
  return (
    <span
      title={`Permanent deletion in ${formatDaysRemainingLabel(days)} (${DELETED_PROJECT_RETENTION_DAYS}-day policy)`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 9px', borderRadius: 20,
        background: colors.bg, border: `1px solid ${colors.border}`,
        fontSize: 12, fontWeight: 600, color: colors.text,
        animation: urgency === 'critical' ? 'pulseBadge 1.4s ease-in-out infinite' : 'none',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.dot, flexShrink: 0 }} />{formatDaysRemainingLabel(days)}
    </span>
  );
};

// ── ProjectRow ─────────────────────────────────────────────────────────────

interface ProjectRowProps {
  item: Vsum;
  showDeleted: boolean;
  isUnread?: boolean;
  scrollRootRef?: React.RefObject<HTMLElement | null>;
  onDetails: () => void;
  onDelete: () => void;
  onRecover: () => void;
  onOpen?: () => void;
}

const ProjectRow: React.FC<ProjectRowProps> = ({
  item, showDeleted, isUnread = false, scrollRootRef, onDetails, onDelete, onRecover, onOpen,
}) => {
  const [hovered, setHovered] = useState(false);
  const role = resolveVsumAccessRole(item.role, item.roleEn) ?? item.role;
  const canManage = (role ?? '').toUpperCase() === 'OWNER';

  const roleBadgeStyle = (r: string): React.CSSProperties => {
    if (r === 'OWNER') {
      return { background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' };
    }
    if (r === 'VIEWER') {
      return { background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' };
    }
    return { background: '#f3f4f6', color: '#374151', borderColor: '#e5e7eb' };
  };

  const navigate = useNavigate();
  const openVsum = () => {
    onOpen?.();
    const sharedBy = sharedByFromVsum(item);
    mergeStoredProjectAccess(item.id, {
      accessRole: resolveVsumAccessRole(item.role, item.roleEn) ?? item.role,
      sharedBy,
    });
    navigate(`/canvas/${item.id}`, {
      state: {
        vsumId: item.id,
        accessRole: resolveVsumAccessRole(item.role, item.roleEn) ?? item.role,
        sharedBy,
      },
    });
  };
  const handleMouseEnter = () => setHovered(true);
  const handleMouseLeave = () => setHovered(false);

  return (
    <tr
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={showDeleted ? undefined : openVsum}
      style={{ borderBottom: '1px solid #f9fafb', background: hovered ? '#fafafa' : '#fff', transition: 'background 0.1s', cursor: showDeleted ? 'default' : 'pointer' }}
    >
      {/* Name */}
      <td style={{ padding: '13px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isUnread && (
            <span
              title="New shared project"
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#ef4444',
                flexShrink: 0,
              }}
            />
          )}
          <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{item.name}</span>
          {role && (
            <span style={{
              padding: '2px 7px', borderRadius: 5, fontSize: 11, fontWeight: 700,
              border: '1px solid',
              ...roleBadgeStyle(role),
            }}>
              {formatAccessRoleLabel(role)}
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
        {showDeleted ? (
          <DeletedProjectStatusBadge removedAt={item.removedAt} />
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 12, fontWeight: 600, color: '#166534' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />{'Active'}
          </span>
        )}
      </td>

      {/* Actions */}
      <td style={{ padding: '13px 16px' }} onClick={e => e.stopPropagation()}>
        {showDeleted ? (
          <button type="button"
            onClick={onRecover}
            style={{ padding: '6px 14px', border: 'none', borderRadius: 7, background: '#10b981', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#059669'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#10b981'; }}
          >
            Restore
          </button>
        ) : (
          <PortalRowActionsMenu
            scrollRootRef={scrollRootRef}
            actions={[
              { label: 'Open', onClick: openVsum },
              ...(canManage
                ? [
                    { label: 'Details', onClick: onDetails },
                    { label: 'Delete', onClick: onDelete, danger: true, dividerBefore: true },
                  ]
                : []),
            ]}
          />
        )}
      </td>
    </tr>
  );
};

// ── ProjectsView (main export) ─────────────────────────────────────────────

interface ProjectsViewProps {
  userKey?: string | null;
  /** Unread shared-project count from global notification state */
  sharedUnreadCount?: number;
  onSharedProjectOpened?: (projectId: number) => void;
  onSharedTabOpened?: (sharedProjectIds: number[]) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  userKey = null,
  sharedUnreadCount = 0,
  onSharedProjectOpened,
  onSharedTabOpened,
}) => {
  const [items, setItems] = useState<Vsum[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [projectView, setProjectView] = useState<ProjectListView>('mine');
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
  const seenSharedIds = readSeenSharedProjectIds(userKey);

  useEffect(() => {
    if (projectView !== 'shared') return;
    const sharedIds = items.filter(isSharedProject).map(item => item.id);
    if (sharedIds.length > 0) onSharedTabOpened?.(sharedIds);
  }, [projectView, items, onSharedTabOpened]);

  // ── data loading ──────────────────────────────────────────────────────────

  const loadFirstPage = useCallback(async () => {
    const mySeq = ++requestSeq.current;
    setLoading(true);
    setError('');
    setItems([]);
    setPage(0);
    setHasMore(true);
    try {
      const res = projectView === 'deleted'
        ? await apiService.getRemovedVsumsPaginated(0, PAGE_SIZE)
        : await apiService.getVsumsPaginated(search, 0, PAGE_SIZE);
      if (mySeq !== requestSeq.current) return;
      const raw: Vsum[] = res.data || [];
      const data = projectView === 'deleted'
        ? filterRestorableDeletedVsums(raw)
        : raw.filter(i => matchesProjectListView(i, projectView));
      setItems(data);
      setPage(1);
      setHasMore(raw.length === PAGE_SIZE);
    } catch (e) {
      if (mySeq !== requestSeq.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (mySeq === requestSeq.current) setLoading(false);
    }
  }, [search, projectView]);

  const loadNextPage = useCallback(async () => {
    if (loading || !hasMore) return;
    const mySeq = requestSeq.current;
    setLoading(true);
    try {
      const res = projectView === 'deleted'
        ? await apiService.getRemovedVsumsPaginated(page, PAGE_SIZE)
        : await apiService.getVsumsPaginated(search, page, PAGE_SIZE);
      if (mySeq !== requestSeq.current) return;
      const raw: Vsum[] = res.data || [];
      const data = projectView === 'deleted'
        ? filterRestorableDeletedVsums(raw)
        : raw.filter(i => matchesProjectListView(i, projectView));
      setItems(prev => [...prev, ...data]);
      setPage(prev => prev + 1);
      setHasMore(raw.length === PAGE_SIZE);
    } catch (e) {
      if (mySeq !== requestSeq.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (mySeq === requestSeq.current) setLoading(false);
    }
  }, [search, page, hasMore, loading, projectView]);

  const syncListFromApi = useCallback(async () => {
    const mySeq = ++requestSeq.current;
    try {
      const res = projectView === 'deleted'
        ? await apiService.getRemovedVsumsPaginated(0, PAGE_SIZE)
        : await apiService.getVsumsPaginated(search, 0, PAGE_SIZE);
      if (mySeq !== requestSeq.current) return;
      const raw: Vsum[] = res.data || [];
      const data = projectView === 'deleted'
        ? filterRestorableDeletedVsums(raw)
        : raw.filter(i => matchesProjectListView(i, projectView));
      setItems(data);
      setPage(1);
      setHasMore(raw.length === PAGE_SIZE);
    } catch {
      // ignore background refresh errors
    }
  }, [search, projectView]);

  useEffect(() => { loadFirstPage(); }, [loadFirstPage]);

  useEffect(() => {
    const onRefresh = () => { void syncListFromApi(); };
    globalThis.addEventListener('vitruv.refreshVsums', onRefresh);
    return () => globalThis.removeEventListener('vitruv.refreshVsums', onRefresh);
  }, [syncListFromApi]);

  useEffect(() => {
    if (projectView !== 'shared') return;
    const timer = globalThis.setInterval(() => { void syncListFromApi(); }, 15000);
    return () => globalThis.clearInterval(timer);
  }, [projectView, syncListFromApi]);

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
    .filter(i => (
      projectView === 'deleted'
        ? getDaysUntilPermanentDelete(i.removedAt) > 0
        : matchesProjectListView(i, projectView)
    ))
    .sort((a, b) => {
      const t = (i: Vsum) => projectView === 'deleted'
        ? new Date(i.removedAt || i.updatedAt).getTime()
        : new Date(i.createdAt).getTime();
      return t(b) - t(a);
    });

  const showDeleted = projectView === 'deleted';
  const emptyTitle = emptyProjectListTitle(projectView);
  const emptyHint = emptyProjectListHint(projectView);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <style>{`
        @keyframes pulseBadge { 0%,100%{opacity:1} 50%{opacity:.55} }
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        .projects-table-scroll {
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-gutter: stable;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
        }
        .projects-table-scroll::-webkit-scrollbar {
          width: 10px;
        }
        .projects-table-scroll::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .projects-table-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
          border: 2px solid #f1f5f9;
        }
        .projects-table-scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      {/* Page header */}
      <div style={{ padding: '32px 40px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>Dashboard / Projects</h1>
        <button type="button"
          onClick={() => setShowCreate(true)}
          disabled={projectView === 'shared' || projectView === 'deleted'}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px',
            background: projectView === 'mine' ? '#0B1720' : '#94a3b8',
            color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600,
            cursor: projectView === 'mine' ? 'pointer' : 'not-allowed',
            boxShadow: '0 1px 4px rgba(37,99,235,0.25)', transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (projectView === 'mine') (e.currentTarget as HTMLButtonElement).style.background = '#1e293b'; }}
          onMouseLeave={e => { if (projectView === 'mine') (e.currentTarget as HTMLButtonElement).style.background = '#0B1720'; }}
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
        <div style={{ display: 'flex', gap: 0, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', flexShrink: 0, flexWrap: 'wrap' }}>
          {([
            { key: 'mine' as const, label: 'My projects' },
            { key: 'shared' as const, label: 'Shared with me' },
            { key: 'deleted' as const, label: 'Deleted projects' },
          ]).map(({ key, label }) => (
            <button type="button"
              key={key}
              onClick={() => setProjectView(key)}
              style={{
                padding: '7px 14px', border: 'none', fontSize: 13, fontWeight: projectView === key ? 600 : 400,
                background: projectView === key ? '#f0faf8' : '#fff',
                color: projectView === key ? '#049484' : '#6b7280',
                cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                position: 'relative',
              }}
            >
              <span>{label}</span>
              {key === 'shared' && sharedUnreadCount > 0 && (
                <span
                  aria-label={`${sharedUnreadCount} new shared project${sharedUnreadCount === 1 ? '' : 's'}`}
                  style={{
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    borderRadius: 999,
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                    boxShadow: '0 0 0 2px #fff',
                  }}
                >
                  {sharedUnreadCount > 99 ? '99+' : sharedUnreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Deleted notice */}
      {showDeleted && (
        <div style={{ margin: '12px 40px 0', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 8, background: '#f0fdf9', border: '1px solid #99e6da', fontSize: 13, color: '#065f46', flexShrink: 0 }}>
          <svg style={{ flexShrink: 0, marginTop: 1 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#049484" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          <span>Deleted projects are permanently removed after <strong style={{ color: '#049484' }}>{DELETED_PROJECT_RETENTION_DAYS} days</strong>. The status column shows how many days remain. Projects already purged from the database are not listed.</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ margin: '10px 40px 0', padding: '9px 13px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', flexShrink: 0 }}>{error}</div>
      )}

      {/* Table */}
      <div
        ref={tableBodyRef}
        className="projects-table-scroll"
        style={{ flex: 1, minHeight: 0, padding: '16px 40px 24px' }}
      >
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
                        {emptyTitle}
                      </div>
                      <div style={{ fontSize: 13 }}>
                        {emptyHint}
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
                    isUnread={isSharedProject(item) && !seenSharedIds.has(item.id)}
                    scrollRootRef={tableBodyRef}
                    onDetails={() => setDetailsId(item.id)}
                    onDelete={() => setDeletingId(item.id)}
                    onRecover={() => setRecoverConfirmId(item.id)}
                    onOpen={() => {
                      if (isSharedProject(item)) onSharedProjectOpened?.(item.id);
                    }}
                  />
                ))
              )}
              {loading && (
                <tr>
                  <td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#6b7280', fontSize: 13 }}>
                      <div style={{ width: 18, height: 18, border: '2px solid #e5e7eb', borderTop: '2px solid #049484', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />{'Loading...'}
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
        message={recoveringId === null ? 'Should this project be restored? It will be moved back to your active projects.' : 'Restoring...'}
        confirmText="Restore"
        cancelText="Cancel"
        variant="success"
        onConfirm={handleRecover}
        onCancel={() => setRecoverConfirmId(null)}
      />
    </div>
  );
};
