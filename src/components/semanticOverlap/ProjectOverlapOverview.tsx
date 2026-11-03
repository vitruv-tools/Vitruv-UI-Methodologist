import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Node } from 'reactflow';
import { useProjectSemanticOverlapStore } from '../../store/ProjectSemanticOverlap';
import { useSemanticOverlapStore } from '../../store/SemanticOverlap';
import { themeVars } from '../../theme/theme';
import { downloadTextAsFile } from '../../utils/downloadFile';
import { APPROACHES, approachOf } from '../../utils/semanticOverlap/approaches/registry';
import {
  isOutdated,
  overviewFileName,
  overviewMatrix,
  overviewToCsv,
  overviewWarnings,
  pairValues,
  rankPairs,
  serializeOverview,
  settingsKey,
} from '../../utils/semanticOverlap/overview';
import type { OverlapOverview, ProjectMetamodel } from '../../utils/semanticOverlap/overviewTypes';
import { projectMetamodels } from '../../utils/semanticOverlap/projectMetamodels';
import { AnalysisSettingsPanel } from './AnalysisSettingsPanel';
import { ApproachSelector } from './ApproachSelector';
import { OverlapPairList } from './OverlapPairList';
import { OverlapPairMatrix } from './OverlapPairMatrix';
import { primaryButton, secondaryButton } from './overlapButtonStyles';

export interface ProjectOverlapOverviewProps {
  vsumId: number;
  projectName: string | null;
  /** Canvas nodes of the project when the mode was entered. */
  nodes: Node[];
  /** Runs live in the always-mounted overlay, so that opening a pair does not stop them. */
  onStart: (metamodels: ProjectMetamodel[]) => Promise<void>;
  onCancel: () => void;
}

/** Scrolling body below the panel header of the Semantic overlap mode. */
export const PANEL_BODY: React.CSSProperties = {
  flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '12px 16px 18px',
  display: 'flex', flexDirection: 'column', gap: 16,
};

const panel: React.CSSProperties = {
  padding: 16, border: `1px solid ${themeVars.border}`, borderRadius: 12, background: themeVars.surface,
  display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0,
};

const approachText = (overview: OverlapOverview) => {
  const known = APPROACHES[overview.approach.id as keyof typeof APPROACHES];
  return `${known ? known.label : overview.approach.id} ${overview.approach.version}`;
};

const currentSettingsKey = () => {
  const { approach, settings } = useSemanticOverlapStore.getState();
  return settingsKey({ id: approach, version: APPROACHES[approach].version }, settings);
};

/** Pairwise semantic overlap of all metamodels of a project: ranked list and matrix. */
export const ProjectOverlapOverview: React.FC<ProjectOverlapOverviewProps> = ({ vsumId, projectName, nodes, onStart, onCancel }) => {
  const pairView = useSemanticOverlapStore();
  const overview = useProjectSemanticOverlapStore(state => state.overviews[vsumId]);
  const { openPair, setOutdated } = useProjectSemanticOverlapStore.getState();
  const [metamodels, setMetamodels] = useState<ProjectMetamodel[] | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    projectMetamodels(nodes)
      .then(list => { if (active) { setMetamodels(list); setReadError(null); } })
      .catch((error: unknown) => { if (active) setReadError(error instanceof Error ? error.message : String(error)); });
    return () => { active = false; };
  }, [nodes]);

  const busy = overview?.status === 'running';
  const key = currentSettingsKey();
  useEffect(() => {
    if (!overview || !metamodels || busy) return;
    const outdated = isOutdated(overview, metamodels, key);
    if (outdated !== overview.outdated) setOutdated(vsumId, outdated);
  }, [overview, metamodels, busy, key, vsumId, setOutdated]);

  // Coming back from a pair's closer look restores where the overview was scrolled to.
  const restoreScrollTop = overview?.listScrollTop ?? 0;
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = restoreScrollTop;
    // Only when the overview is shown again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const names = useMemo(() => new Map((overview?.metamodels ?? []).map(m => [m.key, m.name])), [overview?.metamodels]);
  const ranked = useMemo(() => (overview ? rankPairs(overview.pairs, names) : []), [overview, names]);
  const cells = useMemo(() => (overview ? overviewMatrix(overview.metamodels, overview.pairs) : []), [overview]);
  const warnings = useMemo(() => (overview ? overviewWarnings(overview.pairs) : []), [overview]);
  const hasValue = ranked.some(pair => pairValues(pair).value !== null);
  const settingsValid = approachOf(pairView.approach).validate(pairView.settings).length === 0;
  const tooFew = metamodels !== null && metamodels.length < 2;
  const canStart = metamodels !== null && !tooFew && !busy && settingsValid;
  const name = projectName ?? '';
  const pairCount = metamodels ? (metamodels.length * (metamodels.length - 1)) / 2 : 0;

  const open = (pairId: string) => openPair(vsumId, pairId, scrollRef.current?.scrollTop ?? 0);
  const run = () => { if (metamodels) void onStart(metamodels); };

  return (
    <div ref={scrollRef} className="themed-scroll" style={PANEL_BODY}>

      {readError && <div role="alert" style={{ color: themeVars.dangerText }}>{readError}</div>}

      {tooFew ? (
        <div role="status" style={{ padding: 24, textAlign: 'center', fontSize: 14, color: themeVars.textMuted, border: `1px dashed ${themeVars.border}`, borderRadius: 12 }}>
          This project needs at least two metamodels to compare.
        </div>
      ) : (
        <>
          <ApproachSelector value={pairView.approach} onChange={pairView.setApproach} disabled={busy} />
          <AnalysisSettingsPanel
            approach={pairView.approach}
            settings={pairView.settings}
            onChange={pairView.updateSettings}
            minScore={pairView.minScore}
            onMinScoreChange={pairView.setMinScore}
            disabled={busy}
          />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" style={{ ...primaryButton, opacity: canStart ? 1 : 0.5 }} disabled={!canStart} onClick={run}>
              {overview ? 'Run again' : 'Start analysis'}
            </button>
            <button
              type="button"
              style={{ ...secondaryButton, opacity: hasValue ? 1 : 0.5 }}
              disabled={!hasValue || !overview}
              onClick={() => overview && downloadTextAsFile(overviewToCsv(overview), overviewFileName(name, 'csv'), 'text/csv;charset=utf-8')}
            >
              Export CSV
            </button>
            <button
              type="button"
              style={{ ...secondaryButton, opacity: hasValue ? 1 : 0.5 }}
              disabled={!hasValue || !overview}
              onClick={() => overview && downloadTextAsFile(serializeOverview(overview, name), overviewFileName(name, 'json'), 'application/json;charset=utf-8')}
            >
              Export JSON
            </button>
            {metamodels && (
              <span style={{ fontSize: 13, color: themeVars.textSecondary }}>
                {metamodels.length} metamodels · {pairCount} {pairCount === 1 ? 'pair' : 'pairs'}
              </span>
            )}
          </div>
        </>
      )}

      {overview && busy && (
        <div style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, color: themeVars.text }}>
              {overview.progress.done} of {overview.progress.total} analyses done
              {overview.progress.current.length > 0 && ` · analysing ${overview.progress.current.join(', ')}`}
            </span>
            <button type="button" onClick={onCancel} style={{ ...secondaryButton, height: 32 }}>Cancel</button>
          </div>
          <div
            role="progressbar"
            aria-label="Overview progress"
            aria-valuemin={0}
            aria-valuemax={overview.progress.total}
            aria-valuenow={overview.progress.done}
            style={{ height: 8, borderRadius: 4, background: themeVars.surfaceMuted, overflow: 'hidden' }}
          >
            <div style={{ width: `${overview.progress.total === 0 ? 100 : (overview.progress.done / overview.progress.total) * 100}%`, height: '100%', background: '#049484', transition: 'width 0.2s' }} />
          </div>
        </div>
      )}

      {overview?.outdated && !busy && (
        <div role="status" style={{
          padding: 12, borderRadius: 10, border: `1px solid ${themeVars.warningBorder}`, background: themeVars.warningBg,
          color: themeVars.warningText, fontSize: 13, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span>The metamodels or the settings changed since this overview was computed.</span>
          <button type="button" onClick={run} disabled={!canStart} style={{ ...primaryButton, height: 32, padding: '4px 12px' }}>Run again</button>
        </div>
      )}

      {warnings.length > 0 && (
        <ul aria-label="Notices" style={{
          margin: 0, padding: '10px 12px 10px 28px', borderRadius: 10, border: `1px solid ${themeVars.warningBorder}`,
          background: themeVars.warningBg, color: themeVars.warningText, fontSize: 13,
        }}>
          {warnings.map(warning => <li key={warning}>{warning}</li>)}
        </ul>
      )}

      {overview && (
        <>
          <div style={{ fontSize: 12, color: themeVars.textMuted }}>
            Approach: {approachText(overview)}
            {overview.status === 'cancelled' && ' · cancelled'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, alignItems: 'start' }}>
            <section aria-label="Ranked pairs" style={panel}>
              <h3 style={{ margin: 0, fontSize: 15, color: themeVars.text }}>Pairs by overlap</h3>
              <OverlapPairList pairs={ranked} names={names} onOpen={open} />
            </section>
            <section aria-label="Matrix" style={panel}>
              <h3 style={{ margin: 0, fontSize: 15, color: themeVars.text }}>Matrix</h3>
              <OverlapPairMatrix metamodels={overview.metamodels} cells={cells} onOpen={open} />
            </section>
          </div>
        </>
      )}

      {!overview && !tooFew && metamodels !== null && (
        <div style={{ padding: 32, textAlign: 'center', fontSize: 14, color: themeVars.textMuted, border: `1px dashed ${themeVars.border}`, borderRadius: 12 }}>
          Start the analysis to compare all metamodels of this project.
        </div>
      )}
    </div>
  );
};
