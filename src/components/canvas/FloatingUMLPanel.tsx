import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { MODAL_Z_INDEX, getAppPortalRoot, useModalBodyLock } from '../ui/modalUtils';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { UMLDiagram, UMLDiagramHandle, UmlDiagramSaveContext, WORKSPACE_DOT_BACKGROUND } from './UMLDiagram';
import { ReactionModelSidebar } from './ReactionModelSidebar';
import { ReactionsModel } from '../../types/reactions';
import { DrawerModel } from './ModelDrawer';

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
  /** When true, UML diagram is view-only (no class/relationship edits). */
  viewOnly?: boolean;
  /** All library models available for adding to the view. */
  libraryModels?: DrawerModel[];
  /** VSUM project id for Reaction Editor LSP connection. */
  vsumId?: string;
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

const MODEL_COLORS = [
  { border: '#2563eb', fill: 'rgba(37,99,235,0.06)' },
  { border: '#dc2626', fill: 'rgba(220,38,38,0.06)' },
  { border: '#059669', fill: 'rgba(5,150,105,0.06)' },
  { border: '#d97706', fill: 'rgba(217,119,6,0.06)' },
  { border: '#7c3aed', fill: 'rgba(124,58,237,0.06)' },
  { border: '#db2777', fill: 'rgba(219,39,119,0.06)' },
];

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
  viewOnly = false, libraryModels = [], vsumId,
}) => {
  const diagramRef = useRef<UMLDiagramHandle>(null);
  const ecoreContentRef = useRef(ecoreContent);
  ecoreContentRef.current = ecoreContent;
  const ecoreFileIdRef = useRef(ecoreFileId);
  ecoreFileIdRef.current = ecoreFileId;
  const panelZ = Math.max(zIndex, MODAL_Z_INDEX);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const pendingCloseRef = useRef<(() => void) | null>(null);

  // Multi-model state
  const [reactionsMode, setReactionsMode] = useState<'uml' | 'reactions'>('uml');
  const [loadedModels, setLoadedModels] = useState<ReactionsModel[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentModel: ReactionsModel = useMemo(() => ({
    id: saveContext?.metaModelId
      ? Number(saveContext.metaModelId)
      : (ecoreFileId ?? 0),
    name: title,
    ecoreContent,
    ecoreFileId,
  }), [title, ecoreContent, ecoreFileId, saveContext?.metaModelId]);

  const allLoadedModels = useMemo(() => {
    if (loadedModels.length === 0) return [currentModel];
    const hasCurrentModel = loadedModels.some(m => m.name === currentModel.name);
    return hasCurrentModel ? loadedModels : [currentModel, ...loadedModels];
  }, [loadedModels, currentModel]);

  const loadedModelIds = useMemo(() => new Set(allLoadedModels.map(m => m.id)), [allLoadedModels]);

  const sidebarModels: ReactionsModel[] = useMemo(() => {
    return libraryModels
      .filter(m => m.ecoreFileId != null)
      .map(m => ({
        id: m.id,
        name: m.name,
        ecoreContent: '',
        ecoreFileId: m.ecoreFileId,
      }));
  }, [libraryModels]);

  const handleAddModel = useCallback(async (model: ReactionsModel) => {
    if (!model.ecoreFileId || !fetchEcoreFile) return;
    try {
      const content = await fetchEcoreFile(model.ecoreFileId);
      const fullModel: ReactionsModel = { ...model, ecoreContent: content };
      setLoadedModels(prev => {
        const all = prev.length === 0 ? [currentModel] : prev;
        if (all.some(m => m.id === fullModel.id || m.name === fullModel.name)) return all;
        return [...all, fullModel];
      });
    } catch (e) {
      console.error('Failed to fetch model content:', e);
    }
  }, [currentModel, fetchEcoreFile]);

  useModalBodyLock(true);

  useEffect(() => () => {
    diagramRef.current?.flushLayout?.();
  }, []);

  useEffect(() => {
    if (ecoreContent?.trim() || ecoreFileId == null || !fetchEcoreFile) return;
    let cancelled = false;
    (async () => {
      try {
        const next = await fetchEcoreFile(ecoreFileId);
        if (cancelled || !next?.trim()) return;
        onEcoreContentUpdated?.(next);
        diagramRef.current?.reload?.(next);
      } catch {
        // Parent may show an error when the user opens the panel manually.
      }
    })();
    return () => { cancelled = true; };
  }, [ecoreContent, ecoreFileId, fetchEcoreFile, onEcoreContentUpdated]);

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
    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [handleBack]);

  const showSpinner = refreshing || isRefreshing;
  const appPortalRoot = getAppPortalRoot();

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
        {onHome ? (
          <button
            type="button"
            data-testid="uml-toolbar-logo"
            title="Back to overview"
            aria-label="Back to overview"
            onClick={handleLogoClick}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              margin: '0 2px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              transition: 'opacity 0.15s, transform 0.15s',
              opacity: 1,
            }}
            onMouseEnter={e => {
              const button = e.currentTarget;
              button.style.opacity = '0.8';
              button.style.transform = 'scale(1.04)';
            }}
            onMouseLeave={e => {
              const button = e.currentTarget;
              button.style.opacity = '1';
              button.style.transform = 'scale(1)';
            }}
          >
            <img
              src="/assets/vitruvius1.png"
              alt=""
              aria-hidden="true"
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                display: 'block',
              }}
            />
          </button>
        ) : (
          <img
            src="/assets/vitruvius1.png"
            alt="Vitruvius"
            title="Vitruvius"
            data-testid="uml-toolbar-logo"
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              flexShrink: 0,
              margin: '0 2px',
              cursor: 'default',
              opacity: 0.95,
            }}
          />
        )}

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
            const b = e.currentTarget;
            b.style.background = V.surfaceHover;
            b.style.borderColor = V.primaryBorder;
            b.style.color = V.primary;
          }}
          onMouseLeave={e => {
            const b = e.currentTarget;
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
        {/* VSUM/Reactions toggle + Add Meta Models */}
        {libraryModels.length > 0 && (
          <>
            <ToolbarDivider />
            <div style={{
              display: 'flex',
              background: '#f1f5f9',
              borderRadius: 6,
              padding: 2,
              gap: 1,
            }}>
              <button
                type="button"
                onClick={() => setReactionsMode('uml')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 5,
                  cursor: 'pointer',
                  background: reactionsMode === 'uml' ? V.surface : 'transparent',
                  color: reactionsMode === 'uml' ? V.ink : V.textMuted,
                  boxShadow: reactionsMode === 'uml' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                VSUM
              </button>
              <button
                type="button"
                onClick={() => setReactionsMode('reactions')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 5,
                  cursor: 'pointer',
                  background: reactionsMode === 'reactions' ? V.surface : 'transparent',
                  color: reactionsMode === 'reactions' ? V.primary : V.textMuted,
                  boxShadow: reactionsMode === 'reactions' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                Reactions
              </button>
            </div>
            <ToolbarDivider />
            <button
              type="button"
              title="Add meta models to this view"
              onClick={() => setSidebarOpen(true)}
              style={{
                height: 32,
                padding: '0 10px',
                border: `1px solid ${V.primaryBorder}`,
                borderRadius: 7,
                background: V.primarySoft,
                color: V.primary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                transition: 'all 0.12s',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = V.primary;
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = V.primarySoft;
                e.currentTarget.style.color = V.primary;
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Meta Models
            </button>
          </>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        <UMLDiagram
          ref={diagramRef}
          ecoreContent={ecoreContent}
          fileName={fileName}
          layoutScopeId={layoutScopeId}
          saveContext={saveContext}
          interactive={!viewOnly}
          reactionsMode={reactionsMode}
          reactionModels={allLoadedModels}
          additionalModels={allLoadedModels.slice(1).map((m, idx) => ({
            id: m.id,
            name: m.name,
            ecoreContent: m.ecoreContent,
            color: MODEL_COLORS[(idx + 1) % MODEL_COLORS.length].border,
            fill: MODEL_COLORS[(idx + 1) % MODEL_COLORS.length].fill,
          }))}
          vsumId={vsumId}
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

        {/* Model sidebar */}
        <ReactionModelSidebar
          isOpen={sidebarOpen}
          allModels={sidebarModels}
          loadedModelIds={loadedModelIds}
          onAddModel={handleAddModel}
          onClose={() => setSidebarOpen(false)}
        />
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
    appPortalRoot,
  );
};

const getToolbarBtnStyle = (
  disabled: boolean,
  hov: boolean,
  label?: string,
): React.CSSProperties => {
  let borderColor: string = V.border;
  if (!disabled && hov) {
    borderColor = V.primaryBorder;
  }

  let background: string = V.surface;
  if (disabled) {
    background = '#f8fafc';
  } else if (hov) {
    background = V.surfaceHover;
  }

  let color: string = V.ink;
  if (disabled) {
    color = '#cbd5e1';
  } else if (hov) {
    color = V.primary;
  }

  return {
    height: 34,
    minWidth: label ? 88 : 34,
    padding: label ? '0 10px' : 0,
    border: `1px solid ${borderColor}`,
    borderRadius: 8,
    background,
    color,
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
  };
};

const renderToolbarBtnContent = (
  spinning: boolean | undefined,
  children: React.ReactNode,
  label?: string,
): React.ReactNode => {
  if (spinning) {
    return (
      <span style={{
        width: 14,
        height: 14,
        border: '2px solid #e2e8f0',
        borderTopColor: V.primary,
        borderRadius: '50%',
        animation: 'uml-spin 0.7s linear infinite',
        display: 'inline-block',
      }} />
    );
  }

  return (
    <>
      {children}
      {label ? <span>{label}</span> : null}
    </>
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
      style={getToolbarBtnStyle(disabled, hov, label)}
    >
      {renderToolbarBtnContent(spinning, children, label)}
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
