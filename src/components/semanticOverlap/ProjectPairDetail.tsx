import React, { useMemo } from 'react';
import { useOverlapResultViewState } from '../../hooks/useOverlapResultViewState';
import { shownResult } from '../../store/SemanticOverlap';
import { themeVars } from '../../theme/theme';
import { downloadTextAsFile } from '../../utils/downloadFile';
import { overlapResultToCsv, serializeOverlapResult } from '../../utils/semanticOverlap/overlapResult';
import type { PairDirection, PairOverlap } from '../../utils/semanticOverlap/overviewTypes';
import { OverlapResultPanel } from './OverlapResultPanel';
import { exportFileName } from './SemanticOverlapView';
import { secondaryButton } from './overlapButtonStyles';

export interface ProjectPairDetailProps {
  pair: PairOverlap;
  names: ReadonlyMap<string, string>;
  direction: PairDirection;
  onDirectionChange: (direction: PairDirection) => void;
  onBack: () => void;
}

const DIRECTION_STATE_LABELS = {
  pending: 'waiting',
  running: 'analysing…',
  done: '',
  failed: 'failed',
  cancelled: 'not analysed',
} as const;

/** Closer look at one pair of the project overview: the result views of either direction. */
export const ProjectPairDetail: React.FC<ProjectPairDetailProps> = ({ pair, names, direction, onDirectionChange, onBack }) => {
  const [nameA, nameB] = [names.get(pair.a) ?? pair.a, names.get(pair.b) ?? pair.b];
  const options: { direction: PairDirection; label: string }[] = [
    { direction: 'forward', label: `${nameA} → ${nameB}` },
    { direction: 'backward', label: `${nameB} → ${nameA}` },
  ];
  const fullResult = pair[direction].result;
  const { view, actions } = useOverlapResultViewState(fullResult?.id ?? null);
  const result = useMemo(() => (fullResult ? shownResult(fullResult, view.selectedAlternative) : null), [fullResult, view.selectedAlternative]);

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16, background: themeVars.pageBg, borderRadius: 12 }}>
      <div>
        <button type="button" onClick={onBack} style={{ ...secondaryButton, height: 32 }}>← Back to overview</button>
      </div>
      <header>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: themeVars.text }}>{nameA} ↔ {nameB}</h2>
      </header>

      <div role="radiogroup" aria-label="Direction" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {options.map(option => {
          const state = pair[option.direction].state;
          const selected = option.direction === direction;
          const note = DIRECTION_STATE_LABELS[state];
          return (
            <button
              key={option.direction}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={state !== 'done'}
              onClick={() => onDirectionChange(option.direction)}
              style={{
                ...secondaryButton, height: 36,
                background: selected ? themeVars.brandSoft : themeVars.surface,
                borderColor: selected ? '#049484' : themeVars.border,
                opacity: state === 'done' ? 1 : 0.6,
                cursor: state === 'done' ? 'pointer' : 'default',
              }}
            >
              {option.label}{note && ` (${note})`}
            </button>
          );
        })}
      </div>

      {fullResult && result ? (
        <>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              style={secondaryButton}
              onClick={() => downloadTextAsFile(serializeOverlapResult(fullResult), exportFileName(fullResult, 'json'), 'application/json;charset=utf-8')}
            >
              Export JSON
            </button>
            <button
              type="button"
              style={secondaryButton}
              onClick={() => downloadTextAsFile(
                overlapResultToCsv(fullResult, view.selectedAlternative === null ? undefined : { alternative: view.selectedAlternative }),
                exportFileName(fullResult, 'csv'), 'text/csv;charset=utf-8')}
            >
              Export CSV
            </button>
          </div>
          <OverlapResultPanel result={result} view={view} actions={actions} />
        </>
      ) : (
        <div role="status" style={{ padding: 24, textAlign: 'center', fontSize: 14, color: themeVars.textMuted, border: `1px dashed ${themeVars.border}`, borderRadius: 12 }}>
          {pair[direction].error ?? 'This direction has no result.'}
        </div>
      )}
    </div>
  );
};
