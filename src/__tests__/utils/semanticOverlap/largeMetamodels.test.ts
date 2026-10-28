import { createWordNetSource } from '../../../utils/semanticOverlap/lexical/wordNetSource';
import { runOverlapAnalysis } from '../../../utils/semanticOverlap/runOverlapAnalysis';
import { resolveSettings } from '../../../utils/semanticOverlap/settings';
import table from '../../../assets/wordnet/oewn-2025-synonyms.json';
import { syntheticMetamodel } from './syntheticMetamodel';

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
});
