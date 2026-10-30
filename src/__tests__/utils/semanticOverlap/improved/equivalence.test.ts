import { runImprovedAnalysis } from '../../../../utils/semanticOverlap/improved/runImprovedAnalysis';
import { improvementsOf, resolveImprovedSettings } from '../../../../utils/semanticOverlap/improved/settings';
import { createWordNetSource } from '../../../../utils/semanticOverlap/lexical/wordNetSource';
import { runOverlapAnalysis } from '../../../../utils/semanticOverlap/runOverlapAnalysis';
import { resolveSettings } from '../../../../utils/semanticOverlap/settings';
import type { MetamodelGraph, OverlapResult } from '../../../../utils/semanticOverlap/types';
import table from '../../../../assets/wordnet/oewn-2025-synonyms.json';
import { loadScenario, scenarios } from '../benchmark/suite';

/** The improved approach with every improvement off must equal the paper approach. */
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const deps = { lexical: createWordNetSource(table), now: () => 0, createId: () => 'r' };

/** Drops what legitimately differs: the improved settings' extra fields. */
const comparable = (result: OverlapResult) => {
  const { improvements: _i, params: _p, ...settings } = result.settings as OverlapResult['settings'] & Record<string, unknown>;
  return { ...result, settings, durationMs: 0 };
};

function expectEquivalent(source: MetamodelGraph, target: MetamodelGraph, seed: number) {
  const paper = runOverlapAnalysis({ source, target, settings: resolveSettings({ seed }) }, deps);
  const improved = runImprovedAnalysis(
    { source, target, settings: resolveImprovedSettings({ seed, improvements: improvementsOf([]) }) }, deps);
  expect(comparable(improved)).toEqual(comparable(paper));
}

// Every scenario of the benchmark suite; downloaded and local-only ones skip when their files are missing.
describe('improved approach with all improvements off', () => {
  describe.each(scenarios().map(s => [s.label, s] as const))('%s', (_label, scenario) => {
    it.skipIf(!scenario.available)('equals the paper approach for seeds 1–10', () => {
      const loaded = loadScenario(scenario.id)!;
      SEEDS.forEach(seed => expectEquivalent(loaded.source, loaded.target, seed));
    }, 600_000);
  });
});
