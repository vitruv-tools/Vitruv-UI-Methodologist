import { createWordNetSource } from '../../../utils/semanticOverlap/lexical/wordNetSource';
import { runOverlapAnalysis } from '../../../utils/semanticOverlap/runOverlapAnalysis';
import { resolveSettings } from '../../../utils/semanticOverlap/settings';
import type { OverlapResult } from '../../../utils/semanticOverlap/types';
import table from '../../../assets/wordnet/oewn-2025-synonyms.json';
import { ecoreExcerpt, umlExcerpt } from '../../utils/semanticOverlap/fixtures';

/** Deterministic Fig. 1 result: EClass↔Class, {EAttribute, EReference}↔Property, Association unmatched. */
export function sampleResult(seed = 42): OverlapResult {
  return runOverlapAnalysis(
    { source: ecoreExcerpt(), target: umlExcerpt(), settings: resolveSettings({ seed }) },
    { lexical: createWordNetSource(table), now: () => 0, createId: () => `result-${seed}` },
  );
}

export const correspondenceFor = (result: OverlapResult, sourceName: string) =>
  result.correspondences.find(c => c.sources.some(s => s.name === sourceName))!;
