import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { apiService } from '../../services/api';
import { Vsum } from '../../types';
import { sharedByFromVsum, resolveVsumAccessRole, mergeStoredProjectAccess } from '../../utils/vsumMemberUtils';
import { isSharedProject } from '../../utils/vsumProjectList';

const MENU_Z_INDEX = 10500;
const MAX_VISIBLE_PROJECTS = 4;
const PROJECT_ROW_HEIGHT = 54;
const PROJECT_LIST_MAX_HEIGHT = MAX_VISIBLE_PROJECTS * PROJECT_ROW_HEIGHT;

export interface ProjectPickerItem {
  id: number;
  name: string;
  role?: string;
}

interface ProjectPickerMenuProps {
  currentProjectName: string;
  onSelectProject: (project: ProjectPickerItem) => void;
  disabled?: boolean;
  /** Shown in the header pill */
  variant?: 'default' | 'compact';
  currentProjectId?: number;
  /** Project id of the active tab */
  activeProjectId?: number;
  /** All project ids that already have an open tab */
  openProjectIds?: number[];
}

const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const SharedIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

function sharedBadgeStyle(): React.CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 700,
    color: '#1d4ed8',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    padding: '2px 8px',
    borderRadius: 20,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  };
}

export const ProjectPickerMenu: React.FC<ProjectPickerMenuProps> = ({
  currentProjectId,
  currentProjectName,
  onSelectProject,
  disabled = false,
  variant = 'default',
  activeProjectId,
  openProjectIds = [],
}) => {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Vsum[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadProjects = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await apiService.getVsumsPaginated(query, 0, 100);
      setProjects(res.data ?? []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = globalThis.setTimeout(() => loadProjects(search), search ? 250 : 0);
    return () => globalThis.clearTimeout(timer);
  }, [open, search, loadProjects]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setSearch('');
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        wrapRef.current?.contains(target)
        || menuRef.current?.contains(target)
      ) {
        return;
      }
      closeMenu();
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside, true);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [open, closeMenu]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, closeMenu]);

  const handleSelect = (project: Vsum) => {
    closeMenu();
    mergeStoredProjectAccess(project.id, {
      accessRole: resolveVsumAccessRole(project.role, project.roleEn) ?? project.role,
      sharedBy: sharedByFromVsum(project),
    });
    onSelectProject({
      id: project.id,
      name: project.name,
      role: resolveVsumAccessRole(project.role, project.roleEn) ?? project.role,
    });
  };

  const isCompact = variant === 'compact';

  const updateMenuPosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 320;
    const left = isCompact
      ? rect.left
      : Math.min(rect.left, globalThis.innerWidth - menuWidth - 12);
    setMenuPos({ top: rect.bottom + 6, left: Math.max(12, left) });
  }, [isCompact]);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updateMenuPosition]);

  const menu = open ? (
    <>
      <button
        type="button"
        aria-label="Close project picker"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: MENU_Z_INDEX - 1,
          background: 'transparent',
          border: 'none',
          cursor: 'default',
          padding: 0,
        }}
        onClick={closeMenu}
      />
      <div
        ref={menuRef}
        id="project-picker-menu"
        role="dialog"
        aria-modal="false"
        aria-label="Your projects"
        style={{
          position: 'fixed',
          margin: 0,
          padding: 0,
          top: menuPos.top,
          left: menuPos.left,
          width: 320,
          maxHeight: 360,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          boxShadow: '0 16px 40px rgba(0,0,0,0.16)',
          zIndex: MENU_Z_INDEX,
          boxSizing: 'border-box',
        }}
      >
      <div style={{ flexShrink: 0, padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Your projects
        </div>
        <input
          type="search"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '9px 11px',
            fontSize: 13,
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            outline: 'none',
          }}
        />
      </div>
      <div
        className="project-picker-scroll"
        title={projects.length > MAX_VISIBLE_PROJECTS ? 'Scroll with two fingers on your trackpad to see more projects' : undefined}
        style={{
          overflowY: projects.length > MAX_VISIBLE_PROJECTS ? 'scroll' : 'auto',
          // `flex: 1` means `flex-basis: 0%`, which Safari resolves to 0 inside this
          // auto-height column — the list then collapses because an auto-height flex
          // container has no free space for `flex-grow` to hand back. An `auto` basis
          // sizes to the rows in every browser; maxHeight still caps it.
          flex: '1 1 auto',
          minHeight: 0,
          padding: 6,
          maxHeight: PROJECT_LIST_MAX_HEIGHT,
          scrollbarWidth: 'thin',
          overscrollBehavior: 'contain',
          boxSizing: 'border-box',
        }}
      >
        {loading && (
          <div style={{ padding: '14px 12px', fontSize: 13, color: '#64748b' }}>Loading projects…</div>
        )}
        {!loading && projects.length === 0 && (
          <div style={{ padding: '14px 12px', fontSize: 13, color: '#64748b' }}>No projects found</div>
        )}
        {!loading && projects.map(project => {
          const isActive = project.id === activeProjectId;
          const isOpen = openProjectIds.includes(project.id);
          const isCurrentInPill = project.id === currentProjectId && !isCompact;
          const isShared = isSharedProject(project);

          let statusDotColor = '#e2e8f0';
          if (isActive) {
            statusDotColor = '#049484';
          } else if (isShared) {
            statusDotColor = '#60a5fa';
          } else if (isOpen) {
            statusDotColor = '#94a3b8';
          }

          let statusLine = 'Click to open';
          if (isActive) {
            statusLine = isShared ? 'Active tab · Shared with you' : 'Active tab';
          } else if (isOpen) {
            statusLine = isShared ? 'Open — shared project' : 'Open — click to switch';
          } else if (isShared) {
            statusLine = 'Shared with you — click to open';
          }

          return (
            <button
              key={project.id}
              type="button"
              aria-current={isActive ? 'true' : undefined}
              onClick={() => handleSelect(project)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                marginBottom: 2,
                border: isActive ? '1px solid #a7f3d0' : '1px solid transparent',
                borderRadius: 8,
                background: isActive ? '#ecfdf5' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = '#f8fafc';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: statusDotColor,
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: '#0f172a',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {project.name}
                </span>
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'block' }}>
                  {statusLine}
                  {isCurrentInPill && !isActive && isOpen && ''}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                {isShared && (
                  <span style={sharedBadgeStyle()} title="Shared with you">
                    <SharedIcon />
                    Shared
                  </span>
                )}
                {isActive && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#047857',
                    background: '#d1fae5',
                    padding: '2px 8px',
                    borderRadius: 20,
                    flexShrink: 0,
                  }}>
                    Active
                  </span>
                )}
                {!isActive && isOpen && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#475569',
                    background: '#f1f5f9',
                    padding: '2px 8px',
                    borderRadius: 20,
                    flexShrink: 0,
                  }}>
                    Open
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      </div>
    </>
  ) : null;

  return (
    <div ref={wrapRef} style={{ position: 'relative', minWidth: 0, flexShrink: 0, width: 'fit-content' }}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="project-picker-menu"
        onClick={() => {
          setOpen(v => {
            const next = !v;
            if (next) {
              requestAnimationFrame(updateMenuPosition);
            }
            return next;
          });
        }}
        title="Open a project"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          maxWidth: isCompact ? undefined : 220,
          padding: isCompact ? '0 12px' : '2px 8px',
          height: 34,
          border: isCompact ? '1px solid transparent' : 'none',
          borderRadius: 6,
          background: open ? '#f0fdfc' : 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 13,
          fontWeight: 600,
          color: isCompact ? '#64748b' : '#0f172a',
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => {
          if (!disabled) {
            e.currentTarget.style.background = '#f1f5f9';
            if (isCompact) e.currentTarget.style.color = '#1e293b';
          }
        }}
        onMouseLeave={e => {
          if (!open && !disabled) {
            e.currentTarget.style.background = 'transparent';
            if (isCompact) e.currentTarget.style.color = '#64748b';
          }
        }}
      >
        {isCompact ? (
          <>
            <PlusIcon />
            <span>Projects</span>
          </>
        ) : (
          <>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {currentProjectName}
            </span>
            <span style={{ color: '#64748b', display: 'flex', flexShrink: 0 }}>
              <ChevronIcon />
            </span>
          </>
        )}
      </button>

      <style>{`
        .project-picker-scroll::-webkit-scrollbar { width: 8px; }
        .project-picker-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .project-picker-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .project-picker-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      {menu && ReactDOM.createPortal(menu, document.body)}
    </div>
  );
};
