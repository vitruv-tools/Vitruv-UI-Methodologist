import { createWordNetSource } from '../../../utils/semanticOverlap/lexical/wordNetSource';
import { runOverlapAnalysis } from '../../../utils/semanticOverlap/runOverlapAnalysis';
import { resolveSettings } from '../../../utils/semanticOverlap/settings';
import type { OverlapResult } from '../../../utils/semanticOverlap/types';
import table from '../../../assets/wordnet/oewn-2025-synonyms.json';
import { ecoreExcerpt, umlExcerpt } from '../../utils/semanticOverlap/fixtures';
import { runImprovedAnalysis } from '../../../utils/semanticOverlap/improved/runImprovedAnalysis';
import { improvementsOf, resolveImprovedSettings } from '../../../utils/semanticOverlap/improved/settings';
import { assembly, shop } from '../../utils/semanticOverlap/improved/typeObject/typeObjectFixtures';

/** Deterministic Fig. 1 result: EClass↔Class, {EAttribute, EReference}↔Property, Association unmatched. */
export function sampleResult(seed = 42): OverlapResult {
  return runOverlapAnalysis(
    { source: ecoreExcerpt(), target: umlExcerpt(), settings: resolveSettings({ seed }) },
    { lexical: createWordNetSource(table), now: () => 0, createId: () => `result-${seed}` },
  );
}

export const correspondenceFor = (result: OverlapResult, sourceName: string) =>
  result.correspondences.find(c => c.sources.some(s => s.name === sourceName))!;

/**
 * Deterministic improved result with the type-object pattern (synthetic Assembly → Shop): same-concept
 * correspondences, two `Bolt/Nut ↔ ProductKind` instance correspondences with definition and value
 * children, the detected pattern and kind counts.
 */
export function sampleImprovedResult(seed = 42): OverlapResult {
  return runImprovedAnalysis(
    { source: assembly(), target: shop(), settings: resolveImprovedSettings({ seed, improvements: improvementsOf(['type-object']) }, 'fast') },
    { lexical: createWordNetSource(table), now: () => 0, createId: () => `improved-${seed}` },
  );
}
