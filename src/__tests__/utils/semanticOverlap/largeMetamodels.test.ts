import { createWordNetSource } from '../../../utils/semanticOverlap/lexical/wordNetSource';
import { runOverlapAnalysis } from '../../../utils/semanticOverlap/runOverlapAnalysis';
import { resolveSettings } from '../../../utils/semanticOverlap/settings';
import table from '../../../assets/wordnet/oewn-2025-synonyms.json';
import { syntheticMetamodel } from './syntheticMetamodel';
import { runImprovedAnalysis } from '../../../utils/semanticOverlap/improved/runImprovedAnalysis';
import { IMPROVEMENT_IDS, improvementsOf, resolveImprovedSettings } from '../../../utils/semanticOverlap/improved/settings';
import { createHypernymSource, type HypernymTable } from '../../../utils/semanticOverlap/improved/lexical/hypernymSource';
import hypernymTable from '../../../assets/wordnet/oewn-2025-hypernyms.json';
import { improvedApproach } from '../../../utils/semanticOverlap/approaches/improvedApproach';
import { memoryEmbeddingCache } from '../../../utils/semanticOverlap/improved/embeddings/embeddingCache';
import { buildEmbeddingTable } from '../../../utils/semanticOverlap/improved/embeddings/embeddingSource';
import { loadEmbeddingSourceFromDisk } from '../../../utils/semanticOverlap/improved/embeddings/embeddingSourceNode';
import { MODEL_ROOT } from './benchmark/embeddingFixture';

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


/**
 * Opt-in timing of the improved default: 100 × 100 and 300 × 300 classes in at most one
 * minute each, including building the embedding table on a cold cache when the model is fetched.
 * OVERLAP_PERF=1 npx vitest run src/__tests__/utils/semanticOverlap/largeMetamodels.test.ts
 * The CI variant above measures no wall-clock time.
 */
describe.skipIf(!process.env.OVERLAP_PERF)('large metamodels: time limit of the improved default', () => {
  const LIMIT_MS = 60_000;
  const deps = { lexical: createWordNetSource(table), hypernyms: createHypernymSource(hypernymTable as HypernymTable), createId: () => 'r' };

  it.each([100, 300])('%i × %i classes finish within one minute, embeddings included', async size => {
    const source = syntheticMetamodel(size, 1, 'a');
    const target = syntheticMetamodel(size, 2, 'b');
    const settings = resolveImprovedSettings({ seed: 5 });
    const started = performance.now();
    const model = settings.improvements.embeddings ? await loadEmbeddingSourceFromDisk(settings.params.embeddingModel, MODEL_ROOT) : null;
    const descriptions = improvedApproach.describe!({ source, target, settings });
    const embeddings = model ? await buildEmbeddingTable(model, descriptions.map(d => d.text), { cache: memoryEmbeddingCache() }) : null;
    const embedded = performance.now();
    const result = runImprovedAnalysis({ source, target, settings }, { ...deps, embeddings });
    const finished = performance.now();
    process.stdout.write(`${size} × ${size}: ${descriptions.length} descriptions, embedding ${((embedded - started) / 1000).toFixed(1)} s, `
      + `analysis ${((finished - embedded) / 1000).toFixed(1)} s, total ${((finished - started) / 1000).toFixed(1)} s\n`);
    expect(result.summary.sourceClassCount).toBe(size);
    expect(finished - started).toBeLessThanOrEqual(LIMIT_MS);
  }, 300_000);
});
