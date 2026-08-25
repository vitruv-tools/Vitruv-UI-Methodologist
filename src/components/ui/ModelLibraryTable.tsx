import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { apiService } from '../../services/api';
import { CreateModelModal } from './CreateModelModal';
import { KeywordTagsInput } from './KeywordTagsInput';
import { UMLDiagram, UMLDiagramHandle } from '../canvas/UMLDiagram';
import { FloatingUMLPanel } from '../canvas/FloatingUMLPanel';
import { MetaModelFileDownloads } from './MetaModelFileDownloads';
import { useModalBodyLock, modalBackdropStyle } from './modalUtils';
import {
  APP_FONT,
  BRAND_COLOR,
  inputStyle as sharedInputStyle,
  modalCloseButtonStyle,
} from './sharedStyles';
import {
  METAMODEL_PREVIEW_LAYOUT_SCOPE,
  metaModelPreviewLayoutFileName,
} from '../../utils/metaModelPreview';
import {
  appendMetaModelSearchToken,
  buildMetaModelFindFilters,
  completeMetaModelSearchToken,
  MetaModelDateFilter,
  parseMetaModelSearchQuery,
  ParsedMetaModelSearchFilter,
} from '../../utils/metaModelSearchFilters';
import {
  extractCreatePayload,
  fetchLibraryMetaModels,
  fetchLibraryMetaModelsAfterCreate,
  isModelReferencedByProjects,
  LibraryMetaModel,
} from '../../utils/metaModelList';
import { PortalRowActionsMenu } from './PortalRowActionsMenu';
import { ConfirmDialog } from './ConfirmDialog';

interface ModelLibraryTableProps {
  onModelOpen?: (model: any) => void;
}

// ── helpers ────────────────────────────────────────────────────────────────

const formatDate = (iso: string) => {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// ── sub-components ─────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

// ── ModelDetailModal ────────────────────────────────────────────────────────

interface ModelDetailModalProps {
  model: any;
  onClose: () => void;
  onUpdated: () => void;
  /** Pass raw ecore XML to skip the API fetch (used when content is already in memory) */
  ecoreContent?: string;
  /** When true, only render the panel (backdrop is provided by the parent). */
  embedded?: boolean;
}

const FONT = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const DARK = '#0B1720';

const detailInputSt: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid #e2e8f0', borderRadius: 8,
  fontSize: 13, color: '#0f172a', background: '#f8fafc',
  boxSizing: 'border-box', outline: 'none',
  fontFamily: FONT, transition: 'border-color 0.15s',
};

// domain colour themes (mirrors ModelDrawer)
interface DomainTheme { bg: string; icon: string; badge: string; badgeText: string; }
const D_THEMES: Record<string, DomainTheme> = {
  default:  { bg: '#eef2ff', icon: '#6366f1', badge: '#e0e7ff', badgeText: '#4338ca' },
  computer: { bg: '#eff6ff', icon: '#3b82f6', badge: '#dbeafe', badgeText: '#1d4ed8' },
  target:   { bg: '#f0fdf4', icon: '#10b981', badge: '#d1fae5', badgeText: '#065f46' },
  modell:   { bg: '#faf5ff', icon: '#8b5cf6', badge: '#ede9fe', badgeText: '#5b21b6' },
  model:    { bg: '#faf5ff', icon: '#8b5cf6', badge: '#ede9fe', badgeText: '#5b21b6' },
  teal:     { bg: '#f0fdfa', icon: '#14b8a6', badge: '#ccfbf1', badgeText: '#0f766e' },
};
const D_FALLBACK: DomainTheme[] = [
  { bg: '#fef9ec', icon: '#d97706', badge: '#fef3c7', badgeText: '#92400e' },
  { bg: '#fdf4ff', icon: '#a855f7', badge: '#f3e8ff', badgeText: '#7e22ce' },
  { bg: '#f0f9ff', icon: '#0ea5e9', badge: '#e0f2fe', badgeText: '#0369a1' },
  { bg: '#fff0f5', icon: '#ec4899', badge: '#fce7f3', badgeText: '#9d174d' },
];
function getDTheme(domain?: string): DomainTheme {
  const key = domain?.toLowerCase().trim() || 'default';
  if (D_THEMES[key]) return D_THEMES[key];
  let h = 0;
  for (let i = 0; i < key.length; ) {
    const cp = key.codePointAt(i) ?? 0;
    h = cp + ((h << 5) - h);
    i += cp > 0xffff ? 2 : 1;
  }
  return D_FALLBACK[Math.abs(h) % D_FALLBACK.length];
}

const DFieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, letterSpacing: '0.01em', fontFamily: FONT }}>{children}</div>
);

const detailFieldLabelSt: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, fontFamily: FONT };

const DPreviewBtn: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({ title, onClick, children }) => {
  const [hov, setHov] = React.useState(false);
  return (
    <button type="button" title={title} onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: 24, height: 24, border: '1px solid #e2e8f0', borderRadius: 6, background: hov ? '#f1f5f9' : '#fff', color: hov ? '#0f172a' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s' }}>
      {children}
    </button>
  );
};

export const ModelDetailModal: React.FC<ModelDetailModalProps> = ({
  model, onClose, onUpdated, ecoreContent: ecoreContentProp, embedded = false,
}) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: model.name || '', description: model.description || '', domain: model.domain || '', keywords: model.keyword || [] as string[] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ecoreContent, setEcoreContent] = useState<string | null>(ecoreContentProp ?? null);
  const [fetchingUml, setFetchingUml] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [umlExpanded, setUmlExpanded] = useState(false);
  // Local copy of the model used for read-only display — kept in sync with the
  // last successful save so the view reflects edits immediately, without waiting
  // for the parent list to refetch and hand back a new `model` prop.
  const [displayModel, setDisplayModel] = useState(model);
  const diagramRef = useRef<UMLDiagramHandle>(null);
  const theme = getDTheme(displayModel.domain);

  useEffect(() => {
    if (ecoreContentProp) { setEcoreContent(ecoreContentProp); return; }
    if (!model.ecoreFileId) return;
    setFetchingUml(true);
    apiService.getFile(model.ecoreFileId)
      .then(c => setEcoreContent(c))
      .catch(() => setFetchError(true))
      .finally(() => setFetchingUml(false));
  }, [model.ecoreFileId, ecoreContentProp]);

  const previewLayoutFile = metaModelPreviewLayoutFileName(model.id, model.name);

  useEffect(() => {
    if (!ecoreContent) return;
    const t = setTimeout(() => diagramRef.current?.fitToView(), 150);
    return () => clearTimeout(t);
  }, [ecoreContent, model.id, model.name]);

  useModalBodyLock(true);

  const canSave = !!(form.name.trim() && form.description.trim() && form.domain.trim() && form.keywords.length > 0 && !saving);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      await apiService.updateMetaModel(String(model.id), {
        name: form.name, description: form.description, domain: form.domain, keyword: form.keywords,
        ecoreFileId: model.ecoreFileId || 0,
        genModelFileId: model.genModelFileId || 0,
      });
      setDisplayModel((prev: any) => ({ ...prev, name: form.name, description: form.description, domain: form.domain, keyword: form.keywords }));
      setSuccess('Saved successfully');
      onUpdated();
      setTimeout(() => { setSuccess(''); setEditing(false); }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const panel = (
      <dialog
        open
        data-model-detail-modal
        aria-label={`Model Preview: ${displayModel.name}`}
        onClose={onClose}
        onCancel={onClose}
        style={{ position: 'relative', background: '#fff', borderRadius: 10, width: '80vw', height: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.10)', border: '1px solid #e2e8f0', fontFamily: FONT, pointerEvents: 'auto', margin: 0, padding: 0 }}
      >
        {/* ── Header ── */}
        <div style={{ padding: '14px 20px', background: '#ffffff', borderBottom: '1px solid #f1f5f9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, overflow: 'hidden' }}>
            {/* BoxIcon — same as model cards */}
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
              <path d="M16 5L27 11V21L16 27L5 21V11L16 5Z" stroke="#049484" strokeWidth="1.6" fill="#04948422" strokeLinejoin="round" />
              <path d="M16 5V27" stroke="#049484" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M5 11L27 11" stroke="#049484" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M16 5L5 11L16 17L27 11L16 5Z" stroke="#049484" strokeWidth="1.3" fill="#04948418" strokeLinejoin="round" />
            </svg>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Model Preview: <span style={{ color: '#374151', fontWeight: 600 }}>{displayModel.name}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {!editing && (
              <button type="button"
                onClick={() => {
                  setForm({ name: displayModel.name || '', description: displayModel.description || '', domain: displayModel.domain || '', keywords: displayModel.keyword || [] });
                  setEditing(true);
                }}
                title="Edit meta-model"
                style={{ height: 30, padding: '0 12px', border: '1px solid #e2e8f0', borderRadius: 7, background: '#f8fafc', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.12s', fontFamily: FONT }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = DARK; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; (e.currentTarget as HTMLButtonElement).style.borderColor = DARK; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc'; (e.currentTarget as HTMLButtonElement).style.color = '#374151'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0'; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
            )}
            <button type="button"
              onClick={onClose}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', fontSize: 16, width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9'; (e.currentTarget as HTMLButtonElement).style.color = '#374151'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
            >✕</button>
          </div>
        </div>

        {/* ── Two-column body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left — fields */}
          <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid #f1f5f9', overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {editing ? (
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
                <div>
                  <label htmlFor="model-detail-name" style={detailFieldLabelSt}>Name</label>
                  <input id="model-detail-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={detailInputSt} onFocus={e => (e.currentTarget.style.borderColor = '#049484')} onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')} />
                </div>
                <div>
                  <label htmlFor="model-detail-keywords" style={detailFieldLabelSt}>Keywords</label>
                  <KeywordTagsInput id="model-detail-keywords" keywords={form.keywords} onChange={kws => setForm(f => ({ ...f, keywords: kws }))} />
                </div>
                <div>
                  <label htmlFor="model-detail-description" style={detailFieldLabelSt}>Description</label>
                  <textarea id="model-detail-description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...detailInputSt, resize: 'vertical', minHeight: 72 }} onFocus={e => (e.currentTarget.style.borderColor = '#049484')} onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')} />
                </div>
                <div>
                  <label htmlFor="model-detail-domain" style={detailFieldLabelSt}>Domain</label>
                  <input id="model-detail-domain" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} style={detailInputSt} onFocus={e => (e.currentTarget.style.borderColor = '#049484')} onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')} />
                </div>
                {error   && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>{error}</div>}
                {success && <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, fontSize: 12, color: '#15803d' }}>{success}</div>}
                <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setEditing(false)}
                    style={{ flex: 1, padding: '8px 0', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                    Cancel
                  </button>
                  <button type="submit" disabled={!canSave}
                    style={{ flex: 1, padding: '8px 0', background: canSave ? DARK : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: FONT }}
                    onMouseEnter={e => { if (canSave) (e.currentTarget as HTMLButtonElement).style.background = '#1e293b'; }}
                    onMouseLeave={e => { if (canSave) (e.currentTarget as HTMLButtonElement).style.background = DARK; }}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div>
                  <DFieldLabel>Name</DFieldLabel>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', fontFamily: FONT, lineHeight: 1.4 }}>{displayModel.name}</div>
                </div>
                {displayModel.keyword?.length > 0 && (
                  <div>
                    <DFieldLabel>Keywords</DFieldLabel>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {displayModel.keyword.map((kw: string) => (
                        <span key={kw} style={{ padding: '3px 10px', borderRadius: 20, background: theme.badge, color: theme.badgeText, fontSize: 11, fontWeight: 600, fontFamily: FONT }}>{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <DFieldLabel>Description</DFieldLabel>
                  <div style={{ fontSize: 13, color: '#374151', fontFamily: FONT, lineHeight: 1.7 }}>
                    {displayModel.description || <span style={{ color: '#cbd5e1' }}>—</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                  <MetaModelFileDownloads
                    modelName={displayModel.name}
                    ecoreFileId={displayModel.ecoreFileId}
                    genModelFileId={displayModel.genModelFileId}
                    labelStyle={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, letterSpacing: '0.01em', fontFamily: FONT }}
                  />
                  {model.createdAt && (
                    <div>
                      <DFieldLabel>Created</DFieldLabel>
                      <div style={{ fontSize: 13, color: '#64748b', fontFamily: FONT }}>{formatDate(model.createdAt)}</div>
                    </div>
                  )}
                  {model.updatedAt && (
                    <div>
                      <DFieldLabel>Updated</DFieldLabel>
                      <div style={{ fontSize: 13, color: '#64748b', fontFamily: FONT }}>{formatDate(model.updatedAt)}</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right — UML preview */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff' }}>
            {/* Label + zoom controls */}
            <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: FONT }}>UML</span>
              {ecoreContent && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <DPreviewBtn title="Open full-screen UML view" onClick={() => setUmlExpanded(true)}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  </DPreviewBtn>
                  <DPreviewBtn title="Zoom in" onClick={() => diagramRef.current?.zoomIn()}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </DPreviewBtn>
                  <DPreviewBtn title="Zoom out" onClick={() => diagramRef.current?.zoomOut()}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </DPreviewBtn>
                  <DPreviewBtn title="Fit to view" onClick={() => diagramRef.current?.fitToView()}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
                      <path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
                    </svg>
                  </DPreviewBtn>
                </div>
              )}
            </div>

            {/* Diagram card */}
            <div style={{ flex: 1, padding: '0 18px 18px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, position: 'relative', background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                {fetchingUml && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#94a3b8' }}>
                    <div style={{ width: 24, height: 24, border: '2.5px solid #e2e8f0', borderTop: `2.5px solid ${theme.icon}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: 12, fontFamily: FONT }}>Loading preview…</span>
                  </div>
                )}
                {!fetchingUml && fetchError && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 12, fontFamily: FONT }}>Could not load UML preview</div>
                )}
                {!fetchingUml && !fetchError && !ecoreContent && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 12, fontFamily: FONT }}>No diagram available</div>
                )}
                {ecoreContent && (
                  <UMLDiagram
                    ref={diagramRef}
                    ecoreContent={ecoreContent}
                    fileName={previewLayoutFile}
                    layoutScopeId={METAMODEL_PREVIEW_LAYOUT_SCOPE}
                    interactive={false}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </dialog>
  );

  const expandedUmlPanel = umlExpanded && ecoreContent ? (
    <FloatingUMLPanel
      id={`metamodel-detail-${model.id}`}
      title={model.name}
      fileName={previewLayoutFile}
      layoutScopeId={METAMODEL_PREVIEW_LAYOUT_SCOPE}
      ecoreContent={ecoreContent}
      viewOnly
      onClose={() => setUmlExpanded(false)}
      onFocus={() => { /* preview panel does not participate in focus stacking */ }}
      ecoreFileId={model.ecoreFileId}
      fetchEcoreFile={(fileId) => apiService.getFile(fileId)}
      onEcoreContentUpdated={(content) => setEcoreContent(content)}
      zIndex={embedded ? 10001 : 10002}
    />
  ) : null;

  if (embedded) {
    return (
      <>
        <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
        {panel}
        {expandedUmlPanel}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        data-model-detail-backdrop
        onClick={onClose}
        style={{ ...modalBackdropStyle, zIndex: 10000 }}
      />
      <div
        style={{
          position: 'fixed', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10001, fontFamily: FONT,
          pointerEvents: 'none',
        }}
      >
        <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
        {panel}
        {expandedUmlPanel}
      </div>
    </>
  );
};

// ── ModelLibraryTable (main export) ────────────────────────────────────────

const DATE_OPTIONS: { value: MetaModelDateFilter; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
];

const SEARCH_SYNTAX_HINT =
  'Use GitHub-style syntax: name:test domain:engineering time:beforenow created:after:2023-01-01';

const SEARCH_PLACEHOLDER =
  'name:test domain:engineering time:beforenow created:after:2023-01-01';

const filterRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  marginBottom: 10,
  alignItems: 'center',
};

const filterLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  minWidth: 76,
  flexShrink: 0,
  fontFamily: APP_FONT,
};

const filterFieldStyle: React.CSSProperties = {
  ...sharedInputStyle,
  flex: 1,
  width: 'auto',
  padding: '9px 12px',
  fontSize: 13,
  background: '#ffffff',
};

const filterTagStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 10px',
  borderRadius: 999,
  background: '#f0faf8',
  border: `1px solid ${BRAND_COLOR}33`,
  color: BRAND_COLOR,
  fontSize: 12,
  fontWeight: 500,
  fontFamily: APP_FONT,
};

interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  dateFilter: MetaModelDateFilter;
  onDateFilterChange: (value: MetaModelDateFilter) => void;
  parsedFilters: ParsedMetaModelSearchFilter[];
  onAppendFilter: (key: 'name' | 'domain' | 'keywords' | 'created', value: string) => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  isOpen,
  onClose,
  search,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  parsedFilters,
  onAppendFilter,
  onSearchKeyDown,
  searchInputRef,
}) => {
  const panelRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const plainNameSearch = search.includes(':') ? '' : search;

  const submitQuickFilter = (
    key: 'domain' | 'keywords',
    input: HTMLInputElement | null,
  ) => {
    if (!input) return;
    const value = input.value.trim();
    if (!value) return;
    onAppendFilter(key, value);
    input.value = '';
  };

  const panel = (
    <dialog
      ref={panelRef}
      open
      aria-labelledby="advanced-search-title"
      onClose={onClose}
      onCancel={onClose}
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        margin: 0,
        padding: 0,
        border: '1px solid #e2e8f0',
        width: 'min(480px, calc(100vw - 48px))',
        maxHeight: 'min(85vh, 640px)',
        overflowY: 'auto',
        background: '#ffffff',
        borderRadius: 12,
        boxShadow: '0 20px 50px rgba(11, 23, 32, 0.18), 0 4px 14px rgba(11, 23, 32, 0.08)',
        fontFamily: APP_FONT,
        pointerEvents: 'auto',
        zIndex: 10001,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        background: 'linear-gradient(135deg, #049484, #037368)',
        borderRadius: '12px 12px 0 0',
      }}>
        <div id="advanced-search-title" style={{ fontSize: 15, fontWeight: 600, color: '#ffffff', letterSpacing: '-0.01em' }}>
          Advanced Search
        </div>
        <button
          type="button"
          aria-label="Close advanced search"
          onClick={onClose}
          style={{
            ...modalCloseButtonStyle,
            color: 'rgba(255,255,255,0.85)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
          }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: '18px 20px 20px' }}>
        {parsedFilters.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {parsedFilters.map((filter) => (
              <span key={`${filter.key}-${filter.value}`} style={filterTagStyle}>
                {filter.key}:{filter.value}
              </span>
            ))}
          </div>
        )}

        <div style={filterRowStyle}>
          <span style={filterLabelStyle}>Search:</span>
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            placeholder={SEARCH_PLACEHOLDER}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={onSearchKeyDown}
            style={filterFieldStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = BRAND_COLOR; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
          />
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', margin: '-2px 0 12px 86px', fontStyle: 'italic', lineHeight: 1.45 }}>
          {SEARCH_SYNTAX_HINT}
        </div>

        <div style={filterRowStyle}>
          <span style={filterLabelStyle}>Date:</span>
          <select
            value={dateFilter}
            onChange={(e) => onDateFilterChange(e.target.value as MetaModelDateFilter)}
            style={filterFieldStyle}
          >
            {DATE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Quick Filters
          </div>

          <div style={filterRowStyle}>
            <span style={filterLabelStyle}>Name:</span>
            <input
              type="text"
              placeholder="Filter by name..."
              value={plainNameSearch}
              onChange={(e) => {
                if (!e.target.value.includes(':')) {
                  onSearchChange(e.target.value);
                }
              }}
              style={filterFieldStyle}
            />
          </div>

          <div style={filterRowStyle}>
            <span style={filterLabelStyle}>Domain:</span>
            <input
              type="text"
              placeholder="Filter by domain..."
              style={filterFieldStyle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitQuickFilter('domain', e.currentTarget);
              }}
            />
          </div>

          <div style={filterRowStyle}>
            <span style={filterLabelStyle}>Keywords:</span>
            <input
              type="text"
              placeholder="Filter by keywords..."
              style={filterFieldStyle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitQuickFilter('keywords', e.currentTarget);
              }}
            />
          </div>

          <div style={filterRowStyle}>
            <span style={filterLabelStyle}>Date:</span>
            <input
              type="date"
              style={filterFieldStyle}
              onChange={(e) => {
                const dateValue = e.target.value;
                if (dateValue) onAppendFilter('created', dateValue);
              }}
            />
          </div>
        </div>
      </div>
    </dialog>
  );

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        pointerEvents: 'none',
      }}
    >
      {panel}
    </div>,
    document.body,
  );
};

export const ModelLibraryTable: React.FC<ModelLibraryTableProps> = ({ onModelOpen }) => {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<MetaModelDateFilter>('all');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [viewModel, setViewModel] = useState<any>(null);
  const [deletingModel, setDeletingModel] = useState<LibraryMetaModel | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const searchInputRef = useRef<HTMLInputElement>(null);
  /** Set right before a filter reset that's already covered by a fetch we just ran,
   *  so the mount/filter-change effect below doesn't race it with a stale re-fetch. */
  const skipNextAutoFetchRef = useRef(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const parsedFilters = useMemo(
    () => (debouncedSearch.trim() ? parseMetaModelSearchQuery(debouncedSearch) : []),
    [debouncedSearch],
  );

  const fetchModels = useCallback(async (options?: {
    searchQuery?: string;
    date?: MetaModelDateFilter;
    parsed?: ParsedMetaModelSearchFilter[];
  }) => {
    setLoading(true);
    setError('');
    try {
      const searchQuery = options?.searchQuery ?? debouncedSearch;
      const activeParsed = options?.parsed ?? (
        searchQuery.trim() ? parseMetaModelSearchQuery(searchQuery) : []
      );
      const activeDateFilter = options?.date ?? dateFilter;
      const filters = buildMetaModelFindFilters(searchQuery, activeParsed, activeDateFilter);
      const models = await fetchLibraryMetaModels(filters);
      setModels(models);
      setCurrentPage(1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, dateFilter]);

  useEffect(() => {
    if (skipNextAutoFetchRef.current) {
      skipNextAutoFetchRef.current = false;
      return;
    }
    void fetchModels();
  }, [fetchModels]);

  const clearAllFilters = useCallback(() => {
    setSearch('');
    setDebouncedSearch('');
    setDateFilter('all');
    setCurrentPage(1);
  }, []);

  const handleCreateSuccess = useCallback(async (createdPayload?: unknown) => {
    setShowCreate(false);
    setLoading(true);
    setError('');

    const payload = extractCreatePayload(createdPayload);
    const filters = buildMetaModelFindFilters('', [], 'all');

    try {
      const models = payload
        ? await fetchLibraryMetaModelsAfterCreate(filters, payload)
        : await fetchLibraryMetaModels(filters);
      setModels(models);
      setCurrentPage(1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load models after create');
    } finally {
      setLoading(false);
      // Reset filters after the authoritative post-create fetch has already landed,
      // so the mount/filter-change effect doesn't race it with a stale re-fetch
      // that could overwrite the newly created model with pre-creation data.
      skipNextAutoFetchRef.current = true;
      clearAllFilters();
    }
  }, [clearAllFilters]);

  const requestDeleteModel = useCallback((model: LibraryMetaModel) => {
    // Both rules are checked up front so a model that's already known to be
    // blocked never shows a "Delete" action at all — only the reason + Cancel.
    if (!model.isOwnedByCurrentUser) {
      setDeleteError('Only the owner of this model can delete it.');
    } else if (isModelReferencedByProjects(model)) {
      setDeleteError('This model is used by one or more projects and cannot be deleted.');
    } else {
      setDeleteError('');
    }
    setDeletingModel(model);
  }, []);

  const cancelDeleteModel = useCallback(() => {
    setDeletingModel(null);
    setDeleteError('');
  }, []);

  const performDelete = useCallback(async () => {
    if (!deletingModel) return;
    try {
      await apiService.deleteMetaModel(String(deletingModel.id));
      setModels(prev => prev.filter(m => m.id !== deletingModel.id));
      setDeletingModel(null);
      setDeleteError('');
      if (viewModel?.id === deletingModel.id) setViewModel(null);
    } catch (e: unknown) {
      // "Referenced by a project" can only be fully known by the backend (it
      // spans every V-SUM, not just ones visible to this user) — if it rejects
      // the request for either rule, switch to the same reason-only + Cancel
      // state instead of leaving an actionable "Delete" button up.
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete model');
    }
  }, [deletingModel, viewModel]);

  const isDeleteBlocked = !!deleteError;

  const appendSearchFilter = (key: 'name' | 'domain' | 'keywords' | 'created', value: string) => {
    setSearch(prev => appendMetaModelSearchToken(prev, key, value));
  };

  const hasActiveFilters = search.trim().length > 0 || dateFilter !== 'all';

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Tab') return;
    const completion = completeMetaModelSearchToken(e.currentTarget.value, e.currentTarget.selectionStart ?? 0);
    if (!completion) return;
    e.preventDefault();
    setSearch(completion.nextValue);
    requestAnimationFrame(() => {
      searchInputRef.current?.setSelectionRange(completion.nextCaret, completion.nextCaret);
    });
  };

  const totalPages = Math.ceil(models.length / itemsPerPage);
  const page = models.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const emptyRowStyle = { padding: '48px 16px', textAlign: 'center' as const, color: '#9ca3af', fontSize: 14 };
  let tableBodyRows: React.ReactNode;
  if (loading) {
    tableBodyRows = (
      <tr>
        <td colSpan={4} style={emptyRowStyle}>Loading...</td>
      </tr>
    );
  } else if (page.length === 0) {
    tableBodyRows = (
      <tr>
        <td colSpan={4} style={emptyRowStyle}>
          {search.trim()
            ? `No models match "${search.trim()}". Clear filters to see all models.`
            : 'No models yet. Upload a .ecore and .genmodel pair to get started.'}
        </td>
      </tr>
    );
  } else {
    tableBodyRows = page.map((model, idx) => (
      <TableRow
        key={model.id ?? idx}
        model={model}
        onView={() => {
          setViewModel(model);
          onModelOpen?.(model);
        }}
        onDelete={() => requestDeleteModel(model)}
      />
    ));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page header */}
      <div style={{ padding: '32px 40px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--v-text)', letterSpacing: '-0.02em' }}>Model Library</h1>
        <button type="button"
          onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: '#0B1720', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 4px rgba(11,23,32,0.25)', transition: 'background 0.15s', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#0B1720'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1e293b'; }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
          <span>Upload model</span>
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ padding: '20px 40px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowAdvancedSearch(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              border: '1px solid',
              borderColor: hasActiveFilters ? '#049484' : '#e5e7eb',
              borderRadius: 8,
              background: hasActiveFilters ? '#f0faf8' : '#ffffff',
              color: hasActiveFilters ? '#049484' : '#374151',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <SearchIcon />
            <span>Advanced Search</span>
            {hasActiveFilters && (
              <span style={{
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                borderRadius: 999,
                background: '#049484',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {parsedFilters.length || 1}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                clearAllFilters();
                void fetchModels({ searchQuery: '', date: 'all', parsed: [] });
              }}
              style={{
                padding: '8px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                background: '#fff',
                color: '#6b7280',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Clear filters
            </button>
          )}

          {search.trim() && (
            <span style={{ fontSize: 13, color: '#6b7280', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Active: {search.trim()}
            </span>
          )}
        </div>

        <AdvancedSearchModal
          isOpen={showAdvancedSearch}
          onClose={() => setShowAdvancedSearch(false)}
          search={search}
          onSearchChange={(value) => { setSearch(value); setCurrentPage(1); }}
          dateFilter={dateFilter}
          onDateFilterChange={(value) => { setDateFilter(value); setCurrentPage(1); }}
          parsedFilters={parsedFilters}
          onAppendFilter={appendSearchFilter}
          onSearchKeyDown={handleSearchKeyDown}
          searchInputRef={searchInputRef}
        />
      </div>

      {/* Table area */}
      <div style={{ flex: 1, padding: '16px 40px 24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {error && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ flex: 1, background: 'var(--v-surface)', border: '1px solid var(--v-border)', borderRadius: 12, overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--v-border-subtle)' }}>
                {['Name', 'Created', 'Projects', 'Actions'].map((col, i) => (
                  <th
                    key={col}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--v-text-muted)',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      background: 'var(--v-table-header)',
                      borderBottom: '1px solid var(--v-border-subtle)',
                      whiteSpace: 'nowrap',
                      width: i === 3 ? 80 : undefined,
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableBodyRows}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14 }}>
            <span style={{ fontSize: 13, color: 'var(--v-text-muted)' }}>
              {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, models.length)} of {models.length}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <PageBtn disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>←</PageBtn>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | 'dots')[]>((acc, p, i, arr) => {
                  if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('dots');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i, items) =>
                  p === 'dots'
                    ? <span key={`dots-${items[i - 1]}-${items[i + 1]}`} style={{ padding: '0 4px', color: '#9ca3af', fontSize: 13 }}>…</span>
                    : <PageBtn key={p} active={p === currentPage} onClick={() => setCurrentPage(p as number)}>{p}</PageBtn>
                )}
              <PageBtn disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>→</PageBtn>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateModelModal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
      {viewModel && (
        <ModelDetailModal
          model={viewModel}
          onClose={() => setViewModel(null)}
          onUpdated={() => { fetchModels(); }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deletingModel}
        title="Delete model"
        message={deleteError || `Do you really want to delete "${deletingModel?.name}"? This action cannot be undone.`}
        confirmText={isDeleteBlocked ? 'Cancel' : 'Delete'}
        cancelText="Cancel"
        singleAction={isDeleteBlocked}
        variant="danger"
        onConfirm={isDeleteBlocked ? cancelDeleteModel : performDelete}
        onCancel={cancelDeleteModel}
      />
    </div>
  );
};

// ── TableRow ────────────────────────────────────────────────────────────────

interface TableRowProps {
  model: any;
  onView: () => void;
  onDelete: () => void;
}

const TableRow: React.FC<TableRowProps> = ({ model, onView, onDelete }) => {
  const [hovered, setHovered] = useState(false);
  const hasProjects = isModelReferencedByProjects(model);

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onView}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView();
        }
      }}
      tabIndex={0}
      style={{ borderBottom: '1px solid var(--v-border-subtle)', background: hovered ? 'var(--v-surface-hover)' : 'var(--v-surface)', cursor: 'pointer', transition: 'background 0.1s' }}
    >
      <td style={{ padding: '13px 16px', fontSize: 14, fontWeight: 500, color: 'var(--v-text)' }}>{model.name}</td>
      <td style={{ padding: '13px 16px', fontSize: 14, color: 'var(--v-text-muted)' }}>{formatDate(model.createdAt)}</td>
      <td style={{ padding: '13px 16px' }}>
        {hasProjects ? (
          <span style={{ padding: '3px 10px', background: 'var(--v-surface-muted)', border: '1px solid var(--v-border)', borderRadius: 20, fontSize: 12, color: 'var(--v-text-secondary)', fontWeight: 500 }}>
            Projects
          </span>
        ) : (
          <span style={{ color: '#d1d5db', fontSize: 14 }}>--</span>
        )}
      </td>
      <td style={{ padding: '13px 16px' }}>
        <PortalRowActionsMenu
          minWidth={140}
          actions={[
            { label: 'View details', onClick: onView },
            ...(model.isOwnedByCurrentUser
              ? [{ label: 'Delete', onClick: onDelete, danger: true, dividerBefore: true }]
              : []),
          ]}
        />
      </td>
    </tr>
  );
};

// ── PageBtn helper ──────────────────────────────────────────────────────────

interface PageBtnProps {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const PageBtn: React.FC<PageBtnProps> = ({ children, active, disabled, onClick }) => {
  let color = 'var(--v-text)';
  if (active) {
    color = '#fff';
  } else if (disabled) {
    color = 'var(--v-text-faint)';
  }

  return (
  <button type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: '6px 11px',
      border: '1px solid',
      borderColor: active ? '#049484' : 'var(--v-border)',
      borderRadius: 7,
      background: active ? '#049484' : 'var(--v-surface)',
      color,
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      cursor: disabled ? 'not-allowed' : 'pointer',
      minWidth: 34,
    }}
  >
    {children}
  </button>
  );
};
