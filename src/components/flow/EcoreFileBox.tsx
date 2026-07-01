import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NodeProps } from 'reactflow';
import { apiService } from '../../services/api';
import { downloadTextAsFile } from '../../utils/downloadFile';
import { ConnectionHandle } from './ConnectionHandle';
import { HandlePosition } from './connectionHandleLayout';

// ── types ─────────────────────────────────────────────────────────────────────

interface EcoreFileBoxData {
  fileName: string;
  fileContent: string;
  onExpand: (fileName: string, fileContent: string) => void;
  onSelect: (fileName: string) => void;
  onDelete?: (id: string) => void;
  onRequestDelete?: (id: string) => void;
  onRename?: (id: string, newFileName: string) => void;
  onShowDetails?: (modelObj: any, fileContent: string) => void;
  metaModelId?: number;
  ecoreFileId?: number;
  genModelFileId?: number;
  onConnectionStart?: (nodeId: string, handle: HandlePosition, tipScreenPos: { x: number; y: number }) => void;
  isExpanded?: boolean;
  isConnectionActive?: boolean;
  isReactionSource?: boolean;
  isConstraintContext?: boolean;
  isConstraintFilter?: boolean;
  readOnly?: boolean;
  description?: string;
  keywords?: string;
  domain?: string;
  createdAt?: string;
}



// ── domain → card color ───────────────────────────────────────────────────────

const CARD_COLORS: Record<string, string> = {
  default:  '#bfdbfe',
  computer: '#93c5fd',
  target:   '#86efac',
  modell:   '#d8b4fe',
  model:    '#d8b4fe',
  pcm:      '#fca5a5',
  source:   '#fca5a5',
};

const FALLBACK_PALETTE = ['#fca5a5', '#fde68a', '#6ee7b7', '#a5b4fc', '#f9a8d4', '#67e8f9', '#fb923c', '#c4b5fd'];

export function cardColor(domain?: string): string {
  const key = domain?.toLowerCase().trim() || 'default';
  if (CARD_COLORS[key]) return CARD_COLORS[key];
  let h = 0;
  for (const char of key) h = (char.codePointAt(0) ?? 0) + ((h << 5) - h);
  return FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length];
}

export function darken(hex: string, amount = 30): string {
  try {
    const r = Math.max(0, Number.parseInt(hex.slice(1, 3), 16) - amount);
    const g = Math.max(0, Number.parseInt(hex.slice(3, 5), 16) - amount);
    const b = Math.max(0, Number.parseInt(hex.slice(5, 7), 16) - amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch { return hex; }
}

// ── helpers ───────────────────────────────────────────────────────────────────

const removeExt = (name: string) => name.replace(/\.ecore$/i, '');

/** Screen position of a connection-handle tip (matches ConnectionHandle). */
export function handleTipFromRect(
  rect: DOMRect,
  handle: HandlePosition,
): { x: number; y: number } {
  switch (handle) {
    case 'top':
      return { x: rect.left + rect.width / 2, y: rect.top };
    case 'bottom':
      return { x: rect.left + rect.width / 2, y: rect.bottom };
    case 'left':
      return { x: rect.left, y: rect.top + rect.height / 2 };
    case 'right':
      return { x: rect.right, y: rect.top + rect.height / 2 };
  }
}

// ── card visual helpers ───────────────────────────────────────────────────────

function resolveCardBorder(bg: string, isReactionSource: boolean, isConstraintContext: boolean, isConstraintFilter: boolean, selected: boolean, isHovered: boolean, borderColor: string): string {
  if (isReactionSource)    return '#1e293b';
  if (isConstraintFilter)  return '#049484';
  if (isConstraintContext) return '#049484';
  if (selected)            return darken(bg, 45);
  if (isHovered)           return darken(bg, 35);
  return borderColor;
}

function resolveCardShadow(bg: string, isReactionSource: boolean, isConstraintContext: boolean, isConstraintFilter: boolean, selected: boolean, isHovered: boolean): string {
  if (isReactionSource)    return '0 0 0 4px #1e293b33, 0 8px 24px rgba(0,0,0,0.15)';
  if (isConstraintFilter)  return '0 0 0 3px #04948488, 0 8px 28px rgba(4,148,132,0.28)';
  if (isConstraintContext) return '0 0 0 3px #04948455, 0 8px 24px rgba(4,148,132,0.18)';
  if (selected)            return `0 0 0 3px ${darken(bg, 45)}55, 0 8px 24px rgba(0,0,0,0.15)`;
  if (isHovered)           return '0 8px 24px rgba(0,0,0,0.12)';
  return '0 3px 10px rgba(0,0,0,0.08)';
}


type ShowDetailsModelContext = {
  keywords?: string;
  metaModelId?: number;
  fileName: string;
  description?: string;
  domain?: string;
  createdAt?: string;
  fileContent: string;
};

function buildShowDetailsHandler(
  onShowDetails: ((modelObj: any, fileContent: string) => void) | undefined,
  setShowMenu: (v: boolean) => void,
  context: ShowDetailsModelContext,
): (() => void) | undefined {
  if (!onShowDetails) return undefined;
  return () => {
    setShowMenu(false);
    const kwArray = context.keywords
      ? context.keywords.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)
      : [];
    onShowDetails({
      id: context.metaModelId,
      name: removeExt(context.fileName),
      description: context.description || '',
      domain: context.domain || '',
      keyword: kwArray,
      createdAt: context.createdAt,
    }, context.fileContent);
  };
}

// ── EcoreFileBox ──────────────────────────────────────────────────────────────

export const EcoreFileBox: React.FC<NodeProps<EcoreFileBoxData>> = ({
  id, data, selected = false, dragging = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [downloadingFile, setDownloadingFile] = useState<'ecore' | 'genmodel' | null>(null);

  const {
    fileName, fileContent, onExpand, onSelect, onRequestDelete, onRename,
    onConnectionStart, isConnectionActive = false,
    description, keywords, createdAt, domain, onShowDetails, metaModelId,
    ecoreFileId, genModelFileId,
    isReactionSource = false,
    isConstraintContext = false,
    isConstraintFilter = false,
    readOnly = false,
  } = data;

  const boxRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on any left-click outside
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as HTMLElement) &&
        boxRef.current && !boxRef.current.contains(e.target as HTMLElement)
      ) {
        setShowMenu(false);
      }
    };
    globalThis.addEventListener('mousedown', handler, true);
    return () => globalThis.removeEventListener('mousedown', handler, true);
  }, [showMenu]);

  // Close context menu when this box is dragged
  useEffect(() => {
    if (dragging && showMenu) setShowMenu(false);
  }, [dragging, showMenu]);

  const startConnectionFromHandle = (handle: HandlePosition) => {
    if (!boxRef.current || !onConnectionStart) return;
    const tip = handleTipFromRect(boxRef.current.getBoundingClientRect(), handle);
    onConnectionStart(id, handle, tip);
  };

  const bg          = cardColor(domain);
  const borderColor = darken(bg, 25);
  const cardBorder  = resolveCardBorder(bg, isReactionSource, isConstraintContext, isConstraintFilter, selected, isHovered, borderColor);
  const cardShadow  = resolveCardShadow(bg, isReactionSource, isConstraintContext, isConstraintFilter, selected, isHovered);
  let cardTransform = 'scale(1)';
  if (selected) cardTransform = 'scale(1.04)';
  else if (isHovered) cardTransform = 'scale(1.02)';
  const handleShowDetails = buildShowDetailsHandler(
    onShowDetails, setShowMenu, { keywords, metaModelId, fileName, description, domain, createdAt, fileContent },
  );

  const handleClick = (e: React.MouseEvent) => { e.stopPropagation(); onSelect(fileName); };
  const openUml = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    onExpand(fileName, fileContent);
  };
  const handleDoubleClick = (e: React.MouseEvent) => { e.stopPropagation(); openUml(); };
  const openContextMenu = () => {
    if (boxRef.current) {
      const rect = boxRef.current.getBoundingClientRect();
      setMenuPos({ x: rect.right + 8, y: rect.top + rect.height / 2 });
    }
    setShowMenu(v => !v);
  };
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu();
  };
  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      openUml();
    } else if (e.key === ' ') {
      e.preventDefault();
      onSelect(fileName);
    } else if (e.key === 'F10' && e.shiftKey) {
      e.preventDefault();
      openContextMenu();
    }
  };

  const startRename = () => {
    if (readOnly) return;
    setRenameVal(removeExt(fileName));
    setRenaming(true);
  };
  const saveRename = () => {
    const trimmed = renameVal.trim();
    if (trimmed) onRename?.(id, trimmed + '.ecore');
    setRenaming(false);
  };
  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveRename();
      return;
    }
    if (e.key === 'Escape') {
      setRenaming(false);
    }
  };

  const baseName = removeExt(fileName);
  const cardAriaLabel = `${baseName} metamodel. Enter to open, Space to select, Shift+F10 for menu.`;

  const downloadMetaModelFile = async (
    kind: 'ecore' | 'genmodel',
    fileId: number | undefined,
    extension: '.ecore' | '.genmodel',
  ) => {
    if (!fileId) return;
    setDownloadingFile(kind);
    try {
      const content = await apiService.getFile(fileId);
      downloadTextAsFile(content, `${baseName}${extension}`);
    } catch (err) {
      console.error(`Failed to download ${extension}:`, err);
    } finally {
      setDownloadingFile(null);
      setShowMenu(false);
    }
  };

  const connectionHandles = (['top', 'bottom', 'left', 'right'] as const).map(pos => (
    <ConnectionHandle
      key={pos}
      position={pos}
      isVisible={!readOnly && (selected || isConnectionActive)}
      onConnectionStart={readOnly ? undefined : (p, tip) => onConnectionStart?.(id, p, tip)}
      offsetIndex={0}
      totalHandles={1}
    />
  ));

  return (
    <>
      <div
        ref={boxRef}
        style={{ position: 'relative', display: 'inline-block' }}
      >
        {/* ── Card ── */}
        <div
          role="button"
          tabIndex={0}
          aria-label={cardAriaLabel}
          aria-pressed={selected}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          onKeyDown={handleCardKeyDown}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            width: 118,
            height: 126,
            borderRadius: 16,
            background: bg,
            border: `2px solid ${cardBorder}`,
            boxShadow: cardShadow,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'all 0.15s',
            transform: cardTransform,
            position: 'relative',
          }}
        >
          {connectionHandles}

          {/* 3D box icon */}
          <CardIcon />

          {/* Model name */}
          {renaming ? (
            <input
              autoFocus
              value={renameVal}
              onChange={e => setRenameVal(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={saveRename}
              onClick={e => e.stopPropagation()}
              style={{
                width: 110, textAlign: 'center', fontSize: 12, fontWeight: 700,
                border: '1.5px solid rgba(0,0,0,0.3)', borderRadius: 6,
                background: 'rgba(255,255,255,0.7)', padding: '2px 6px', outline: 'none',
              }}
            />
          ) : (
            <span style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'rgba(0,0,0,0.72)',
              textAlign: 'center',
              padding: '0 10px',
              wordBreak: 'break-word',
              lineHeight: 1.3,
              maxWidth: '100%',
            }}>
              {removeExt(fileName)}
            </span>
          )}

          {readOnly && (
            <button
              type="button"
              title="Open UML diagram"
              onClick={openUml}
              style={{
                position: 'absolute',
                bottom: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '3px 8px',
                borderRadius: 8,
                border: '1px solid rgba(0,0,0,0.15)',
                background: 'rgba(255,255,255,0.85)',
                color: 'rgba(0,0,0,0.75)',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              Open UML
            </button>
          )}
        </div>

      </div>

      {/* ── Context menu portal (always on top of everything) ── */}
      {showMenu && !renaming && createPortal(
        <ContextMenu
          menuRef={menuRef}
          pos={menuPos}
          fileName={fileName}
          onClose={() => setShowMenu(false)}
          downloadingFile={downloadingFile}
          canDownloadEcore={!!ecoreFileId}
          canDownloadGenModel={!!genModelFileId}
          onDownloadEcore={() => downloadMetaModelFile('ecore', ecoreFileId, '.ecore')}
          onDownloadGenModel={() => downloadMetaModelFile('genmodel', genModelFileId, '.genmodel')}
          onOpenUML={() => { setShowMenu(false); openUml(); }}
          onConnect={() => {
            setShowMenu(false);
            startConnectionFromHandle('right');
          }}
          onRename={() => { setShowMenu(false); startRename(); }}
          onDelete={() => { setShowMenu(false); onRequestDelete?.(id); }}
          onShowDetails={handleShowDetails}
          readOnly={readOnly}
        />,
        document.body,
      )}

      {/* ── Dialogs (legacy simple modals kept for fallback) ── */}
    </>
  );
};

// ── ContextMenu ───────────────────────────────────────────────────────────────

interface ContextMenuProps {
  menuRef: React.RefObject<HTMLDivElement | null>;
  pos: { x: number; y: number };
  fileName: string;
  onClose: () => void;
  canDownloadEcore: boolean;
  canDownloadGenModel: boolean;
  downloadingFile: 'ecore' | 'genmodel' | null;
  onDownloadEcore: () => void;
  onDownloadGenModel: () => void;
  onOpenUML: () => void;
  onConnect: () => void;
  onRename: () => void;
  onDelete: () => void;
  onShowDetails?: () => void;
  readOnly?: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  menuRef, pos, fileName, onClose,
  canDownloadEcore, canDownloadGenModel, downloadingFile,
  onDownloadEcore, onDownloadGenModel,
  onOpenUML, onConnect, onRename, onDelete, onShowDetails,
  readOnly = false,
}) => {
  useEffect(() => {
    menuRef.current?.focus();
  }, [menuRef]);

  const stopMenuEventBubble = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') onClose();
  };

  return (
  <div
    ref={menuRef}
    role="menu"
    aria-label={`Actions for ${removeExt(fileName)}`}
    tabIndex={0}
    style={{
      position: 'fixed',
      left: pos.x,
      top: pos.y,
      transform: 'translateY(-50%)',
      background: '#ffffff',
      borderRadius: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.07)',
      padding: 5,
      minWidth: 178,
      zIndex: 99999,
    }}
    onMouseDown={stopMenuEventBubble}
    onClick={stopMenuEventBubble}
    onKeyDown={handleMenuKeyDown}
    onKeyUp={stopMenuEventBubble}
  >
    {/* Header */}
    <div style={{ padding: '5px 9px 7px', borderBottom: '1px solid #f1f5f9', marginBottom: 3 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{removeExt(fileName)}</span>
    </div>

    <CMItem icon={<UMLIcon />}     label="Open UML"        onClick={onOpenUML} />
    {!readOnly && <CMItem icon={<ConnectIcon />} label="Add connection"  onClick={onConnect} />}
    {!readOnly && <CMItem icon={<EditIcon />}    label="Rename"          onClick={onRename} />}
    {onShowDetails && <CMItem icon={<InfoIcon />} label="Details" onClick={onShowDetails} />}

    <div style={{ height: 1, background: '#f1f5f9', margin: '4px 2px' }} />
    <CMItem
      icon={<DownloadIcon />}
      label={downloadingFile === 'ecore' ? 'Downloading…' : 'Download .ecore'}
      onClick={onDownloadEcore}
      disabled={!canDownloadEcore || downloadingFile !== null}
    />
    <CMItem
      icon={<DownloadIcon />}
      label={downloadingFile === 'genmodel' ? 'Downloading…' : 'Download .genmodel'}
      onClick={onDownloadGenModel}
      disabled={!canDownloadGenModel || downloadingFile !== null}
    />

    {!readOnly && (
      <>
        <div style={{ height: 1, background: '#f1f5f9', margin: '4px 2px' }} />
        <CMItem icon={<TrashIcon />}   label="Remove"          onClick={onDelete} danger />
      </>
    )}
  </div>
  );
};

function getCMItemBackground(hovered: boolean, disabled: boolean | undefined, danger: boolean | undefined): string {
  if (!hovered || disabled) return 'transparent';
  if (danger) return '#fef2f2';
  return '#f8fafc';
}

function getCMItemColor(disabled: boolean | undefined, danger: boolean | undefined, hovered: boolean): string {
  if (disabled) return '#cbd5e1';
  if (danger) {
    if (hovered) return '#dc2626';
    return '#ef4444';
  }
  return '#475569';
}

const CMItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}> = ({ icon, label, onClick, danger, disabled }) => {
  const [hov, setHov] = useState(false);
  const background = getCMItemBackground(hov, disabled, danger);
  const color = getCMItemColor(disabled, danger, hov);

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={e => { e.stopPropagation(); if (!disabled) onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '6px 9px', border: 'none', borderRadius: 7,
        background,
        color,
        cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, textAlign: 'left', transition: 'all 0.1s',
      }}
    >
      {icon}
      {label}
    </button>
  );
};

// ── card icon ─────────────────────────────────────────────────────────────────

const CardIcon = () => (
  <svg width="46" height="46" viewBox="0 0 32 32" fill="none">
    <path d="M16 5L27 11V21L16 27L5 21V11L16 5Z"
      stroke="rgba(0,0,0,0.38)" strokeWidth="1.4" fill="rgba(255,255,255,0.55)" strokeLinejoin="round" />
    <path d="M16 5V27" stroke="rgba(0,0,0,0.28)" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M5 11L27 11" stroke="rgba(0,0,0,0.28)" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M16 5L5 11L16 17L27 11L16 5Z"
      stroke="rgba(0,0,0,0.3)" strokeWidth="1.2" fill="rgba(255,255,255,0.35)" strokeLinejoin="round" />
  </svg>
);

// ── small icons ───────────────────────────────────────────────────────────────

const UMLIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
  </svg>
);
const ConnectIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);
const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" />
  </svg>
);
const InfoIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);
const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
