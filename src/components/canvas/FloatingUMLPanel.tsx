import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { MODAL_Z_INDEX, useModalBodyLock } from '../ui/modalUtils';
import { UMLDiagram, UMLDiagramHandle, WORKSPACE_DOT_BACKGROUND } from './UMLDiagram';

interface FloatingUMLPanelProps {
  id: string;
  title: string;
  fileName: string;
  layoutScopeId: string;
  ecoreContent: string;
  /** Legacy props — no longer used, kept for call-site compatibility */
  initialTop?: number;
  initialRight?: number;
  panelWidth?: number;
  panelHeight?: number;
  zIndex: number;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
  /** Navigate to the app home/overview page (e.g. `/`). */
  onHome?: () => void;
}

export const FloatingUMLPanel: React.FC<FloatingUMLPanelProps> = ({
  id, title, fileName, layoutScopeId, ecoreContent, zIndex = MODAL_Z_INDEX, onClose, onHome,
}) => {
  const diagramRef = useRef<UMLDiagramHandle>(null);
  const panelZ = zIndex < MODAL_Z_INDEX ? MODAL_Z_INDEX : zIndex;

  useModalBodyLock(true);

  const handleBack = useCallback(() => {
    diagramRef.current?.flushLayout?.();
    onClose(id);
  }, [id, onClose]);

  const handleHome = useCallback(() => {
    diagramRef.current?.flushLayout?.();
    onClose(id);
    onHome?.();
  }, [id, onClose, onHome]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleBack]);

  return ReactDOM.createPortal(
    <div
      data-testid="uml-fullscreen-page"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: panelZ,
        pointerEvents: 'auto',
        ...WORKSPACE_DOT_BACKGROUND,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {/* ── Toolbar (matches canvas LeftPill style) ── */}
        <div
          data-testid="uml-page-toolbar"
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            zIndex: 40,
            background: '#ffffff',
            boxShadow: '0 4px 16px rgba(0,0,0,0.13), 0 0 0 1px rgba(0,0,0,0.07)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            height: 48,
            padding: '0 8px',
            gap: 2,
            maxWidth: 'calc(100vw - 28px)',
          }}
        >
          <ToolbarBtn onClick={handleBack} title="Back to canvas">
            <ArrowLeftIcon />
          </ToolbarBtn>

          <ToolbarDivider />

          <img
            src="/assets/vitruvius1.png"
            alt="Back to overview"
            title="Back to overview"
            onClick={handleHome}
            style={{
              height: 36,
              width: 'auto',
              maxWidth: 56,
              borderRadius: 6,
              flexShrink: 0,
              margin: '0 4px',
              cursor: 'pointer',
              objectFit: 'contain',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          />

          <ToolbarDivider />

          <span style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#049484',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            padding: '2px 8px',
            borderRadius: 4,
            flexShrink: 0,
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          }}>
            UML
          </span>

          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#0f172a',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 320,
            padding: '0 6px',
          }}>
            {title}
          </span>
        </div>

        <UMLDiagram
          ref={diagramRef}
          ecoreContent={ecoreContent}
          fileName={fileName}
          layoutScopeId={layoutScopeId}
        />

        {/* ── Zoom controls (floating bottom-right) ── */}
        <div style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          zIndex: 30,
        }}>
          <ZoomButton title="Zoom in" onClick={() => diagramRef.current?.zoomIn()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </ZoomButton>

          <ZoomButton title="Zoom out" onClick={() => diagramRef.current?.zoomOut()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </ZoomButton>

          <ZoomButton title="Fit to view" onClick={() => diagramRef.current?.fitToView()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3" />
              <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
              <path d="M3 16v3a2 2 0 0 0 2 2h3" />
              <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </ZoomButton>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ── Toolbar helpers ───────────────────────────────────────────────────────────

const ToolbarDivider = () => (
  <div style={{ width: 1, height: 22, background: '#e2e8f0', margin: '0 5px', flexShrink: 0 }} />
);

const ToolbarBtn: React.FC<{ onClick: () => void; title: string; children: React.ReactNode }> = ({
  onClick, title, children,
}) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 34, height: 34, border: 'none', borderRadius: 6,
        background: hov ? '#f1f5f9' : 'transparent',
        color: hov ? '#1e293b' : '#475569',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s', flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
};

const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

// ── ZoomButton ────────────────────────────────────────────────────────────────

const ZoomButton: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({
  title, onClick, children,
}) => {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 32, height: 32,
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        background: hov ? '#f8fafc' : '#ffffff',
        color: hov ? '#0f172a' : '#64748b',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s',
      }}
    >
      {children}
    </button>
  );
};
