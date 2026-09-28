import React, { useState } from 'react';
import { ProjectPickerMenu } from './ProjectPickerMenu';

interface CanvasProjectControlsProps {
  readOnly?: boolean;
  sharedByLabel?: string;
  projectName: string;
  projectId?: number;
  openProjectIds: number[];
  editingName: boolean;
  nameInput: string;
  savingName: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onSelectProject: (projectId: number, name: string, accessRole?: string) => void;
  onStartRename: () => void;
  onNameInputChange: (value: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  loading: boolean;
  addReactionMode?: boolean;
  onToggleReactionMode?: () => void;
  reactionLineStyle?: 'dashed' | 'solid';
  onReactionLineStyleChange?: (style: 'dashed' | 'solid') => void;
}

const projectControlsStyle: React.CSSProperties = {
  position: 'absolute',
  top: 14,
  left: 14,
  borderRadius: 8,
  zIndex: 400,
  background: 'var(--v-chrome-bg)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.13), 0 0 0 1px rgba(0,0,0,0.07)',
  display: 'flex',
  alignItems: 'center',
  height: 44,
  padding: '0 6px',
  gap: 2,
};

const ProjectControlsDivider = () => (
  <div style={{ width: 1, height: 22, background: 'var(--v-chrome-divider)', margin: '0 5px', flexShrink: 0 }} />
);

interface ProjectControlButtonProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
  spinning?: boolean;
}

function getProjectControlButtonBackground(
  active: boolean | undefined,
  hovered: boolean,
): string {
  if (active) return '#049484';
  if (hovered) return 'var(--v-chrome-hover)';
  return 'transparent';
}

function getProjectControlButtonColor(
  active: boolean | undefined,
  hovered: boolean,
): string {
  if (active) return '#ffffff';
  if (hovered) return 'var(--v-chrome-icon-hover)';
  return 'var(--v-chrome-icon)';
}

const ProjectControlButton: React.FC<ProjectControlButtonProps> = ({
  onClick,
  title,
  children,
  active,
  spinning,
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', width: 34, height: 34, border: 'none', borderRadius: 6,
        background: getProjectControlButtonBackground(active, hovered),
        color: getProjectControlButtonColor(active, hovered),
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s', flexShrink: 0,
      }}
    >
      <span style={spinning ? { animation: 'spin 0.9s linear infinite', display: 'flex' } : undefined}>
        {children}
      </span>
    </button>
  );
};

const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const PencilIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const CanvasProjectControls: React.FC<CanvasProjectControlsProps> = ({
  readOnly = false,
  sharedByLabel,
  projectName,
  projectId,
  openProjectIds,
  editingName,
  nameInput,
  savingName,
  onBack,
  onRefresh,
  onSelectProject,
  onStartRename,
  onNameInputChange,
  onConfirmRename,
  onCancelRename,
  loading,
  addReactionMode = false,
  onToggleReactionMode,
  reactionLineStyle = 'dashed',
  onReactionLineStyleChange,
}) => (
  <div style={projectControlsStyle}>
    <button
      type="button"
      onClick={onBack}
      title="Back to overview"
      aria-label="Back to overview"
      style={{
        padding: 0,
        border: 'none',
        background: 'transparent',
        width: 24,
        height: 24,
        borderRadius: 6,
        flexShrink: 0,
        margin: '0 4px',
        cursor: 'pointer',
        transition: 'opacity 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={event => { event.currentTarget.style.opacity = '0.75'; }}
      onMouseLeave={event => { event.currentTarget.style.opacity = '1'; }}
    >
      <img
        src="/assets/vitruvius1.png"
        alt=""
        aria-hidden="true"
        style={{ width: 24, height: 24, borderRadius: 6, display: 'block' }}
      />
    </button>

    <ProjectControlsDivider />

    {editingName ? (
      <>
        <input
          autoFocus
          value={nameInput}
          onChange={event => onNameInputChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              onConfirmRename();
            } else if (event.key === 'Escape') {
              onCancelRename();
            }
          }}
          disabled={savingName}
          style={{
            fontSize: 13, fontWeight: 600, color: 'var(--v-text)',
            border: '1.5px solid #93c5fd', borderRadius: 6,
            padding: '2px 8px', outline: 'none', width: 170,
            background: 'var(--v-input-bg)',
          }}
        />
        <ProjectControlButton onClick={onConfirmRename} title="Save" active spinning={savingName}>
          <CheckIcon />
        </ProjectControlButton>
        <ProjectControlButton onClick={onCancelRename} title="Cancel">
          <XIcon />
        </ProjectControlButton>
      </>
    ) : (
      <>
        <ProjectPickerMenu
          currentProjectId={projectId}
          activeProjectId={projectId}
          openProjectIds={openProjectIds}
          currentProjectName={projectName}
          disabled={loading}
          onSelectProject={project => onSelectProject(project.id, project.name, project.role)}
        />
        {!readOnly && (
          <ProjectControlButton onClick={onStartRename} title="Edit project name">
            <PencilIcon />
          </ProjectControlButton>
        )}
        {readOnly && (
          <span
            title={sharedByLabel
              ? `View-only access — shared by ${sharedByLabel}`
              : 'You have view-only access to this project'}
            style={{
              marginLeft: 4,
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 700,
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              whiteSpace: 'nowrap',
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {sharedByLabel ? `Shared by ${sharedByLabel}` : 'View only'}
          </span>
        )}
      </>
    )}

    <ProjectControlsDivider />

    <ProjectControlButton
      onClick={onRefresh}
      title={readOnly ? 'Reload latest changes from owner' : 'Reload'}
      spinning={loading && !editingName}
    >
      <RefreshIcon />
    </ProjectControlButton>

    {onToggleReactionMode && (
      <>
        <ProjectControlsDivider />
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 4px' }}>
          <button
            type="button"
            onClick={() => { if (addReactionMode) onToggleReactionMode(); }}
            style={{
              height: 24,
              padding: '0 8px',
              border: 'none',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              background: !addReactionMode ? '#e3f2fd' : 'transparent',
              color: !addReactionMode ? '#1565c0' : '#999',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
          >
            VSUM
          </button>
          <button
            type="button"
            onClick={() => { if (!addReactionMode) onToggleReactionMode(); }}
            style={{
              height: 24,
              padding: '0 8px',
              border: 'none',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              background: addReactionMode ? '#e8f5e9' : 'transparent',
              color: addReactionMode ? '#2e7d32' : '#999',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
          >
            Reactions
          </button>
        </div>
        {addReactionMode && onReactionLineStyleChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 4px' }}>
            <button
              type="button"
              aria-pressed={reactionLineStyle === 'dashed'}
              onClick={() => onReactionLineStyleChange('dashed')}
              style={{
                height: 24,
                padding: '0 8px',
                border: 'none',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                background: reactionLineStyle === 'dashed' ? '#e8f5e9' : 'transparent',
                color: reactionLineStyle === 'dashed' ? '#2e7d32' : '#999',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
            >
              Dashed
            </button>
            <button
              type="button"
              aria-pressed={reactionLineStyle === 'solid'}
              onClick={() => onReactionLineStyleChange('solid')}
              style={{
                height: 24,
                padding: '0 8px',
                border: 'none',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                background: reactionLineStyle === 'solid' ? '#e8f5e9' : 'transparent',
                color: reactionLineStyle === 'solid' ? '#2e7d32' : '#999',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
            >
              Solid
            </button>
          </div>
        )}
      </>
    )}
  </div>
);
