import { createWordNetSource } from '../../../utils/semanticOverlap/lexical/wordNetSource';
import { runOverlapAnalysis } from '../../../utils/semanticOverlap/runOverlapAnalysis';
import { resolveSettings } from '../../../utils/semanticOverlap/settings';
import table from '../../../assets/wordnet/oewn-2025-synonyms.json';
import { syntheticMetamodel } from './syntheticMetamodel';
import { runImprovedAnalysis } from '../../../utils/semanticOverlap/improved/runImprovedAnalysis';
import { IMPROVEMENT_IDS, improvementsOf, resolveImprovedSettings } from '../../../utils/semanticOverlap/improved/settings';
import { createHypernymSource, type HypernymTable } from '../../../utils/semanticOverlap/improved/lexical/hypernymSource';
import hypernymTable from '../../../assets/wordnet/oewn-2025-hypernyms.json';

describe('large metamodels', () => {
  it('analyses two 300-class metamodels deterministically', () => {
    const input = { source: syntheticMetamodel(300, 1, 'a'), target: syntheticMetamodel(300, 2, 'b'), settings: resolveSettings({ seed: 5 }, 'fast') };
    const deps = { lexical: createWordNetSource(table), now: () => 0, createId: () => 'r' };
    const result = runOverlapAnalysis(input, deps);
    expect(result.summary).toMatchObject({ sourceClassCount: 300, targetClassCount: 300 });
    expect(result.classMatrix.overall).toHaveLength(300 * 300);
    expect(result.correspondences.length).toBeGreaterThan(0);
    expect(runOverlapAnalysis(input, deps)).toEqual(result);
  }, 60_000);

  it('analyses two 300-class metamodels with the improved defaults and with every improvement on', () => {
    const deps = { lexical: createWordNetSource(table), hypernyms: createHypernymSource(hypernymTable as HypernymTable), now: () => 0, createId: () => 'r' };
    for (const improvements of [undefined, improvementsOf([...IMPROVEMENT_IDS])]) {
      const settings = resolveImprovedSettings({ seed: 5, ...(improvements ? { improvements } : {}) }, 'fast');
      const result = runImprovedAnalysis({ source: syntheticMetamodel(300, 1, 'a'), target: syntheticMetamodel(300, 2, 'b'), settings }, deps);
      expect(result.summary).toMatchObject({ sourceClassCount: 300, targetClassCount: 300 });
      expect(result.correspondences.length).toBeGreaterThan(0);
    }
  }, 60_000);
});

