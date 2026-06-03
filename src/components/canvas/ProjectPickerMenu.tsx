import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '../../services/api';
import { Vsum } from '../../types';

export interface ProjectPickerItem {
  id: number;
  name: string;
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
  const wrapRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (project: Vsum) => {
    setOpen(false);
    setSearch('');
    onSelectProject({ id: project.id, name: project.name });
  };

  const isCompact = variant === 'compact';

  return (
    <div ref={wrapRef} style={{ position: 'relative', minWidth: 0 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        title="Open a project"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          maxWidth: isCompact ? undefined : 220,
          padding: isCompact ? '0 12px' : '4px 8px',
          height: isCompact ? 40 : undefined,
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

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: isCompact ? 0 : 0,
            minWidth: 300,
            maxWidth: 380,
            maxHeight: 360,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            boxShadow: '0 16px 40px rgba(0,0,0,0.16)',
            zIndex: 600,
          }}
        >
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
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
          <div style={{ overflowY: 'auto', flex: 1, padding: 6 }}>
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

              return (
                <button
                  key={project.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
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
                      background: isActive ? '#049484' : isOpen ? '#94a3b8' : '#e2e8f0',
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
                      {isActive && 'Active tab'}
                      {!isActive && isOpen && 'Open — click to switch'}
                      {!isActive && !isOpen && 'Click to open'}
                      {isCurrentInPill && !isActive && isOpen && ''}
                    </span>
                  </span>
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
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
