import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../../services/api';
import { CreateModelModal } from './CreateModelModal';
import { ConfirmDialog } from './ConfirmDialog';
import { KeywordTagsInput } from './KeywordTagsInput';
import { UMLDiagram, UMLDiagramHandle } from '../canvas/UMLDiagram';
import { MetaModelFileDownloads } from './MetaModelFileDownloads';
import { useModalBodyLock } from './modalUtils';
import {
  METAMODEL_PREVIEW_LAYOUT_SCOPE,
  metaModelPreviewLayoutFileName,
} from '../../utils/metaModelPreview';
import { PortalRowActionsMenu } from './PortalRowActionsMenu';

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

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

// ── DropdownFilter ─────────────────────────────────────────────────────────

interface DropdownFilterProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}

const DropdownFilter: React.FC<DropdownFilterProps> = ({ label, options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);
  const isFiltered = value !== 'all';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          border: '1px solid',
          borderColor: isFiltered ? '#049484' : '#e5e7eb',
          borderRadius: 8,
          background: isFiltered ? '#f0faf8' : '#ffffff',
          color: isFiltered ? '#049484' : '#374151',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s',
        }}
      >
        <span>{isFiltered ? `${label}: ${selected?.label}` : label}</span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 200,
          minWidth: 160,
          overflow: 'hidden',
        }}>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                display: 'block',
                width: '100%',
                padding: '9px 14px',
                border: 'none',
                background: opt.value === value ? '#f0faf8' : 'transparent',
                color: opt.value === value ? '#049484' : '#374151',
                fontSize: 13,
                fontWeight: opt.value === value ? 600 : 400,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (opt.value !== value) (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb'; }}
              onMouseLeave={e => { if (opt.value !== value) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

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
  for (let i = 0; i < key.length; i++) h = key.charCodeAt(i) + ((h << 5) - h);
  return D_FALLBACK[Math.abs(h) % D_FALLBACK.length];
}

const DFieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, letterSpacing: '0.01em', fontFamily: FONT }}>{children}</div>
);

const DPreviewBtn: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({ title, onClick, children }) => {
  const [hov, setHov] = React.useState(false);
  return (
    <button title={title} onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
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
  const diagramRef = useRef<UMLDiagramHandle>(null);
  const theme = getDTheme(model.domain);

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
      await apiService.updateMetaModel(String(model.id), { name: form.name, description: form.description, domain: form.domain, keyword: form.keywords });
      setSuccess('Saved successfully');
      onUpdated();
      setTimeout(() => { setSuccess(''); setEditing(false); }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const panel = (
      <div
        data-model-detail-modal
        style={{ background: '#fff', borderRadius: 10, width: 'min(800px, 92vw)', height: 'min(640px, 88vh)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.10)', border: '1px solid #e2e8f0', fontFamily: FONT }}
        onMouseDown={e => e.stopPropagation()}
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
              Model Preview: <span style={{ color: '#374151', fontWeight: 600 }}>{model.name}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
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
            <button
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
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, fontFamily: FONT }}>Name</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={detailInputSt} onFocus={e => (e.currentTarget.style.borderColor = '#049484')} onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, fontFamily: FONT }}>Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...detailInputSt, resize: 'vertical', minHeight: 72 }} onFocus={e => (e.currentTarget.style.borderColor = '#049484')} onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, fontFamily: FONT }}>Domain</label>
                  <input value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} style={detailInputSt} onFocus={e => (e.currentTarget.style.borderColor = '#049484')} onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 5, fontFamily: FONT }}>Keywords</label>
                  <KeywordTagsInput keywords={form.keywords} onChange={kws => setForm(f => ({ ...f, keywords: kws }))} />
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
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', fontFamily: FONT, lineHeight: 1.4 }}>{model.name}</div>
                </div>
                {model.keyword?.length > 0 && (
                  <div>
                    <DFieldLabel>Keywords</DFieldLabel>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {model.keyword.map((kw: string) => (
                        <span key={kw} style={{ padding: '3px 10px', borderRadius: 20, background: theme.badge, color: theme.badgeText, fontSize: 11, fontWeight: 600, fontFamily: FONT }}>{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <DFieldLabel>Description</DFieldLabel>
                  <div style={{ fontSize: 13, color: '#374151', fontFamily: FONT, lineHeight: 1.7 }}>
                    {model.description || <span style={{ color: '#cbd5e1' }}>—</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                  <MetaModelFileDownloads
                    modelName={model.name}
                    ecoreFileId={model.ecoreFileId}
                    genModelFileId={model.genModelFileId}
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
          {/* Right — UML preview */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff' }}>
            {/* Label + zoom controls */}
            <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: FONT }}>UML Preview</span>
              {ecoreContent && (
                <div style={{ display: 'flex', gap: 4 }}>
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
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );

  if (embedded) {
    return (
      <>
        <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
        {panel}
      </>
    );
  }

  return (
    <div
      role="presentation"
      data-model-detail-backdrop
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}
      onMouseDown={(e) => {
        if (!(e.target as HTMLElement).closest('[data-model-detail-modal]')) onClose();
      }}
    >
      <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
      {panel}
    </div>
  );
};

// ── ModelLibraryTable (main export) ────────────────────────────────────────

const DATE_OPTIONS = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
];

export const ModelLibraryTable: React.FC<ModelLibraryTableProps> = ({ onModelOpen }) => {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typFilter, setTypFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [viewModel, setViewModel] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters: any = { ownedByUser: false };
      if (debouncedSearch.trim()) filters.name = debouncedSearch.trim();
      if (typFilter !== 'all') filters.domain = typFilter;
      if (dateFilter !== 'all') {
        const now = new Date();
        const from: Record<string, Date> = {
          today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          month: new Date(now.getFullYear(), now.getMonth(), 1),
          year: new Date(now.getFullYear(), 0, 1),
        };
        if (from[dateFilter]) filters.createdFrom = from[dateFilter].toISOString();
        filters.createdTo = now.toISOString();
      }
      const res = await apiService.findMetaModels(filters);
      setModels(res.data || []);
      setCurrentPage(1);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, typFilter, dateFilter]);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  // Derive unique domain values for the Typ filter
  const typOptions = [
    { value: 'all', label: 'All types' },
    ...Array.from(new Set(models.map(m => m.domain).filter(Boolean))).sort((a, b) => a!.localeCompare(b!)).map(d => ({ value: d, label: d })),
  ];

  const filtered = models.filter(m => typFilter === 'all' || m.domain === typFilter);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const page = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await apiService.deleteMetaModel(deletingId);
      setDeletingId(null);
      setDeleteError('');
      fetchModels();
    } catch (e: any) {
      setDeleteError(e?.message || 'Failed to delete');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page header */}
      <div style={{ padding: '32px 40px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>Model Library</h1>
        <button
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
      <div style={{ padding: '20px 40px 0', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none', display: 'flex' }}>
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            style={{ width: '100%', padding: '8px 12px 8px 34px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#374151', outline: 'none', boxSizing: 'border-box', background: '#fff', transition: 'border-color 0.15s' }}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#049484'; }}
            onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#e5e7eb'; }}
          />
        </div>

        <DropdownFilter
          label="Filter: By type"
          options={typOptions}
          value={typFilter}
          onChange={v => { setTypFilter(v); setCurrentPage(1); }}
        />
        <DropdownFilter
          label="Filter: By creation date"
          options={DATE_OPTIONS}
          value={dateFilter}
          onChange={v => { setDateFilter(v); setCurrentPage(1); }}
        />
      </div>

      {/* Table area */}
      <div style={{ flex: 1, padding: '16px 40px 24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {error && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ flex: 1, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                {['Name', 'Type', 'Created', 'Projects', 'Actions'].map((col, i) => (
                  <th
                    key={col}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#6b7280',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      background: '#fafafa',
                      borderBottom: '1px solid #f3f4f6',
                      whiteSpace: 'nowrap',
                      width: i === 4 ? 80 : undefined,
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '48px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                    Loading...
                  </td>
                </tr>
              ) : page.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '48px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                    {search ? 'No results for this search.' : 'No models yet.'}
                  </td>
                </tr>
              ) : (
                page.map((model, idx) => (
                  <TableRow
                    key={model.id ?? idx}
                    model={model}
                    onView={() => setViewModel(model)}
                    onDelete={() => setDeletingId(String(model.id))}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
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
                .map((p, i) =>
                  p === 'dots'
                    ? <span key={`dots-${i}`} style={{ padding: '0 4px', color: '#9ca3af', fontSize: 13 }}>…</span>
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
          onSuccess={() => { setShowCreate(false); fetchModels(); }}
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
        isOpen={!!deletingId}
        title="Delete model"
        message={deleteError ? `${deleteError}` : "Do you really want to delete this model? This action cannot be undone."}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => { setDeletingId(null); setDeleteError(''); }}
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
  const hasProjects = model.vsums?.length > 0 || model.projects?.length > 0;

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onView}
      style={{ borderBottom: '1px solid #f9fafb', background: hovered ? '#fafafa' : '#fff', cursor: 'pointer', transition: 'background 0.1s' }}
    >
      <td style={{ padding: '13px 16px', fontSize: 14, fontWeight: 500, color: '#111827' }}>{model.name}</td>
      <td style={{ padding: '13px 16px', fontSize: 14, color: '#6b7280' }}>{model.domain || '--'}</td>
      <td style={{ padding: '13px 16px', fontSize: 14, color: '#6b7280' }}>{formatDate(model.createdAt)}</td>
      <td style={{ padding: '13px 16px' }}>
        {hasProjects ? (
          <span style={{ padding: '3px 10px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 20, fontSize: 12, color: '#374151', fontWeight: 500 }}>
            Projects
          </span>
        ) : (
          <span style={{ color: '#d1d5db', fontSize: 14 }}>--</span>
        )}
      </td>
      <td style={{ padding: '13px 16px' }} onClick={e => e.stopPropagation()}>
        <PortalRowActionsMenu
          minWidth={140}
          actions={[
            { label: 'View details', onClick: onView },
            { label: 'Delete', onClick: onDelete, danger: true, dividerBefore: true },
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

const PageBtn: React.FC<PageBtnProps> = ({ children, active, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: '6px 11px',
      border: '1px solid',
      borderColor: active ? '#049484' : '#e5e7eb',
      borderRadius: 7,
      background: active ? '#049484' : '#fff',
      color: active ? '#fff' : disabled ? '#d1d5db' : '#374151',
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      cursor: disabled ? 'not-allowed' : 'pointer',
      minWidth: 34,
    }}
  >
    {children}
  </button>
);
