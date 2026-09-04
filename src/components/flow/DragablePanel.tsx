import React, { useState, useRef, useCallback } from 'react';
import { BRAND_COLOR } from '../ui/sharedStyles';

export interface DragablePanelProps {
  title?: string;
  onClose: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  saveHighlighted?: boolean;
  showDelete?: boolean;
  children: React.ReactNode;
}

const iconButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  padding: 0,
  border: 'none',
  borderRadius: 4,
  background: 'transparent',
  cursor: 'pointer',
};

const HeaderIconButton: React.FC<{
  title: string;
  onClick: () => void;
  color: string;
  animation?: string;
  children: React.ReactNode;
}> = ({ title, onClick, color, animation, children }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    style={{ ...iconButtonStyle, color, animation }}
  >
    {children}
  </button>
);

const SvgIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {children}
  </svg>
);

/**
 * Draggable, minimizable host panel for the Low Code reaction editor.
 *
 * Rendered inside a React Flow `<Panel>` so it floats above the canvas.
 * Supports drag-to-move, minimize/expand, save (with dirty highlight),
 * and optional delete action.
 */
const DragablePanel: React.FC<DragablePanelProps> = ({
  title = 'Reaction Editor',
  onClose,
  onSave,
  onDelete,
  saveHighlighted = false,
  showDelete = false,
  children,
}) => {
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const dragRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    draggingRef.current = true;
    offsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    setPosition({
      x: e.clientX - offsetRef.current.x,
      y: e.clientY - offsetRef.current.y,
    });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 1 : 10;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setPosition((p) => ({ ...p, x: p.x - step }));
        break;
      case 'ArrowRight':
        e.preventDefault();
        setPosition((p) => ({ ...p, x: p.x + step }));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setPosition((p) => ({ ...p, y: p.y - step }));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setPosition((p) => ({ ...p, y: p.y + step }));
        break;
      default:
        break;
    }
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0, pointerEvents: 'none', zIndex: 1000 }}>
      <style>
        {`@keyframes dragable-panel-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.15); }
          }`}
      </style>
      <div
        ref={dragRef}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: minimized ? 260 : 360,
          background: 'var(--v-surface)',
          borderRadius: 8,
          boxShadow: 'var(--v-card-shadow)',
          border: '1px solid var(--v-border)',
          color: 'var(--v-text)',
          zIndex: 1000,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            background: 'var(--v-surface-muted)',
            borderBottom: minimized ? 'none' : '1px solid var(--v-border)',
            userSelect: 'none',
          }}
        >
          <button
            type="button"
            aria-label={`Move ${title} panel. Use arrow keys to reposition.`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              minWidth: 0,
              margin: 0,
              marginRight: 8,
              padding: 0,
              border: 'none',
              background: 'transparent',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--v-text)',
              textAlign: 'left',
              cursor: 'grab',
              touchAction: 'none',
            }}
          >
            {title}
          </button>
          <div style={{ display: 'flex', gap: 2 }}>
            {onSave && (
              <HeaderIconButton
                title="Save reaction and project"
                onClick={onSave}
                color={saveHighlighted ? BRAND_COLOR : 'var(--v-chrome-icon)'}
                animation={saveHighlighted ? 'dragable-panel-pulse 1.5s ease-in-out infinite' : undefined}
              >
                <SvgIcon>
                  <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
                </SvgIcon>
              </HeaderIconButton>
            )}
            {showDelete && onDelete && (
              <HeaderIconButton title="Delete" onClick={onDelete} color="var(--v-danger-text)">
                <SvgIcon>
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </SvgIcon>
              </HeaderIconButton>
            )}
            <HeaderIconButton
              title={minimized ? 'Expand' : 'Minimize'}
              onClick={() => setMinimized((v) => !v)}
              color="var(--v-chrome-icon)"
            >
              {minimized ? (
                <SvgIcon>
                  <path d="M21 11V3h-8l3.29 3.29-10 10L3 13v8h8l-3.29-3.29 10-10z" />
                </SvgIcon>
              ) : (
                <SvgIcon>
                  <path d="M6 19h12v2H6z" />
                </SvgIcon>
              )}
            </HeaderIconButton>
            <HeaderIconButton title="Close" onClick={onClose} color="var(--v-chrome-icon)">
              <SvgIcon>
                <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </SvgIcon>
            </HeaderIconButton>
          </div>
        </div>

        {/* Content */}
        {!minimized && (
          <div
            className="themed-scroll"
            style={{
              padding: 12,
              overflowY: 'auto',
              maxHeight: 500,
              color: 'var(--v-text)',
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export default DragablePanel;
