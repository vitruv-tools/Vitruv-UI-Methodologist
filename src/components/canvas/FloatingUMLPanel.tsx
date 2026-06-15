import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { MODAL_Z_INDEX, useModalBodyLock } from '../ui/modalUtils';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { UMLDiagram, UMLDiagramHandle, UmlDiagramSaveContext, WORKSPACE_DOT_BACKGROUND } from './UMLDiagram';

interface FloatingUMLPanelProps {
  id: string;
  title: string;
  fileName: string;
  layoutScopeId: string;
  ecoreContent: string;
  saveContext?: UmlDiagramSaveContext;
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
  /** Reload diagram content; return fresh ecore XML when fetched from API. */
  onRefresh?: () => string | void | Promise<string | void>;
  /** File id used to fetch the latest ecore from the API on reload. */
  ecoreFileId?: number;
  /** Fetch ecore XML by file id (defaults to api wiring at call sites). */
  fetchEcoreFile?: (fileId: number) => Promise<string>;
  /** Called after a successful server fetch so parent state stays in sync. */
  onEcoreContentUpdated?: (content: string) => void;
  refreshing?: boolean;
}

/** Vitruv toolbar tokens — aligned with UMLDiagram / canvas */
const V = {
  primary: '#049484',
  primarySoft: '#ecfdf5',
  primaryBorder: '#a7f3d0',
  primaryRing: 'rgba(4,148,132,0.15)',
  ink: '#0c436e',
  text: '#374151',
  textMuted: '#64748b',
  border: '#e2e8f0',
  surface: '#ffffff',
  surfaceHover: '#f0fdfa',
} as const;

const ToolbarDivider = () => (
  <div style={{ width: 1, height: 22, background: V.border, margin: '0 5px', flexShrink: 0 }} />
);

const BackIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

export const FloatingUMLPanel: React.FC<FloatingUMLPanelProps> = ({
  id, title, fileName, layoutScopeId, ecoreContent, saveContext, zIndex = MODAL_Z_INDEX, onClose,
  onHome, onRefresh, ecoreFileId, fetchEcoreFile, onEcoreContentUpdated, refreshing = false,
}) => {
  const diagramRef = useRef<UMLDiagramHandle>(null);
  const ecoreContentRef = useRef(ecoreContent);
  ecoreContentRef.current = ecoreContent;
  const ecoreFileIdRef = useRef(ecoreFileId);
  ecoreFileIdRef.current = ecoreFileId;
  const panelZ = zIndex < MODAL_Z_INDEX ? MODAL_Z_INDEX : zIndex;
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const pendingCloseRef = useRef<(() => void) | null>(null);

  useModalBodyLock(true);

  useEffect(() => () => {
    diagramRef.current?.flushLayout?.();
  }, []);

  const doClose = useCallback(() => {
    diagramRef.current?.flushLayout?.();
    onClose(id);
  }, [id, onClose]);

  const requestClose = useCallback((afterClose?: () => void) => {
    diagramRef.current?.flushLayout?.();
    if (diagramRef.current?.isDirty?.()) {
      pendingCloseRef.current = afterClose ?? doClose;
      setShowUnsavedDialog(true);
      return;
    }
    if (afterClose) {
      afterClose();
    } else {
      doClose();
    }
  }, [doClose]);

  const handleBack = useCallback(() => {
    requestClose();
  }, [requestClose]);

  const handleLogoClick = useCallback(() => {
    if (onHome) {
      requestClose(onHome);
    }
  }, [onHome, requestClose]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || refreshing) return;
    setIsRefreshing(true);
    setRefreshMessage('');
    try {
      let next = ecoreContentRef.current;
      const fileId = ecoreFileIdRef.current;

      if (fetchEcoreFile && fileId != null) {
        next = await fetchEcoreFile(fileId);
        onEcoreContentUpdated?.(next);
      } else if (onRefresh) {
        const fresh = await onRefresh();
        if (typeof fresh === 'string' && fresh.length > 0) {
          next = fresh;
        }
      }

      diagramRef.current?.reload?.(next);
      setRefreshMessage('Reloaded');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Reload failed';
      setRefreshMessage(msg);
      diagramRef.current?.reload?.(ecoreContentRef.current);
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshMessage(''), 3000);
    }
  }, [fetchEcoreFile, onRefresh, onEcoreContentUpdated, isRefreshing, refreshing]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const mod = e.ctrlKey || e.metaKey;

      if (mod && !inField) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) diagramRef.current?.redo?.();
          else diagramRef.current?.undo?.();
          return;
        }
        if (key === 'y') {
          e.preventDefault();
          e.stopPropagation();
          diagramRef.current?.redo?.();
          return;
        }
      }

      if (e.key === 'Escape') {
        if (diagramRef.current?.tryEscape?.()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        handleBack();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleBack]);

  const showSpinner = refreshing || isRefreshing;

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
      <style>{`@keyframes uml-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>

      <div
        data-testid="uml-page-toolbar"
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 40,
          background: V.surface,
          border: `1px solid ${V.primaryBorder}`,
          boxShadow: `0 4px 14px ${V.primaryRing}, 0 0 0 1px rgba(4,148,132,0.05)`,
          display: 'flex',
          alignItems: 'center',
          height: 44,
          padding: '0 8px',
          gap: 3,
          borderRadius: 10,
          maxWidth: 'calc(100vw - 28px)',
        }}
      >
        <img
          src="/assets/vitruvius1.png"
          alt="Vitruvius"
          title={onHome ? 'Back to overview' : 'Vitruvius'}
          data-testid="uml-toolbar-logo"
          onClick={onHome ? handleLogoClick : undefined}
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            flexShrink: 0,
            margin: '0 2px',
            cursor: onHome ? 'pointer' : 'default',
            transition: 'opacity 0.15s, transform 0.15s',
            opacity: onHome ? 1 : 0.95,
          }}
          onMouseEnter={e => {
            if (onHome) {
              (e.currentTarget as HTMLImageElement).style.opacity = '0.8';
              (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.04)';
            }
          }}
          onMouseLeave={e => {
            if (onHome) {
              (e.currentTarget as HTMLImageElement).style.opacity = '1';
              (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)';
            }
          }}
        />

        <ToolbarDivider />

        <button
          type="button"
          data-testid="uml-page-back"
          title="Back"
          onClick={handleBack}
          style={{
            width: 34,
            height: 34,
            border: `1px solid ${V.border}`,
            borderRadius: 8,
            background: V.surface,
            color: V.ink,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background = V.surfaceHover;
            b.style.borderColor = V.primaryBorder;
            b.style.color = V.primary;
          }}
          onMouseLeave={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.background = V.surface;
            b.style.borderColor = V.border;
            b.style.color = V.ink;
          }}
        >
          <BackIcon />
        </button>

        <ToolbarDivider />

        <span
          data-testid="uml-toolbar-badge"
          style={{
            padding: '4px 11px',
            borderRadius: 7,
            background: V.primarySoft,
            border: `1px solid ${V.primaryBorder}`,
            color: V.primary,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          UML
        </span>

        <ToolbarDivider />

        <span
          title={title}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: V.ink,
            maxWidth: 240,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            padding: '0 6px',
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          {title}
        </span>

        <ToolbarDivider />

        <ToolbarBtn
          title="Reload diagram"
          label="Reload"
          data-testid="uml-toolbar-reload"
          onClick={() => { void handleRefresh(); }}
          spinning={showSpinner}
        >
          <RefreshIcon />
        </ToolbarBtn>
        {refreshMessage && (
          <span
            data-testid="uml-reload-message"
            style={{
              fontSize: 12,
              color: refreshMessage === 'Reloaded' ? V.primary : '#dc2626',
              fontWeight: 600,
              padding: '0 8px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {refreshMessage}
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        <UMLDiagram
          ref={diagramRef}
          ecoreContent={ecoreContent}
          fileName={fileName}
          layoutScopeId={layoutScopeId}
          saveContext={saveContext}
        />

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

      <ConfirmDialog
        isOpen={showUnsavedDialog}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to close without saving?"
        confirmText="Close without saving"
        cancelText="Keep editing"
        variant="danger"
        onConfirm={() => {
          setShowUnsavedDialog(false);
          const action = pendingCloseRef.current ?? doClose;
          pendingCloseRef.current = null;
          action();
        }}
        onCancel={() => {
          setShowUnsavedDialog(false);
          pendingCloseRef.current = null;
        }}
      />
    </div>,
    document.body,
  );
};

const ToolbarBtn: React.FC<{
  title: string;
  label?: string;
  onClick: () => void;
  children: React.ReactNode;
  spinning?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
}> = ({ title, onClick, children, spinning, disabled = false, label, 'data-testid': testId }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      title={title}
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 34,
        minWidth: label ? 88 : 34,
        padding: label ? '0 10px' : 0,
        border: `1px solid ${disabled ? V.border : hov ? V.primaryBorder : V.border}`,
        borderRadius: 8,
        background: disabled ? '#f8fafc' : hov ? V.surfaceHover : V.surface,
        color: disabled ? '#cbd5e1' : hov ? V.primary : V.ink,
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        transition: 'all 0.12s',
        flexShrink: 0,
        opacity: disabled ? 0.55 : 1,
        boxShadow: hov && !disabled ? `0 0 0 2px ${V.primaryRing}` : 'none',
      }}
    >
      {spinning ? (
        <span style={{
          width: 14,
          height: 14,
          border: '2px solid #e2e8f0',
          borderTopColor: V.primary,
          borderRadius: '50%',
          animation: 'uml-spin 0.7s linear infinite',
          display: 'inline-block',
        }} />
      ) : (
        <>
          {children}
          {label && <span>{label}</span>}
        </>
      )}
    </button>
  );
};

const ZoomButton: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({
  title, onClick, children,
}) => {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      type="button"
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
