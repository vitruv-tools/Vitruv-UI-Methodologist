import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NodeProps } from 'reactflow';
import { apiService } from '../../services/api';
import { downloadTextAsFile } from '../../utils/downloadFile';
import { ConnectionHandle } from './ConnectionHandle';

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
  onConnectionStart?: (nodeId: string, handle: 'top' | 'bottom' | 'left' | 'right', tipScreenPos: { x: number; y: number }) => void;
  isExpanded?: boolean;
  isConnectionActive?: boolean;
  isReactionSource?: boolean;
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
  for (let i = 0; i < key.length; i++) h = key.charCodeAt(i) + ((h << 5) - h);
  return FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length];
}

export function darken(hex: string, amount = 30): string {
  try {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch { return hex; }
}

// ── helpers ───────────────────────────────────────────────────────────────────

const removeExt = (name: string) => name.replace(/\.ecore$/i, '');

/** Screen position of a connection-handle tip (matches ConnectionHandle). */
export function handleTipFromRect(
  rect: DOMRect,
  handle: 'top' | 'bottom' | 'left' | 'right',
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

function resolveCardBorder(bg: string, isReactionSource: boolean, selected: boolean, isHovered: boolean, borderColor: string): string {
  if (isReactionSource) return '#1e293b';
  if (selected)         return darken(bg, 45);
  if (isHovered)        return darken(bg, 35);
  return borderColor;
}

function resolveCardShadow(bg: string, isReactionSource: boolean, selected: boolean, isHovered: boolean): string {
  if (isReactionSource) return '0 0 0 4px #1e293b33, 0 8px 24px rgba(0,0,0,0.15)';
  if (selected)         return `0 0 0 3px ${darken(bg, 45)}55, 0 8px 24px rgba(0,0,0,0.15)`;
  if (isHovered)        return '0 8px 24px rgba(0,0,0,0.12)';
  return '0 3px 10px rgba(0,0,0,0.08)';
}

function buildShowDetailsHandler(
  onShowDetails: ((modelObj: any, fileContent: string) => void) | undefined,
  setShowMenu: (v: boolean) => void,
  keywords: string | undefined,
  metaModelId: number | undefined,
  fileName: string,
  description: string | undefined,
  domain: string | undefined,
  createdAt: string | undefined,
  fileContent: string,
): (() => void) | undefined {
  if (!onShowDetails) return undefined;
  return () => {
    setShowMenu(false);
    const kwArray = keywords ? keywords.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean) : [];
    onShowDetails({ id: metaModelId, name: removeExt(fileName), description: description || '', domain: domain || '', keyword: kwArray, createdAt }, fileContent);
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
    window.addEventListener('mousedown', handler, true);
    return () => window.removeEventListener('mousedown', handler, true);
  }, [showMenu]);

  // Close context menu when this box is dragged
  useEffect(() => {
    if (dragging && showMenu) setShowMenu(false);
  }, [dragging, showMenu]);

  const startConnectionFromHandle = (handle: 'top' | 'bottom' | 'left' | 'right') => {
    if (!boxRef.current || !onConnectionStart) return;
    const tip = handleTipFromRect(boxRef.current.getBoundingClientRect(), handle);
    onConnectionStart(id, handle, tip);
  };

  const bg          = cardColor(domain);
  const borderColor = darken(bg, 25);
  const cardBorder  = resolveCardBorder(bg, isReactionSource, selected, isHovered, borderColor);
  const cardShadow  = resolveCardShadow(bg, isReactionSource, selected, isHovered);
  const cardTransform = selected ? 'scale(1.04)' : isHovered ? 'scale(1.02)' : 'scale(1)';
  const handleShowDetails = buildShowDetailsHandler(
    onShowDetails, setShowMenu, keywords, metaModelId, fileName, description, domain, createdAt, fileContent,
  );

  const handleClick = (e: React.MouseEvent) => { e.stopPropagation(); onSelect(fileName); };
  const handleDoubleClick = (e: React.MouseEvent) => { e.stopPropagation(); onExpand(fileName, fileContent); };
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (boxRef.current) {
      const rect = boxRef.current.getBoundingClientRect();
      setMenuPos({ x: rect.right + 8, y: rect.top + rect.height / 2 });
    }
    setShowMenu(v => !v);
  };

  const startRename = () => {
    setRenameVal(removeExt(fileName));
    setRenaming(true);
  };
  const saveRename = () => {
    const trimmed = renameVal.trim();
    if (trimmed) onRename?.(id, trimmed + '.ecore');
    setRenaming(false);
  };

  const baseName = removeExt(fileName);

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
      isVisible={selected || isConnectionActive}
      onConnectionStart={(p, tip) => onConnectionStart?.(id, p, tip)}
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
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          title="Double-click to open · Right-click for menu"
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
              onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setRenaming(false); }}
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
        </div>

      </div>

      {/* ── Context menu portal (always on top of everything) ── */}
      {showMenu && !renaming && createPortal(
        <ContextMenu
          menuRef={menuRef}
          pos={menuPos}
          fileName={fileName}
          downloadingFile={downloadingFile}
          canDownloadEcore={!!ecoreFileId}
          canDownloadGenModel={!!genModelFileId}
          onDownloadEcore={() => downloadMetaModelFile('ecore', ecoreFileId, '.ecore')}
          onDownloadGenModel={() => downloadMetaModelFile('genmodel', genModelFileId, '.genmodel')}
          onOpenUML={() => { setShowMenu(false); onExpand(fileName, fileContent); }}
          onConnect={() => {
            setShowMenu(false);
            startConnectionFromHandle('right');
          }}
          onRename={() => { setShowMenu(false); startRename(); }}
          onDelete={() => { setShowMenu(false); onRequestDelete?.(id); }}
          onShowDetails={handleShowDetails}
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
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  menuRef, pos, fileName,
  canDownloadEcore, canDownloadGenModel, downloadingFile,
  onDownloadEcore, onDownloadGenModel,
  onOpenUML, onConnect, onRename, onDelete, onShowDetails,
}) => (
  <div
    ref={menuRef}
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
    onMouseDown={e => e.stopPropagation()}
    onClick={e => e.stopPropagation()}
  >
    {/* Header */}
    <div style={{ padding: '5px 9px 7px', borderBottom: '1px solid #f1f5f9', marginBottom: 3 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{removeExt(fileName)}</span>
    </div>

    <CMItem icon={<UMLIcon />}     label="Open UML"        onClick={onOpenUML} />
    <CMItem icon={<ConnectIcon />} label="Add connection"  onClick={onConnect} />
    <CMItem icon={<EditIcon />}    label="Rename"          onClick={onRename} />
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

    <div style={{ height: 1, background: '#f1f5f9', margin: '4px 2px' }} />
    <CMItem icon={<TrashIcon />}   label="Remove"          onClick={onDelete} danger />
  </div>
);

const CMItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}> = ({ icon, label, onClick, danger, disabled }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      disabled={disabled}
      onClick={e => { e.stopPropagation(); if (!disabled) onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '6px 9px', border: 'none', borderRadius: 7,
        background: hov && !disabled ? (danger ? '#fef2f2' : '#f8fafc') : 'transparent',
        color: disabled ? '#cbd5e1' : danger ? (hov ? '#dc2626' : '#ef4444') : '#475569',
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
