import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { UMLDiagram, UMLDiagramHandle } from './UMLDiagram';

interface FloatingUMLPanelProps {
  id: string;
  title: string;
  ecoreContent: string;
  /** Legacy props — no longer used, kept for call-site compatibility */
  initialTop?: number;
  initialRight?: number;
  panelWidth?: number;
  panelHeight?: number;
  zIndex: number;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
}

export const FloatingUMLPanel: React.FC<FloatingUMLPanelProps> = ({
  id, title, ecoreContent, zIndex, onClose,
}) => {
  const diagramRef = useRef<UMLDiagramHandle>(null);

  // Auto fit-to-view on first open
  useEffect(() => {
    const t = setTimeout(() => diagramRef.current?.fitToView(), 150);
    return () => clearTimeout(t);
  }, []);

  return ReactDOM.createPortal(
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={() => onClose(id)}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          zIndex,
        }}
      />

      {/* ── Panel ── */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '80vw', height: '80vh',
        zIndex: zIndex + 1,
        background: '#ffffff',
        borderRadius: 10,
        boxShadow: '0 24px 64px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.10)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* ── Title bar ── */}
        <div style={{
          padding: '10px 14px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
            <UMLIcon />
            <span style={{
              fontSize: 13, fontWeight: 600, color: '#0f172a',
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {title}
            </span>
          </div>

          <button
            onClick={() => onClose(id)}
            style={{
              flexShrink: 0, width: 28, height: 28,
              border: 'none', background: 'transparent',
              cursor: 'pointer', color: '#94a3b8', borderRadius: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, transition: 'all 0.1s', marginLeft: 10,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9';
              (e.currentTarget as HTMLButtonElement).style.color = '#374151';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* ── Diagram ── */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <UMLDiagram ref={diagramRef} ecoreContent={ecoreContent} />

          {/* ── Zoom controls (floating bottom-right) ── */}
          <div style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            zIndex: 10,
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
      </div>
    </>,
    document.body
  );
};

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

// ── UMLIcon ───────────────────────────────────────────────────────────────────

const UMLIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="21" x2="9" y2="9" />
  </svg>
);
