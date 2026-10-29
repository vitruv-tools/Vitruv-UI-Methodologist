import React from 'react';
import { themeVars } from '../../theme/theme';
import { APPROACHES } from '../../utils/semanticOverlap/approaches/registry';
import { IMPROVEMENT_IDS, IMPROVEMENT_LABELS, type ImprovedSettings } from '../../utils/semanticOverlap/improved/settings';
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

const percent = (value: number) => `${Math.round(value * 100)} %`;

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
  ].join(' · ');
}

function improvementsUsed(settings: Partial<ImprovedSettings>): string[] {
  if (!settings.improvements) return [];
  const enabled = IMPROVEMENT_IDS.filter(id => settings.improvements?.[id]).map(id => IMPROVEMENT_LABELS[id]);
  return [`improvements: ${enabled.length > 0 ? enabled.join(', ') : 'none'}`];
}

/** Class counts, overlap percentage, unmatched classes, warnings and the settings used. */
export const OverlapSummary: React.FC<{ result: OverlapResult }> = ({ result }) => {
  const { summary, unmatched, warnings, source, target } = result;
  return (
    <section aria-label="Overlap summary" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Figure label="Approach" value={approachLabel(result)} />
        <Figure label="Overlap" value={`${summary.overlapPercent.toFixed(0)} %`} />
        <Figure label={`${source.name} classes`} value={`${summary.matchedSourceClasses} / ${summary.sourceClassCount} matched`} />
        <Figure label={`${target.name} classes`} value={`${summary.matchedTargetClasses} / ${summary.targetClassCount} matched`} />
        <Figure label="Correspondences" value={String(result.correspondences.length)} />
        {summary.kindCounts && (
          <Figure label="Kinds" value={`Same concept: ${summary.kindCounts.same} · Class ↔ instance: ${summary.kindCounts.instance}`} />
        )}
        <Figure label="Fitness" value={summary.fitness.toFixed(2)} />
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <UnmatchedList title={`Unmatched in ${source.name}`} refs={unmatched.source} />
        <UnmatchedList title={`Unmatched in ${target.name}`} refs={unmatched.target} />
      </div>
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
