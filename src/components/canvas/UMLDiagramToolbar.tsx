import { useState, type CSSProperties, type ReactNode } from 'react';
import { DIAGRAM_TOOLBAR_TOP, UML } from './umlDiagramTheme';

export interface UMLDiagramToolbarProps {
  reactionsMode: 'uml' | 'reactions';
  connectMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canDelete: boolean;
  showSave: boolean;
  hasUnsavedChanges: boolean;
  saving: boolean;
  saveButtonTitle: string;
  onAddClass: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleConnect: () => void;
  onDelete: () => void;
  onSave: () => void;
}

function getDiagramToolButtonBackground(
  disabled: boolean,
  active: boolean,
  accent: boolean,
  hovered: boolean,
): string {
  if (disabled) return UML.surfaceMuted;
  if (active) return UML.primarySoft;
  if (accent && hovered) return UML.primarySoft;
  if (hovered) return '#f0fdfa';
  return UML.surface;
}

function getDiagramToolButtonColor(
  disabled: boolean,
  active: boolean,
  accent: boolean,
  hovered: boolean,
): string {
  if (disabled) return '#cbd5e1';
  if (active || accent) return UML.primary;
  if (hovered) return UML.ink;
  return UML.textMuted;
}

function getDiagramToolButtonBoxShadow(
  active: boolean,
  hovered: boolean,
  disabled: boolean,
): string {
  if (active || (hovered && !disabled)) return `0 0 0 2px ${UML.primaryRing}`;
  return 'none';
}

function getDiagramToolButtonStyle(params: {
  label?: string;
  active: boolean;
  disabled: boolean;
  accent: boolean;
  hovered: boolean;
}): CSSProperties {
  const hasLabel = Boolean(params.label);
  const background = getDiagramToolButtonBackground(
    params.disabled,
    params.active,
    params.accent,
    params.hovered,
  );
  const color = getDiagramToolButtonColor(
    params.disabled,
    params.active,
    params.accent,
    params.hovered,
  );
  const boxShadow = getDiagramToolButtonBoxShadow(
    params.active,
    params.hovered,
    params.disabled,
  );

  return {
    height: 34,
    minWidth: hasLabel ? 76 : 34,
    padding: hasLabel ? '0 10px' : 0,
    border: `1px solid ${params.active ? UML.primary : UML.border}`,
    borderRadius: 8,
    background,
    color,
    boxShadow,
    cursor: params.disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: UML.fontSans,
    transition: 'all 0.12s',
  };
}

interface DiagramToolButtonProps {
  title: string;
  label?: string;
  active?: boolean;
  disabled?: boolean;
  accent?: boolean;
  onClick: () => void;
  children: ReactNode;
}

const DiagramToolButton = ({
  title,
  label,
  active = false,
  disabled = false,
  accent = false,
  onClick,
  children,
}: DiagramToolButtonProps) => {
  const [hovered, setHovered] = useState(false);
  const buttonStyle = getDiagramToolButtonStyle({
    label,
    active,
    disabled,
    accent,
    hovered,
  });

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={buttonStyle}
    >
      {children}
      {label && <span>{label}</span>}
    </button>
  );
};

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconUndo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7h11a5 5 0 0 1 0 10H3" />
    <polyline points="7 3 3 7 7 11" />
  </svg>
);

const IconRedo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 7H10a5 5 0 0 0 0 10h11" />
    <polyline points="17 3 21 7 17 11" />
  </svg>
);

const IconConnect = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 17H7A5 5 0 0 1 7 7h2" />
    <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);

const IconSave = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
  </svg>
);

export const UMLDiagramToolbar = ({
  reactionsMode,
  connectMode,
  canUndo,
  canRedo,
  canDelete,
  showSave,
  hasUnsavedChanges,
  saving,
  saveButtonTitle,
  onAddClass,
  onUndo,
  onRedo,
  onToggleConnect,
  onDelete,
  onSave,
}: UMLDiagramToolbarProps) => (
  <div
    data-uml-toolbar
    style={{
      position: 'absolute',
      top: DIAGRAM_TOOLBAR_TOP,
      right: 12,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      zIndex: 30,
      padding: '5px 8px',
      borderRadius: 10,
      background: UML.surface,
      border: `1px solid ${UML.primaryBorder}`,
      boxShadow: `0 4px 14px ${UML.primaryRing}, 0 0 0 1px rgba(4,148,132,0.05)`,
    }}
  >
    <DiagramToolButton title="Add class" active={false} onClick={onAddClass} label="Class">
      <IconPlus />
    </DiagramToolButton>
    <DiagramToolButton
      title="Undo (Ctrl+Z)"
      active={false}
      disabled={!canUndo}
      onClick={onUndo}
      label="Undo"
    >
      <IconUndo />
    </DiagramToolButton>
    <DiagramToolButton
      title="Redo (Ctrl+Shift+Z)"
      active={false}
      disabled={!canRedo}
      onClick={onRedo}
      label="Redo"
    >
      <IconRedo />
    </DiagramToolButton>
    {reactionsMode !== 'reactions' && (
      <DiagramToolButton
        title={connectMode ? 'Cancel connect mode (Esc)' : 'Connect two classes in the same model'}
        active={connectMode}
        onClick={onToggleConnect}
        label="Connect"
      >
        <IconConnect />
      </DiagramToolButton>
    )}
    <DiagramToolButton
      title="Delete selected class or connection"
      active={false}
      disabled={!canDelete}
      onClick={onDelete}
      label="Delete"
    >
      <IconTrash />
    </DiagramToolButton>
    {showSave && (
      <DiagramToolButton
        title={saveButtonTitle}
        active={hasUnsavedChanges}
        disabled={!hasUnsavedChanges || saving}
        onClick={onSave}
        label="Save"
        accent
      >
        {saving ? '…' : <IconSave />}
      </DiagramToolButton>
    )}
  </div>
);
