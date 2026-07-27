import React, { useState } from 'react';
import { HoverTooltip } from '../ui/HoverTooltip';

interface CanvasSidebarToolbarProps {
  readOnly?: boolean;
  addReactionMode: boolean;
  onToggleReactionMode: () => void;
  onOpenReactionEditor?: () => void;
  onToggleModelDrawer: () => void;
  onDownloadArtifact: () => void;
  onSaveChanges: () => void;
  onCheckBuild: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  downloadingArtifact: boolean;
  savingChanges: boolean;
  checkingBuild: boolean;
}

const sidebarStackStyle: React.CSSProperties = {
  position: 'fixed',
  left: 14,
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 400,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
};

const sidebarCardStyle: React.CSSProperties = {
  position: 'relative',
  left: 'auto',
  top: 'auto',
  zIndex: 'auto',
  background: '#ffffff',
  borderRadius: 8,
  boxShadow: '0 4px 16px rgba(0,0,0,0.13), 0 0 0 1px rgba(0,0,0,0.07)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: 64,
  padding: '6px 0',
  gap: 1,
};

interface SidebarButtonProps {
  label: string;
  description?: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  filled?: boolean;
  disabled?: boolean;
  loading?: boolean;
  color?: string;
}

function getSidebarButtonBackground(
  isFilled: boolean,
  activeColor: string,
  hovered: boolean,
  disabled?: boolean,
): string {
  if (isFilled) return activeColor;
  if (hovered && !disabled) return '#f1f5f9';
  return 'transparent';
}

function getSidebarButtonIconColor(
  disabled: boolean | undefined,
  isFilled: boolean,
  hovered: boolean,
): string {
  if (disabled) return '#c8d3dd';
  if (isFilled) return '#ffffff';
  if (hovered) return '#1e293b';
  return '#475569';
}

const SidebarButton: React.FC<SidebarButtonProps> = ({
  label,
  description,
  onClick,
  children,
  active,
  filled,
  disabled,
  loading,
  color,
}) => {
  const [hovered, setHovered] = useState(false);
  const activeColor = color || '#049484';
  const isFilled = Boolean(filled || active);
  const background = getSidebarButtonBackground(isFilled, activeColor, hovered, disabled);
  const iconColor = getSidebarButtonIconColor(disabled, isFilled, hovered);
  const ariaLabel = description ? `${label}. ${description}` : label;

  return (
    <HoverTooltip label={label} description={description}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={disabled ? undefined : onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 52, height: 52, border: 'none',
          borderRadius: 6, background, color: iconColor,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.12s', flexShrink: 0,
        }}
      >
        <span style={loading ? { animation: 'spin 0.9s linear infinite', display: 'flex' } : undefined}>
          {children}
        </span>
      </button>
    </HoverTooltip>
  );
};

const SidebarDivider = () => (
  <div style={{ width: 44, height: 1, background: '#e2e8f0', margin: '3px 0', flexShrink: 0 }} />
);

const PlusBoxIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="7" x2="12" y2="17" />
    <line x1="7" y1="12" x2="17" y2="12" />
  </svg>
);

const PointerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4l7 18 3-7 7-3z" />
  </svg>
);

const ReactionIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="19" x2="19" y2="5" />
    <polyline points="9 5 19 5 19 15" />
  </svg>
);

const UndoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7h11a5 5 0 0 1 0 10H3" />
    <polyline points="7 3 3 7 7 11" />
  </svg>
);

const RedoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 7H10a5 5 0 0 0 0 10h11" />
    <polyline points="17 3 21 7 17 11" />
  </svg>
);

const CheckBuildIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 12 9 17 20 6" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="15" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="4" y1="20" x2="20" y2="20" />
  </svg>
);

const SaveIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <rect x="8" y="3" width="8" height="6" />
    <rect x="7" y="13" width="10" height="8" />
  </svg>
);

export const CanvasSidebarToolbar: React.FC<CanvasSidebarToolbarProps> = ({
  readOnly = false,
  addReactionMode,
  onToggleReactionMode,
  onOpenReactionEditor,
  onToggleModelDrawer,
  onDownloadArtifact,
  onSaveChanges,
  onCheckBuild,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  downloadingArtifact,
  savingChanges,
  checkingBuild,
}) => {
  const busy = downloadingArtifact || savingChanges || checkingBuild;

  return (
    <div style={sidebarStackStyle}>
      <div style={sidebarCardStyle}>
        <SidebarButton
          label="Select"
          description="Move and select elements on the canvas"
          active={!addReactionMode}
          onClick={() => { if (addReactionMode) onToggleReactionMode(); }}
        >
          <PointerIcon />
        </SidebarButton>

        <SidebarDivider />

        <SidebarButton
          label="Download"
          description="Export this project as a ZIP file"
          onClick={onDownloadArtifact}
          loading={downloadingArtifact}
          disabled={busy}
        >
          <DownloadIcon />
        </SidebarButton>

        {!readOnly && (
          <SidebarButton
            label="Save"
            description="Save changes to this project"
            onClick={onSaveChanges}
            loading={savingChanges}
            disabled={busy}
          >
            <SaveIcon />
          </SidebarButton>
        )}

        {!readOnly && (
          <SidebarButton
            label="Check build"
            description="Verify the project compiles successfully"
            onClick={onCheckBuild}
            loading={checkingBuild}
            disabled={busy}
            color="#049484"
          >
            <CheckBuildIcon />
          </SidebarButton>
        )}

        {!readOnly && <SidebarDivider />}

        {readOnly ? (
          <SidebarButton
            label="View reaction"
            description="Select a connection line, then click to open the code"
            onClick={() => onOpenReactionEditor?.()}
          >
            <ReactionIcon />
          </SidebarButton>
        ) : (
          <>
            <SidebarButton
              label={addReactionMode ? 'Cancel reaction' : 'Add reaction'}
              description={addReactionMode
                ? 'Click to exit connection mode'
                : 'Click two meta-models to connect them'}
              active={addReactionMode}
              onClick={onToggleReactionMode}
            >
              <ReactionIcon />
            </SidebarButton>

            <SidebarButton
              label="Add meta-models"
              description="Open the model library drawer"
              onClick={onToggleModelDrawer}
              filled
            >
              <PlusBoxIcon />
            </SidebarButton>
          </>
        )}
      </div>

      {!readOnly && (
        <div style={sidebarCardStyle}>
          <SidebarButton
            label="Undo"
            description={canUndo ? 'Undo the last action' : 'Nothing to undo'}
            onClick={onUndo}
            disabled={!canUndo}
          >
            <UndoIcon />
          </SidebarButton>
          <SidebarButton
            label="Redo"
            description={canRedo ? 'Redo the last undone action' : 'Nothing to redo'}
            onClick={onRedo}
            disabled={!canRedo}
          >
            <RedoIcon />
          </SidebarButton>
        </div>
      )}
    </div>
  );
};
