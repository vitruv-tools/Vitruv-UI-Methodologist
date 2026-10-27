import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSemanticOverlapRun } from '../../hooks/useSemanticOverlapRun';
import { useSemanticOverlapStore, type OverlapTab } from '../../store/SemanticOverlap';
import { themeVars } from '../../theme/theme';
import { fetchLibraryMetaModels, type LibraryMetaModel } from '../../utils/metaModelList';
import { AnalysisProgress } from './AnalysisProgress';
import { CorrespondenceLinkDiagram } from './CorrespondenceLinkDiagram';
import { CorrespondenceList } from './CorrespondenceList';
import { MetamodelPairPicker } from './MetamodelPairPicker';
import { OverlapSummary } from './OverlapSummary';
import { SimilarityHeatmap } from './SimilarityHeatmap';
import { WordNetAttribution } from './WordNetAttribution';

const TABS: { id: OverlapTab; label: string }[] = [
  { id: 'diagram', label: 'Link diagram' },
  { id: 'heatmap', label: 'Heatmap' },
];

const primaryButton: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 9, border: 'none', background: '#0B1720', color: '#ffffff',
  fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 4px rgba(11,23,32,0.25)', height: 40,
};

const parseId = (value: string | null) => (value && /^\d+$/.test(value) ? Number(value) : null);

/** Compares two library metamodels and shows their semantic overlap. */
export const SemanticOverlapView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [models, setModels] = useState<LibraryMetaModel[] | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const store = useSemanticOverlapStore();
  const { start, cancel } = useSemanticOverlapRun();
  const busy = store.status === 'loading' || store.status === 'running';

  useEffect(() => {
    let active = true;
    fetchLibraryMetaModels({})
      .then(list => { if (active) setModels(list); })
      .catch(() => { if (active) setModelsError('The Model Library could not be loaded.'); });
    return () => { active = false; };
  }, []);

  // Pre-select from ?source=&target= once the library is known.
  useEffect(() => {
    if (!models) return;
    const requested = { source: parseId(searchParams.get('source')), target: parseId(searchParams.get('target')) };
    const known = (id: number | null) => id !== null && models.some(m => m.id === id);
    const unknown = (['source', 'target'] as const).filter(side => requested[side] !== null && !known(requested[side]));
    if (unknown.length > 0) setNotice('A metamodel from the link is not available in your Model Library and was ignored.');
    const { sourceId, targetId, setSource, setTarget } = useSemanticOverlapStore.getState();
    if (known(requested.source) && requested.source !== sourceId) setSource(requested.source);
    if (known(requested.target) && requested.target !== targetId) setTarget(requested.target);
    // Only on load of the library list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  const syncUrl = (sourceId: number | null, targetId: number | null) => {
    const next = new URLSearchParams();
    if (sourceId !== null) next.set('source', String(sourceId));
    if (targetId !== null) next.set('target', String(targetId));
    setSearchParams(next, { replace: true });
  };

  const byId = useMemo(() => new Map((models ?? []).map(m => [m.id, m])), [models]);
  const sourceModel = store.sourceId !== null ? byId.get(store.sourceId) : undefined;
  const targetModel = store.targetId !== null ? byId.get(store.targetId) : undefined;
  const result = store.result;

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: themeVars.text }}>Semantic overlap</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: themeVars.textSecondary }}>
          Compare two metamodels and see which classes most likely describe the same concept
          (search-based matching with structural and syntactic measures, Kessentini et al. 2014).
        </p>
      </header>

      {modelsError && <div role="alert" style={{ color: themeVars.dangerText }}>{modelsError}</div>}
      {notice && <div role="status" style={{ fontSize: 13, color: themeVars.warningText }}>{notice}</div>}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <MetamodelPairPicker
          models={models ?? []}
          sourceId={store.sourceId}
          targetId={store.targetId}
          disabled={busy || models === null}
          onSourceChange={id => { store.setSource(id); syncUrl(id, store.targetId); }}
          onTargetChange={id => { store.setTarget(id); syncUrl(store.sourceId, id); }}
          onSwap={() => { store.swap(); syncUrl(store.targetId, store.sourceId); }}
        />
        <button
          type="button"
          style={{ ...primaryButton, opacity: !sourceModel || !targetModel || busy ? 0.5 : 1 }}
          disabled={!sourceModel || !targetModel || busy}
          onClick={() => { if (sourceModel && targetModel) void start(sourceModel, targetModel); }}
        >
          {result ? 'Run again' : 'Start analysis'}
        </button>
      </div>

      {busy && <AnalysisProgress progress={store.progress} onCancel={cancel} />}

      {store.status === 'failed' && (
        <div role="alert" style={{
          padding: 12, borderRadius: 10, border: `1px solid ${themeVars.dangerBorder}`,
          background: themeVars.dangerBg, color: themeVars.dangerText, fontSize: 13, display: 'flex', gap: 12, alignItems: 'center',
        }}>
          <span>{store.error}</span>
          {sourceModel && targetModel && (
            <button type="button" onClick={() => void start(sourceModel, targetModel)} style={{ ...primaryButton, height: 32, padding: '4px 12px' }}>
              Retry
            </button>
          )}
        </div>
      )}

      {!result && !busy && store.status !== 'failed' && (
        <div style={{ padding: 32, textAlign: 'center', fontSize: 14, color: themeVars.textMuted, border: `1px dashed ${themeVars.border}`, borderRadius: 12 }}>
          Choose a source and a target metamodel, then start the analysis.
        </div>
      )}

      {result && (
        <>
          <OverlapSummary result={result} />
          <div role="tablist" aria-label="Result views" style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${themeVars.border}` }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={store.activeTab === tab.id}
                onClick={() => store.setActiveTab(tab.id)}
                style={{
                  padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14,
                  fontWeight: store.activeTab === tab.id ? 700 : 500,
                  color: store.activeTab === tab.id ? themeVars.text : themeVars.textSecondary,
                  borderBottom: `2px solid ${store.activeTab === tab.id ? '#049484' : 'transparent'}`,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(320px, 2fr)', gap: 16, minHeight: 480 }}>
            <div role="tabpanel" style={{ border: `1px solid ${themeVars.border}`, borderRadius: 12, overflow: 'hidden', background: themeVars.workspaceBg, height: 560 }}>
              {store.activeTab === 'diagram' ? (
                <CorrespondenceLinkDiagram
                  result={result}
                  minScore={store.minScore}
                  selectedId={store.selectedCorrespondenceId}
                  collapsedUnmatched={store.collapsedUnmatched}
                  onSelect={store.selectCorrespondence}
                  onToggleUnmatched={store.setCollapsedUnmatched}
                />
              ) : (
                <SimilarityHeatmap
                  result={result}
                  minScore={store.minScore}
                  selectedId={store.selectedCorrespondenceId}
                  onSelect={store.selectCorrespondence}
                  onCellFocus={store.setHoveredCell}
                />
              )}
            </div>
            <div style={{ height: 560 }}>
              <CorrespondenceList
                result={result}
                minScore={store.minScore}
                selectedId={store.selectedCorrespondenceId}
                onSelect={store.selectCorrespondence}
              />
            </div>
          </div>
        </>
      )}

      <WordNetAttribution />
    </div>
  );
};
