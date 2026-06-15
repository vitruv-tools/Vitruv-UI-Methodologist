import React, { useEffect, useRef, useState } from 'react';
import { UMLDiagram, UMLDiagramHandle, UmlDiagramSaveContext } from './UMLDiagram';
import { FloatingUMLPanel } from './FloatingUMLPanel';
import { MetaModelFileDownloads } from '../ui/MetaModelFileDownloads';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  METAMODEL_PREVIEW_LAYOUT_SCOPE,
  metaModelPreviewLayoutFileName,
} from '../../utils/metaModelPreview';

const FONT = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const DARK = '#1e293b';

export interface DrawerModel {
  id: number;
  name: string;
  sourceId?: number;
  domain?: string;
  ecoreFileId?: number;
  genModelFileId?: number;
  ecoreContent?: string;
  inProject?: boolean;
  description?: string;
  keyword?: string[];
  createdAt?: string;
}

interface ModelDrawerProps {
  models: DrawerModel[];
  addedModelIds?: Set<number>;
  loading?: boolean;
  onClose: () => void;
  onAddModel: (model: DrawerModel) => void;
  myLibraryModels?: DrawerModel[];
  publicLibraryModels?: DrawerModel[];
  /** Callback to fetch raw ecore content by file id */
  onFetchFile?: (fileId: number) => Promise<string>;
  /** Delete a metamodel from the user's library (My Library tab only) */
  onDeleteModel?: (model: DrawerModel) => Promise<void>;
}

// ── color scheme per domain ───────────────────────────────────────────────────

interface DomainTheme {
  bg: string;
  icon: string;
  badge: string;
  badgeText: string;
}

const THEMES: Record<string, DomainTheme> = {
  default: { bg: '#eef2ff', icon: '#6366f1', badge: '#e0e7ff', badgeText: '#4338ca' },
  computer: { bg: '#eff6ff', icon: '#3b82f6', badge: '#dbeafe', badgeText: '#1d4ed8' },
  target: { bg: '#f0fdf4', icon: '#10b981', badge: '#d1fae5', badgeText: '#065f46' },
  modell: { bg: '#faf5ff', icon: '#8b5cf6', badge: '#ede9fe', badgeText: '#5b21b6' },
  model: { bg: '#faf5ff', icon: '#8b5cf6', badge: '#ede9fe', badgeText: '#5b21b6' },
  red: { bg: '#fef2f2', icon: '#ef4444', badge: '#fee2e2', badgeText: '#b91c1c' },
  orange: { bg: '#fff7ed', icon: '#f97316', badge: '#fed7aa', badgeText: '#9a3412' },
  teal: { bg: '#f0fdfa', icon: '#14b8a6', badge: '#ccfbf1', badgeText: '#0f766e' },
};

const FALLBACK_PALETTE: DomainTheme[] = [
  { bg: '#fef9ec', icon: '#d97706', badge: '#fef3c7', badgeText: '#92400e' },
  { bg: '#fdf4ff', icon: '#a855f7', badge: '#f3e8ff', badgeText: '#7e22ce' },
  { bg: '#f0f9ff', icon: '#0ea5e9', badge: '#e0f2fe', badgeText: '#0369a1' },
  { bg: '#fff0f5', icon: '#ec4899', badge: '#fce7f3', badgeText: '#9d174d' },
];

function getTheme(domain?: string): DomainTheme {
  const key = domain?.toLowerCase().trim() || 'default';
  if (THEMES[key]) return THEMES[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = key.charCodeAt(i) + ((h << 5) - h);
  return FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length];
}

const formatDate = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};


// ── ModelDrawer ───────────────────────────────────────────────────────────────

export const ModelDrawer: React.FC<ModelDrawerProps> = ({
  models, addedModelIds = new Set(), loading, onClose, onAddModel,
  myLibraryModels = [], publicLibraryModels = [], onFetchFile, onDeleteModel,
}) => {
  const [libTab, setLibTab] = useState<'my' | 'public'>('my');
  const [search, setSearch] = useState('');
  const [domainFilter, setDomain] = useState<string | null>(null);
  const [detailModel, setDetail] = useState<DrawerModel | null>(null);
  const [deletingModel, setDeletingModel] = useState<DrawerModel | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const onCanvas = models.filter(m => addedModelIds.has(m.id));
  const rawLib = libTab === 'my' ? myLibraryModels : publicLibraryModels;

  const domains = Array.from(
    new Set(rawLib.filter(m => !addedModelIds.has(m.id) && m.domain).map(m => m.domain!))
  ).sort((a, b) => a.localeCompare(b));

  const fromLibrary = rawLib
    .filter(m => !addedModelIds.has(m.id))
    .filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()))
    .filter(m => !domainFilter || m.domain === domainFilter);

  const switchTab = (tab: 'my' | 'public') => {
    setLibTab(tab);
    setSearch('');
    setDomain(null);
  };

  const openDetail = (model: DrawerModel) => setDetail(model);
  const closeDetail = () => setDetail(null);

  const handleConfirmDelete = async () => {
    if (!deletingModel || !onDeleteModel) return;
    try {
      await onDeleteModel(deletingModel);
      setDeletingModel(null);
      setDeleteError('');
      closeDetail();
    } catch (e: any) {
      setDeleteError(e?.message || 'Failed to delete');
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', background: '#ffffff', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>

      {/* ── Header ── */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        gap: 8,
      }}>
        {detailModel ? (
          <button
            onClick={closeDetail}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              border: 'none', background: 'none', cursor: 'pointer',
              color: DARK, fontSize: 13, fontWeight: 600, padding: '2px 0',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
            Model Library
          </span>
        )}

        <button
          onClick={onClose}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: '#94a3b8', fontSize: 14, lineHeight: 1, padding: '3px 5px',
            borderRadius: 5, transition: 'all 0.1s', marginLeft: 'auto',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9'; (e.currentTarget as HTMLButtonElement).style.color = '#475569'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {detailModel ? (
          <DetailView
            model={detailModel}
            onFetchFile={onFetchFile}
            onAddModel={onAddModel}
            addedModelIds={addedModelIds}
            onDelete={libTab === 'my' && onDeleteModel ? () => setDeletingModel(detailModel) : undefined}
          />
        ) : (
          <LibraryView
            loading={!!loading}
            onCanvas={onCanvas}
            libTab={libTab}
            switchTab={switchTab}
            search={search}
            setSearch={setSearch}
            domains={domains}
            domainFilter={domainFilter}
            setDomain={setDomain}
            fromLibrary={fromLibrary}
            onAddModel={onAddModel}
            onOpenDetail={openDetail}
          />
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deletingModel}
        title="Delete model"
        message={deleteError || `Do you really want to delete "${deletingModel?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => { setDeletingModel(null); setDeleteError(''); }}
      />
    </div>
  );
};

// ── LibraryView ───────────────────────────────────────────────────────────────

interface LibraryViewProps {
  loading: boolean;
  onCanvas: DrawerModel[];
  libTab: 'my' | 'public';
  switchTab: (t: 'my' | 'public') => void;
  search: string;
  setSearch: (v: string) => void;
  domains: string[];
  domainFilter: string | null;
  setDomain: (d: string | null) => void;
  fromLibrary: DrawerModel[];
  onAddModel: (m: DrawerModel) => void;
  onOpenDetail: (m: DrawerModel) => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({
  loading, onCanvas, libTab, switchTab, search, setSearch,
  domains, domainFilter, setDomain, fromLibrary, onAddModel, onOpenDetail,
}) => (
  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
    {loading ? (
      <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ width: 22, height: 22, border: '2.5px solid #e2e8f0', borderTop: `2.5px solid ${DARK}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        <span style={{ fontSize: 12 }}>Loading...</span>
      </div>
    ) : (
      <>
        {/* On canvas */}
        <div style={{ padding: '10px 14px 0' }}>
          <SectionLabel>On canvas</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
            {onCanvas.length === 0 ? (
              <div style={{ padding: '8px 4px', textAlign: 'center', color: '#cbd5e1', fontSize: 11 }}>
                No models on canvas
              </div>
            ) : (
              onCanvas.map(m => (
                <ModelCard key={m.id} model={m} onCanvas onAdd={onAddModel} onOpenDetail={onOpenDetail} />
              ))
            )}
          </div>
        </div>

        {/* Library */}
        <div style={{ borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ padding: '10px 14px 0', flexShrink: 0 }}>
            {/* Tab strip */}
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: 10 }}>
              {(['my', 'public'] as const).map(tab => (
                <button key={tab} onClick={() => switchTab(tab)} style={{
                  flex: 1, padding: '7px 0', border: 'none', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase',
                  background: libTab === tab ? DARK : '#f8fafc',
                  color: libTab === tab ? '#fff' : '#94a3b8',
                  transition: 'all 0.15s',
                }}>
                  {tab === 'my' ? 'My Library' : 'Public Library'}
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search models…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 28px 8px 30px',
                  border: '1.5px solid #e2e8f0', borderRadius: 8,
                  fontSize: 12, color: '#0f172a', background: '#f8fafc',
                  outline: 'none', fontFamily: FONT, transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = DARK)}
                onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: '#94a3b8', fontSize: 14, lineHeight: 1, padding: 2,
                }}>✕</button>
              )}
            </div>

            {/* Domain chips */}
            {domains.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                {domains.map(domain => {
                  const active = domainFilter === domain;
                  const theme = getTheme(domain);
                  return (
                    <button key={domain} onClick={() => setDomain(active ? null : domain)} style={{
                      padding: '3px 9px', border: 'none', borderRadius: 20,
                      fontSize: 10, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.03em',
                      background: active ? theme.badge : '#f1f5f9',
                      color: active ? theme.badgeText : '#64748b',
                      transition: 'all 0.12s',
                      outline: active ? `1.5px solid ${theme.icon}40` : 'none',
                    }}>
                      {domain}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Results */}
          <div style={{ padding: '0 14px 14px', flex: 1 }}>
            {fromLibrary.length === 0 ? (
              <div style={{ padding: '24px 4px', textAlign: 'center', color: '#cbd5e1', fontSize: 11 }}>
                {search || domainFilter ? 'No models match your filter' : 'No models available'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {fromLibrary.map(m => (
                  <ModelCard key={m.id} model={m} onCanvas={false} onAdd={onAddModel} onOpenDetail={onOpenDetail} />
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    )}
  </div>
);

// ── DetailView ────────────────────────────────────────────────────────────────

interface DetailViewProps {
  model: DrawerModel;
  onFetchFile?: (fileId: number) => Promise<string>;
  onAddModel: (m: DrawerModel) => void;
  addedModelIds: Set<number>;
  onDelete?: () => void;
}

const DetailView: React.FC<DetailViewProps> = ({ model, onFetchFile, onAddModel, addedModelIds, onDelete }) => {
  const [ecoreContent, setEcoreContent] = useState<string | null>(model.ecoreContent ?? null);
  const [ecoreFileId, setEcoreFileId] = useState<number | undefined>(model.ecoreFileId);
  const [fetchError, setFetchError] = useState(false);
  const [fetchingUml, setFetchingUml] = useState(false);
  const [umlExpanded, setUmlExpanded] = useState(false);
  const diagramRef = useRef<UMLDiagramHandle>(null);
  const theme = getTheme(model.domain);
  const isOnCanvas = addedModelIds.has(model.id);

  const umlSaveContext: UmlDiagramSaveContext | undefined =
    model.id && ecoreFileId
      ? {
          metaModelId: String(model.id),
          ecoreFileId,
          modelName: model.name,
          saveTarget: 'library',
          metaModelMetadata: {
            description: model.description || '',
            domain: model.domain || '',
            keyword: model.keyword || [],
            genModelFileId: model.genModelFileId,
          },
          onSaved: ({ ecoreContent: saved, ecoreFileId: newFileId }) => {
            setEcoreContent(saved);
            setEcoreFileId(newFileId);
          },
        }
      : undefined;

  useEffect(() => {
    if (ecoreContent || !model.ecoreFileId || !onFetchFile) return;
    setFetchingUml(true);
    onFetchFile(model.ecoreFileId)
      .then(c => setEcoreContent(c))
      .catch(() => setFetchError(true))
      .finally(() => setFetchingUml(false));
  }, [model.ecoreFileId, ecoreContent, onFetchFile]);

  useEffect(() => {
    if (!ecoreContent) return;
    const t = setTimeout(() => diagramRef.current?.fitToView(), 150);
    return () => clearTimeout(t);
  }, [ecoreContent, model.id, model.name]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Banner ── */}
      <div style={{ padding: '14px 16px', background: '#ffffff', borderBottom: '1px solid #f1f5f9', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, overflow: 'hidden' }}>
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
          <path d="M16 5L27 11V21L16 27L5 21V11L16 5Z" stroke="#049484" strokeWidth="1.6" fill="#04948422" strokeLinejoin="round" />
          <path d="M16 5V27" stroke="#049484" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M5 11L27 11" stroke="#049484" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M16 5L5 11L16 17L27 11L16 5Z" stroke="#049484" strokeWidth="1.3" fill="#04948418" strokeLinejoin="round" />
        </svg>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
          Model Preview: <span style={{ color: '#374151', fontWeight: 600 }}>{model.name}</span>
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left — fields */}
        <div style={{
          width: 280, flexShrink: 0,
          borderRight: '1px solid #f1f5f9',
          overflowY: 'auto',
          padding: '20px 22px',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>

          {/* Name */}
          <div>
            <FieldLabel>Name</FieldLabel>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', fontFamily: FONT, lineHeight: 1.4 }}>
              {model.name}
            </div>
          </div>

          {/* Keywords */}
          {model.keyword && model.keyword.length > 0 && (
            <div>
              <FieldLabel>Keywords</FieldLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {model.keyword.map(kw => (
                  <span key={kw} style={{
                    padding: '3px 10px', borderRadius: 20,
                    background: theme.badge, color: theme.badgeText,
                    fontSize: 11, fontWeight: 600,
                  }}>{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div style={{ flex: 1 }}>
            <FieldLabel>Description</FieldLabel>
            <div style={{ fontSize: 13, color: '#374151', fontFamily: FONT, lineHeight: 1.7 }}>
              {model.description || <span style={{ color: '#cbd5e1' }}>—</span>}
            </div>
          </div>

          <MetaModelFileDownloads
            modelName={model.name}
            ecoreFileId={model.ecoreFileId}
            genModelFileId={model.genModelFileId}
            labelStyle={{
              fontSize: 11, fontWeight: 700, color: '#374151',
              marginBottom: 5, letterSpacing: '0.01em', fontFamily: FONT,
            }}
          />

          {/* Created */}
          {model.createdAt && (
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
              <FieldLabel>Created</FieldLabel>
              <div style={{ fontSize: 13, color: '#64748b' }}>{formatDate(model.createdAt)}</div>
            </div>
          )}

          {/* Add / on canvas / delete */}
          <div style={{ paddingTop: model.createdAt ? 0 : 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {isOnCanvas ? (
              <div style={{
                padding: '9px 0', borderRadius: 8,
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                color: '#15803d', fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" fill="#dcfce7" stroke="#86efac" strokeWidth="1.2" />
                  <polyline points="5,8.5 7,10.5 11,6" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
                Already on canvas
              </div>
            ) : (
              <button
                onClick={() => onAddModel(model)}
                style={{
                  width: '100%', padding: '9px 0', border: 'none', borderRadius: 8,
                  background: DARK, color: '#fff', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'background 0.15s', fontFamily: FONT,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
                onMouseLeave={e => (e.currentTarget.style.background = DARK)}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" />
                </svg>
                Add to canvas
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                title="Delete meta-model"
                style={{
                  width: '100%', padding: '9px 0', border: '1px solid #fecaca', borderRadius: 8,
                  background: '#fff', color: '#dc2626', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'background 0.15s', fontFamily: FONT,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete model
              </button>
            )}
          </div>
        </div>

        {/* Right — UML preview */}
        {/* Right — UML preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff' }}>
          {/* Label + zoom controls */}
          <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: FONT }}>UML</span>
            {ecoreContent && (
              <div style={{ display: 'flex', gap: 4 }}>
                <PreviewBtn title="Open full-screen UML editor" onClick={() => setUmlExpanded(true)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </PreviewBtn>
                <PreviewBtn title="Zoom in" onClick={() => diagramRef.current?.zoomIn()}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </PreviewBtn>
                <PreviewBtn title="Zoom out" onClick={() => diagramRef.current?.zoomOut()}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </PreviewBtn>
                <PreviewBtn title="Fit to view" onClick={() => diagramRef.current?.fitToView()}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                    <path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                  </svg>
                </PreviewBtn>
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
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 12, fontFamily: FONT }}>
                  Could not load UML preview
                </div>
              )}
              {!fetchingUml && !fetchError && !ecoreContent && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 12, fontFamily: FONT }}>
                  No diagram available
                </div>
              )}
              {ecoreContent && (
                <UMLDiagram
                  ref={diagramRef}
                  ecoreContent={ecoreContent}
                  fileName={metaModelPreviewLayoutFileName(model.id, model.name)}
                  layoutScopeId={METAMODEL_PREVIEW_LAYOUT_SCOPE}
                  saveContext={umlSaveContext}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {umlExpanded && ecoreContent && (
        <FloatingUMLPanel
          id={`metamodel-drawer-${model.id}`}
          title={model.name}
          fileName={metaModelPreviewLayoutFileName(model.id, model.name)}
          layoutScopeId={METAMODEL_PREVIEW_LAYOUT_SCOPE}
          ecoreContent={ecoreContent}
          saveContext={umlSaveContext}
          onClose={() => setUmlExpanded(false)}
          onFocus={() => {}}
          ecoreFileId={ecoreFileId}
          fetchEcoreFile={onFetchFile}
          onEcoreContentUpdated={(content) => setEcoreContent(content)}
          zIndex={10001}
        />
      )}
    </div>
  );
};

// ── FieldLabel / PreviewBtn ───────────────────────────────────────────────────

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 700, color: '#374151',
    marginBottom: 5, letterSpacing: '0.01em', fontFamily: FONT,
  }}>
    {children}
  </div>
);

const PreviewBtn: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({ title, onClick, children }) => {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      title={title} onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 24, height: 24, border: '1px solid #e2e8f0', borderRadius: 6,
        background: hov ? '#f1f5f9' : '#fff', color: hov ? '#0f172a' : '#64748b',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s',
      }}
    >
      {children}
    </button>
  );
};

// ── SectionLabel ──────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 10, fontWeight: 700, color: '#94a3b8',
    letterSpacing: '0.06em', textTransform: 'uppercase',
    padding: '2px 2px 6px',
  }}>
    {children}
  </div>
);

// ── ModelCard ─────────────────────────────────────────────────────────────────

interface ModelCardProps {
  model: DrawerModel;
  onCanvas: boolean;
  onAdd: (model: DrawerModel) => void;
  onOpenDetail: (model: DrawerModel) => void;
}

const ModelCard: React.FC<ModelCardProps> = ({ model, onCanvas, onAdd, onOpenDetail }) => {
  const [hovered, setHovered] = React.useState(false);
  const theme = getTheme(model.domain);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onOpenDetail(model);
  };

  if (onCanvas) {
    return (
      <div
        title="Right-click for details"
        onContextMenu={handleContextMenu}
        style={{
          display: 'flex', flexDirection: 'row', alignItems: 'center',
          gap: 10, padding: '7px 10px', borderRadius: 8,
          background: '#f8fafc', border: '1.5px solid #e2e8f0',
          width: '100%', boxSizing: 'border-box', cursor: 'context-menu',
        }}
      >
        {/* Same BoxIcon as library cards, muted */}
        <div style={{ flexShrink: 0 }}>
          <BoxIcon color={theme.icon} size={26} />
        </div>

        {/* Name — fixed left column */}
        <div style={{ flex: '0 0 30%', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
          {model.name}
        </div>

        {/* Domain */}
        <div style={{ flex: '0 0 22%', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {model.domain ? (
            <span style={{
              padding: '2px 7px', borderRadius: 20,
              background: theme.badge, color: theme.badgeText,
              fontSize: 9, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase',
            }}>{model.domain}</span>
          ) : <span style={{ color: '#e2e8f0' }}>—</span>}
        </div>

        {/* Date */}
        <div style={{ flex: '0 0 18%', minWidth: 0, fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
          {formatDate(model.createdAt) ?? '—'}
        </div>

        {/* Keywords count */}
        <div style={{ flex: '0 0 16%', minWidth: 0, fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
          {model.keyword && model.keyword.length > 0 ? `${model.keyword.length} kw` : '—'}
        </div>

        {/* Checkmark */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginLeft: 'auto' }}>
          <circle cx="8" cy="8" r="7" fill="#dcfce7" stroke="#86efac" strokeWidth="1.2" />
          <polyline points="5,8.5 7,10.5 11,6" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
    );
  }

  return (
    <button
      onClick={() => onAdd(model)}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Click to add · Right-click for details"
      style={{
        display: 'flex', flexDirection: 'row', alignItems: 'center',
        gap: 10, padding: '7px 10px', border: 'none', borderRadius: 8,
        background: hovered ? shadeDown(theme.bg) : theme.bg,
        cursor: 'pointer', transition: 'all 0.14s',
        boxShadow: hovered ? '0 3px 10px rgba(0,0,0,0.10)' : '0 1px 3px rgba(0,0,0,0.05)',
        width: '100%', textAlign: 'left', overflow: 'hidden', boxSizing: 'border-box',
      }}
    >
      {/* BoxIcon */}
      <div style={{ flexShrink: 0 }}>
        <BoxIcon color={theme.icon} size={26} />
      </div>

      {/* Name */}
      <div style={{ flex: '0 0 30%', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
        {model.name}
      </div>

      {/* Domain chip */}
      <div style={{ flex: '0 0 22%', minWidth: 0 }}>
        {model.domain ? (
          <span style={{
            padding: '2px 7px', borderRadius: 20,
            background: theme.badge, color: theme.badgeText,
            fontSize: 9, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase',
          }}>{model.domain}</span>
        ) : <span style={{ color: '#e2e8f0', fontSize: 10 }}>—</span>}
      </div>

      {/* Date */}
      <div style={{ flex: '0 0 18%', minWidth: 0, fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
        {formatDate(model.createdAt) ?? '—'}
      </div>

      {/* Keywords count */}
      <div style={{ flex: '0 0 16%', minWidth: 0, fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
        {model.keyword && model.keyword.length > 0 ? `${model.keyword.length} kw` : '—'}
      </div>
    </button>
  );
};

// ── helpers ───────────────────────────────────────────────────────────────────

// ── BoxIcon ───────────────────────────────────────────────────────────────────

const BoxIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 38 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <path d="M16 5L27 11V21L16 27L5 21V11L16 5Z" stroke={color} strokeWidth="1.6" fill={color + '22'} strokeLinejoin="round" />
    <path d="M16 5V27" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    <path d="M5 11L27 11" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    <path d="M16 5L5 11L16 17L27 11L16 5Z" stroke={color} strokeWidth="1.3" fill={color + '18'} strokeLinejoin="round" />
  </svg>
);

// ── helpers ───────────────────────────────────────────────────────────────────

function shadeDown(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const d = (v: number) => Math.max(0, v - 12).toString(16).padStart(2, '0');
    return `#${d(r)}${d(g)}${d(b)}`;
  } catch { return hex; }
}
