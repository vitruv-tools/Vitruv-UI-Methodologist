import React from 'react';
import { themeVars } from '../../theme/theme';
import { APPROACHES } from '../../utils/semanticOverlap/approaches/registry';
import { IMPROVEMENT_IDS, IMPROVEMENT_LABELS, type ImprovedSettings } from '../../utils/semanticOverlap/improved/settings';
import { KIND_NAMES } from '../../utils/semanticOverlap/correspondenceKind';
import { CORRESPONDENCE_KINDS, type CorrespondenceKind, type OverlapResult } from '../../utils/semanticOverlap/types';

const Figure: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ padding: '10px 14px', border: `1px solid ${themeVars.border}`, borderRadius: 10, background: themeVars.surface, minWidth: 120 }}>
    <div style={{ fontSize: 11, color: themeVars.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: themeVars.text }}>{value}</div>
  </div>
);

const percent = (value: number) => `${Math.round(value * 100)} %`;

/** "Same concept: 3 · Class ↔ instance: 2 · Path: 1"; same and instance always, other kinds when present. */
function kindCountsText(counts: Partial<Record<CorrespondenceKind, number>>): string {
  return CORRESPONDENCE_KINDS
    .filter(kind => kind === 'same' || kind === 'instance' || (counts[kind] ?? 0) > 0)
    .map(kind => `${KIND_NAMES[kind]}: ${counts[kind] ?? 0}`)
    .join(' · ');
}

/** Label and version of the approach that produced a result; results without one are paper results. */
export function approachLabel(result: OverlapResult): string {
  const approach = result.approach ?? { id: 'paper', version: APPROACHES.paper.version };
  const known = APPROACHES[approach.id as keyof typeof APPROACHES];
  return `${known ? known.label : approach.id} ${approach.version}`;
}

/** One line describing the settings and engine that produced a result (FR-013). */
export function describeSettingsUsed(result: OverlapResult): string {
  const { settings, engine } = result;
  return [
    `Seed ${settings.seed}`,
    `effort ${settings.effort}`,
    `structural ${percent(settings.weights.structural)} / syntactic ${percent(settings.weights.syntactic)}`,
    `α ${settings.syntactic.alpha} / β ${settings.syntactic.beta}`,
    `null score ${settings.nullScore}`,
    `max. ${settings.maxTargetsPerElement} targets`,
    `strategy ${engine.strategy.id} v${engine.strategy.version}`,
    `measures ${engine.measures.map(m => `${m.id} v${m.version}`).join(', ')}`,
    engine.lexicalSource ? `synonyms ${engine.lexicalSource.id} ${engine.lexicalSource.version}` : 'no synonyms',
    ...improvementsUsed(settings as Partial<ImprovedSettings>),
    ...(result.embeddingModel ? [`embedding model ${result.embeddingModel.id} (revision ${result.embeddingModel.revision.slice(0, 8)})`] : []),
  ].join(' · ');
}

function improvementsUsed(settings: Partial<ImprovedSettings>): string[] {
  if (!settings.improvements) return [];
  const enabled = IMPROVEMENT_IDS.filter(id => settings.improvements?.[id]).map(id => IMPROVEMENT_LABELS[id]);
  return [`improvements: ${enabled.length > 0 ? enabled.join(', ') : 'none'}`];
}

/** Class counts, overlap percentage, warnings and the settings used. */
export const OverlapSummary: React.FC<{ result: OverlapResult }> = ({ result }) => {
  const { summary, warnings, source, target } = result;
  return (
    <section aria-label="Overlap summary" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Figure label="Approach" value={approachLabel(result)} />
        <Figure label="Overlap" value={`${summary.overlapPercent.toFixed(0)} %`} />
        <Figure label={`${source.name} classes`} value={`${summary.matchedSourceClasses} / ${summary.sourceClassCount} matched`} />
        <Figure label={`${target.name} classes`} value={`${summary.matchedTargetClasses} / ${summary.targetClassCount} matched`} />
        <Figure label="Correspondences" value={String(result.correspondences.length)} />
        {summary.kindCounts && <Figure label="Kinds" value={kindCountsText(summary.kindCounts)} />}
        <Figure label="Fitness" value={summary.fitness.toFixed(2)} />
        {summary.coverage && (
          <Figure
            label="Coverage (classes · features)"
            value={`${percent(summary.coverage.source.classes)} · ${percent(summary.coverage.source.features)} | ${percent(summary.coverage.target.classes)} · ${percent(summary.coverage.target.features)}`}
          />
        )}
        {result.acceptanceThreshold && (
          <Figure label="Acceptance threshold" value={result.acceptanceThreshold.value.toFixed(3)} />
        )}
      </div>
      {result.acceptanceThreshold?.note && (
        <div style={{ fontSize: 11, color: themeVars.textMuted }}>
          Acceptance threshold τ = {result.acceptanceThreshold.value.toFixed(3)}, {result.acceptanceThreshold.note}.
        </div>
      )}
      <section aria-label="Settings used" style={{ fontSize: 11, color: themeVars.textMuted }}>
        {describeSettingsUsed(result)}
      </section>
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
