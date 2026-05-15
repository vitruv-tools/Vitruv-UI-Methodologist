import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  getMetaModelExportLabel,
  hasMetaModelFile,
  MetaModelExportKind,
  MetaModelWithFileIds,
} from '../../utils/metaModelExport';

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface MetaModelContextMenuProps {
  x: number;
  y: number;
  model: MetaModelWithFileIds;
  anchorRect: AnchorRect;
  onDownload: (kind: MetaModelExportKind) => void;
  onClose: () => void;
  downloading: MetaModelExportKind | null;
  error?: string | null;
}

const HIGHLIGHT_CARD_STYLE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 9999,
  margin: 0,
  boxSizing: 'border-box',
  background: '#f8fcfb',
  border: '2px solid #049484',
  borderRadius: 12,
  padding: 16,
  boxShadow: '0 8px 28px rgba(4, 148, 132, 0.22), 0 0 0 4px rgba(4, 148, 132, 0.12)',
  fontFamily: 'Georgia, serif',
  pointerEvents: 'none',
  animation: 'metaModelMenuSlideIn 0.2s ease-out',
  overflow: 'hidden',
};

const MENU_WIDTH = 260;
const MENU_ESTIMATED_HEIGHT = 200;

const BACKDROP_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9998,
  border: 'none',
  padding: 0,
  margin: 0,
  width: '100%',
  height: '100%',
  cursor: 'default',
  backgroundColor: 'rgba(15, 23, 42, 0.35)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  animation: 'metaModelMenuFadeIn 0.18s ease-out',
};

const PANEL_STYLE: React.CSSProperties = {
  position: 'fixed',
  margin: 0,
  zIndex: 10000,
  width: MENU_WIDTH,
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fcfb 100%)',
  border: '1px solid rgba(4, 148, 132, 0.18)',
  borderRadius: 14,
  boxShadow: '0 20px 50px rgba(4, 148, 132, 0.18), 0 8px 24px rgba(0, 0, 0, 0.12)',
  overflow: 'hidden',
  fontFamily: 'Georgia, serif',
  animation: 'metaModelMenuSlideIn 0.2s ease-out',
};

const HEADER_STYLE: React.CSSProperties = {
  position: 'relative',
  padding: '14px 40px 12px 16px',
  background: 'linear-gradient(135deg, #049484 0%, #037368 100%)',
  color: '#ffffff',
};

const CLOSE_BUTTON_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  padding: 0,
  border: 'none',
  borderRadius: 8,
  background: 'rgba(255, 255, 255, 0.18)',
  color: '#ffffff',
  fontSize: 20,
  lineHeight: 1,
  fontWeight: 400,
  cursor: 'pointer',
  transition: 'background 0.15s ease',
};

const HEADER_TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  opacity: 0.9,
};

const HEADER_NAME_STYLE: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: 15,
  fontWeight: 700,
  lineHeight: 1.35,
  wordBreak: 'break-word',
};

const BODY_STYLE: React.CSSProperties = {
  padding: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const ERROR_STYLE: React.CSSProperties = {
  margin: '0 0 4px',
  padding: '10px 12px',
  fontSize: 12,
  lineHeight: 1.45,
  color: '#991b1b',
  background: '#fef2f2',
  borderRadius: 8,
  border: '1px solid #fecaca',
};

const MENU_GAP = 12;
const VIEWPORT_PADDING = 12;

function rectsOverlap(
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number },
  gap = 0,
): boolean {
  return !(
    a.left + a.width + gap <= b.left ||
    b.left + b.width + gap <= a.left ||
    a.top + a.height + gap <= b.top ||
    b.top + b.height + gap <= a.top
  );
}

function clampMenuPosition(left: number, top: number, menuWidth: number, menuHeight: number) {
  const maxLeft = globalThis.innerWidth - menuWidth - VIEWPORT_PADDING;
  const maxTop = globalThis.innerHeight - menuHeight - VIEWPORT_PADDING;
  return {
    left: Math.min(Math.max(VIEWPORT_PADDING, left), Math.max(VIEWPORT_PADDING, maxLeft)),
    top: Math.min(Math.max(VIEWPORT_PADDING, top), Math.max(VIEWPORT_PADDING, maxTop)),
  };
}

/** Place menu beside the highlighted card — never on top of it. */
export function computeMenuPosition(
  anchorRect: AnchorRect,
  menuWidth: number,
  menuHeight: number,
): { left: number; top: number } {
  const anchor = {
    left: anchorRect.left,
    top: anchorRect.top,
    width: anchorRect.width,
    height: anchorRect.height,
  };

  const candidates = [
    { left: anchorRect.left + anchorRect.width + MENU_GAP, top: anchorRect.top },
    { left: anchorRect.left - menuWidth - MENU_GAP, top: anchorRect.top },
    {
      left: anchorRect.left + anchorRect.width + MENU_GAP,
      top: anchorRect.top + anchorRect.height / 2 - menuHeight / 2,
    },
    {
      left: anchorRect.left - menuWidth - MENU_GAP,
      top: anchorRect.top + anchorRect.height / 2 - menuHeight / 2,
    },
    { left: anchorRect.left, top: anchorRect.top + anchorRect.height + MENU_GAP },
    { left: anchorRect.left, top: anchorRect.top - menuHeight - MENU_GAP },
    {
      left: anchorRect.left + anchorRect.width - menuWidth,
      top: anchorRect.top + anchorRect.height + MENU_GAP,
    },
  ];

  for (const candidate of candidates) {
    const pos = clampMenuPosition(candidate.left, candidate.top, menuWidth, menuHeight);
    const menu = { left: pos.left, top: pos.top, width: menuWidth, height: menuHeight };
    if (!rectsOverlap(anchor, menu, MENU_GAP)) {
      return pos;
    }
  }

  return clampMenuPosition(
    anchorRect.left + anchorRect.width + MENU_GAP,
    anchorRect.top,
    menuWidth,
    menuHeight,
  );
}

function getItemStyle(disabled: boolean, isBusy: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    textAlign: 'left',
    padding: '12px 14px',
    border: 'none',
    borderRadius: 10,
    background: isBusy ? '#ecfdf5' : 'transparent',
    fontSize: 14,
    fontFamily: 'Georgia, serif',
    fontWeight: 600,
    color: disabled ? '#9ca3af' : '#1f2937',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s ease',
  };
}

function MetaModelHighlightCard({
  anchorRect,
  model,
}: {
  anchorRect: AnchorRect;
  model: MetaModelWithFileIds;
}) {
  const createdLabel = model.createdAt
    ? new Date(model.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div
      aria-hidden
      style={{
        ...HIGHLIGHT_CARD_STYLE,
        top: anchorRect.top,
        left: anchorRect.left,
        width: anchorRect.width,
        height: anchorRect.height,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          color: '#1f2937',
          fontSize: 15,
          lineHeight: 1.4,
          marginBottom: 6,
        }}
      >
        {model.name}
      </div>
      {model.domain && (
        <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginBottom: 4 }}>
          Domain: <span style={{ color: '#049484', fontWeight: 600 }}>{model.domain}</span>
        </div>
      )}
      {createdLabel && (
        <div style={{ fontSize: 12, color: '#9ca3af' }}>Created: {createdLabel}</div>
      )}
    </div>
  );
}

function FileIcon({ kind }: { kind: MetaModelExportKind }) {
  const color = kind === 'ecore' ? '#049484' : '#0d9488';
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: 10,
        background: `${color}14`,
        color,
        flexShrink: 0,
      }}
      aria-hidden
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2v6h6M12 18v-6M9 15h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export const MetaModelContextMenu: React.FC<MetaModelContextMenuProps> = ({
  model,
  anchorRect,
  onDownload,
  onClose,
  downloading,
  error,
}) => {
  const kinds: MetaModelExportKind[] = ['ecore', 'genmodel'];
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() =>
    computeMenuPosition(anchorRect, MENU_WIDTH, MENU_ESTIMATED_HEIGHT),
  );

  useLayoutEffect(() => {
    const rect = panelRef.current?.getBoundingClientRect();
    const height = rect?.height ?? MENU_ESTIMATED_HEIGHT;
    setPosition(computeMenuPosition(anchorRect, MENU_WIDTH, height));
  }, [anchorRect, error, downloading]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const styleId = 'meta-model-context-menu-keyframes';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes metaModelMenuFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes metaModelMenuSlideIn {
        from { opacity: 0; transform: translateY(-6px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `;
    document.head.appendChild(style);
  }, []);

  return ReactDOM.createPortal(
    <>
      <button
        type="button"
        aria-label="Close export menu"
        style={BACKDROP_STYLE}
        onClick={onClose}
      />
      <MetaModelHighlightCard anchorRect={anchorRect} model={model} />
      <div
        ref={panelRef}
        role="menu"
        aria-label={`Export files for ${model.name}`}
        style={{ ...PANEL_STYLE, left: position.left, top: position.top }}
      >
        <div style={HEADER_STYLE}>
          <p style={HEADER_TITLE_STYLE}>Export meta model</p>
          <p style={HEADER_NAME_STYLE}>{model.name}</p>
          <button
            type="button"
            aria-label="Close export menu"
            style={CLOSE_BUTTON_STYLE}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.32)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
            }}
          >
            ×
          </button>
        </div>

        <div style={BODY_STYLE}>
          {error && <div style={ERROR_STYLE} role="alert">{error}</div>}

          {kinds.map((kind) => {
            const available = hasMetaModelFile(model, kind);
            const isBusy = downloading === kind;
            const disabled = !available || downloading !== null;
            const ext = kind === 'ecore' ? '.ecore' : '.genmodel';

            return (
              <div key={kind} role="none">
                <button
                  type="button"
                  role="menuitem"
                  disabled={disabled}
                  style={getItemStyle(disabled, isBusy)}
                  onClick={() => {
                    if (!disabled) onDownload(kind);
                  }}
                  onMouseEnter={(e) => {
                    if (!disabled) e.currentTarget.style.background = '#f0fdfa';
                  }}
                  onMouseLeave={(e) => {
                    if (!isBusy) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <FileIcon kind={kind} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', lineHeight: 1.3 }}>
                      {isBusy ? 'Downloading…' : getMetaModelExportLabel(kind)}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 11,
                        fontWeight: 500,
                        color: disabled ? '#cbd5e1' : '#6b7280',
                        marginTop: 2,
                      }}
                    >
                      {available
                        ? `Save ${ext} to your device`
                        : 'File not available on server'}
                    </span>
                  </span>
                  {!disabled && !isBusy && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#049484" strokeWidth="2" aria-hidden>
                      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>,
    document.body,
  );
};
