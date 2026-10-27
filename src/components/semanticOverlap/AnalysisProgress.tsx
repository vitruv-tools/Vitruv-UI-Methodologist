import React from 'react';
import { themeVars } from '../../theme/theme';
import type { Progress, ProgressPhase } from '../../utils/semanticOverlap/types';

const PHASE_LABELS: Record<ProgressPhase, string> = {
  loading: 'Loading the metamodels…',
  lexicon: 'Loading WordNet synonyms…',
  profiling: 'Comparing names and structure…',
  ga: 'Searching globally (genetic algorithm)…',
  sa: 'Refining locally (simulated annealing)…',
  features: 'Matching attributes and references…',
};

/** Phase, progress bar and cancel button of a running analysis. */
export const AnalysisProgress: React.FC<{ progress: Progress | null; onCancel: () => void }> = ({ progress, onCancel }) => {
  const percent = Math.round((progress?.fraction ?? 0) * 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, border: `1px solid ${themeVars.border}`, borderRadius: 12, background: themeVars.surface }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 14, color: themeVars.text }}>{PHASE_LABELS[progress?.phase ?? 'loading']}</span>
        <button type="button" onClick={onCancel} style={{
          padding: '6px 14px', borderRadius: 8, border: `2px solid ${themeVars.border}`, background: themeVars.surface,
          color: themeVars.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
      <div role="progressbar" aria-label="Analysis progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
        style={{ height: 8, borderRadius: 4, background: themeVars.surfaceMuted, overflow: 'hidden' }}>
        <div style={{ width: `${percent}%`, height: '100%', background: '#049484', transition: 'width 0.2s' }} />
      </div>
      <span style={{ fontSize: 12, color: themeVars.textMuted }}>
        The search is randomised: without a fixed seed, results can vary slightly between runs.
      </span>
    </div>
  );
};
