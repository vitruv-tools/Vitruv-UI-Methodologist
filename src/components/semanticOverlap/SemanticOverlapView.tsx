import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSemanticOverlapRun } from '../../hooks/useSemanticOverlapRun';
import { shownResult, useSemanticOverlapStore } from '../../store/SemanticOverlap';
import { themeVars } from '../../theme/theme';
import { fetchLibraryMetaModels, type LibraryMetaModel } from '../../utils/metaModelList';
import { downloadTextAsFile } from '../../utils/downloadFile';
import { overlapResultToCsv, serializeOverlapResult } from '../../utils/semanticOverlap/overlapResult';
import { approachOf } from '../../utils/semanticOverlap/approaches/registry';
import type { OverlapResult } from '../../utils/semanticOverlap/types';
import { AnalysisProgress } from './AnalysisProgress';
import { AnalysisSettingsPanel } from './AnalysisSettingsPanel';
import { ApproachSelector } from './ApproachSelector';
import { MetamodelPairPicker } from './MetamodelPairPicker';
import { OverlapResultPanel } from './OverlapResultPanel';
import { primaryButton, secondaryButton } from './overlapButtonStyles';
import { WordNetAttribution } from './WordNetAttribution';

const parseId = (value: string | null) => (value && /^\d+$/.test(value) ? Number(value) : null);

/** `<source>-<target>-overlap.<extension>`, restricted to safe file-name characters. */
export const exportFileName = (result: OverlapResult, extension: 'json' | 'csv') =>
  `${result.source.name}-${result.target.name}-overlap.${extension}`.replace(/[^A-Za-z0-9._-]/g, '_');

/** Compares two library metamodels and shows their semantic overlap. */
export const SemanticOverlapView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [models, setModels] = useState<LibraryMetaModel[] | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const store = useSemanticOverlapStore();
  const { start, cancel } = useSemanticOverlapRun();
  const busy = store.status === 'loading' || store.status === 'running';
  const settingsValid = approachOf(store.approach).validate(store.settings).length === 0;

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
  // The views show the selected alternative; the JSON export keeps the whole result.
  const fullResult = store.result;
  const result = useMemo(() => (fullResult ? shownResult(fullResult, store.selectedAlternative) : null),
    [fullResult, store.selectedAlternative]);

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
          style={{ ...primaryButton, opacity: !sourceModel || !targetModel || busy || !settingsValid ? 0.5 : 1 }}
          disabled={!sourceModel || !targetModel || busy || !settingsValid}
          onClick={() => { if (sourceModel && targetModel) void start(sourceModel, targetModel); }}
        >
          {result ? 'Run again' : 'Start analysis'}
        </button>
        <button
          type="button"
          style={{ ...secondaryButton, opacity: result ? 1 : 0.5 }}
          disabled={!result}
          onClick={() => fullResult && downloadTextAsFile(serializeOverlapResult(fullResult), exportFileName(fullResult, 'json'), 'application/json;charset=utf-8')}
        >
          Export JSON
        </button>
        <button
          type="button"
          style={{ ...secondaryButton, opacity: result ? 1 : 0.5 }}
          disabled={!result}
          onClick={() => fullResult && downloadTextAsFile(
            overlapResultToCsv(fullResult, store.selectedAlternative === null ? undefined : { alternative: store.selectedAlternative }),
            exportFileName(fullResult, 'csv'), 'text/csv;charset=utf-8')}
        >
          Export CSV
        </button>
      </div>

      <ApproachSelector value={store.approach} onChange={store.setApproach} disabled={busy} />

      <AnalysisSettingsPanel
        approach={store.approach}
        settings={store.settings}
        onChange={store.updateSettings}
        minScore={store.minScore}
        onMinScoreChange={store.setMinScore}
        disabled={busy}
      />

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

      {result && <OverlapResultPanel result={result} view={store} actions={store} />}

      <WordNetAttribution />
    </div>
  );
};
