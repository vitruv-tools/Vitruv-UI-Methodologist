import React from 'react';
import { themeVars } from '../../theme/theme';
import type { ElementRef, OverlapResult } from '../../utils/semanticOverlap/types';

/** Simple names, qualified where two classes of the list share a simple name. */
function displayNames(refs: readonly ElementRef[]): string[] {
  const counts = new Map<string, number>();
  refs.forEach(ref => counts.set(ref.name, (counts.get(ref.name) ?? 0) + 1));
  return refs.map(ref => ((counts.get(ref.name) ?? 0) > 1 ? ref.qualifiedName : ref.name));
}

const Figure: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ padding: '10px 14px', border: `1px solid ${themeVars.border}`, borderRadius: 10, background: themeVars.surface, minWidth: 120 }}>
    <div style={{ fontSize: 11, color: themeVars.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: themeVars.text }}>{value}</div>
  </div>
);

const UnmatchedList: React.FC<{ title: string; refs: readonly ElementRef[] }> = ({ title, refs }) => (
  <div style={{ flex: 1, minWidth: 200 }}>
    <div style={{ fontSize: 12, fontWeight: 600, color: themeVars.textSecondary, marginBottom: 4 }}>
      {title} ({refs.length})
    </div>
    {refs.length === 0
      ? <div style={{ fontSize: 12, color: themeVars.textMuted }}>All classes matched.</div>
      : (
        <ul aria-label={title} style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: themeVars.textSecondary, maxHeight: 120, overflow: 'auto' }}>
          {displayNames(refs).map(name => <li key={name}>{name}</li>)}
        </ul>
      )}
  </div>
);

/** Class counts, overlap percentage, unmatched classes and warnings of a result. */
export const OverlapSummary: React.FC<{ result: OverlapResult }> = ({ result }) => {
  const { summary, unmatched, warnings, source, target } = result;
  return (
    <section aria-label="Overlap summary" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Figure label="Overlap" value={`${summary.overlapPercent.toFixed(0)} %`} />
        <Figure label={`${source.name} classes`} value={`${summary.matchedSourceClasses} / ${summary.sourceClassCount} matched`} />
        <Figure label={`${target.name} classes`} value={`${summary.matchedTargetClasses} / ${summary.targetClassCount} matched`} />
        <Figure label="Correspondences" value={String(result.correspondences.length)} />
        <Figure label="Fitness" value={summary.fitness.toFixed(2)} />
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <UnmatchedList title={`Unmatched in ${source.name}`} refs={unmatched.source} />
        <UnmatchedList title={`Unmatched in ${target.name}`} refs={unmatched.target} />
      </div>
      {warnings.length > 0 && (
        <ul aria-label="Warnings" style={{
          margin: 0, padding: '8px 12px 8px 28px', fontSize: 12, borderRadius: 8,
          background: themeVars.warningBg, border: `1px solid ${themeVars.warningBorder}`, color: themeVars.warningText,
        }}>
          {warnings.map(warning => <li key={warning}>{warning}</li>)}
        </ul>
      )}
    </section>
  );
};
