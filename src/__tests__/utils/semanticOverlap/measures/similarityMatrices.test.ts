import { noLexicalSource } from '../../../../utils/semanticOverlap/lexical/wordNetSource';
import { buildClassProfiles } from '../../../../utils/semanticOverlap/measures/profiles';
import { createDefaultMeasureRegistry } from '../../../../utils/semanticOverlap/measures/registry';
import { combineScores, computeMatrices } from '../../../../utils/semanticOverlap/measures/similarityMatrices';
import { DEFAULT_SETTINGS } from '../../../../utils/semanticOverlap/settings';
import { ecoreExcerpt, umlExcerpt } from '../fixtures';

describe('similarity matrices', () => {
  const sources = buildClassProfiles(ecoreExcerpt(), 'source', noLexicalSource, DEFAULT_SETTINGS);
  const targets = buildClassProfiles(umlExcerpt(), 'target', noLexicalSource, DEFAULT_SETTINGS);

  it('has one row-major cell per source/target pair', () => {
    const matrices = computeMatrices('class', sources, targets, createDefaultMeasureRegistry(), DEFAULT_SETTINGS);
    expect([matrices.n, matrices.m]).toEqual([3, 3]);
    expect(matrices.combined).toHaveLength(9);
    expect(Object.keys(matrices.perMeasure)).toEqual(['structural', 'cosine', 'levenshtein', 'name-tokens', 'neighbourhood']);
  });

  it('combines syntactic = α·cosine + β·(1−LevNorm) and the weighted objectives', () => {
    const paperOnly = { ...DEFAULT_SETTINGS, measures: [] };
    const matrices = computeMatrices('class', sources, targets, createDefaultMeasureRegistry(), paperOnly);
    const k = 0; // EClass ↔ Class
    expect(matrices.syntactic[k]).toBeCloseTo(0.5 * matrices.perMeasure.cosine[k] + 0.5 * matrices.perMeasure.levenshtein[k]);
    expect(matrices.combined[k]).toBeCloseTo(0.5 * matrices.structural[k] + 0.5 * matrices.syntactic[k]);
    // EClass ↔ Class beats EClass ↔ Association
    expect(matrices.combined[0]).toBeGreaterThan(matrices.combined[2]);
  });

  it('includes weighted additional measures', () => {
    const settings = { ...DEFAULT_SETTINGS, measures: [{ id: 'one', weight: 1 }] };
    expect(combineScores(settings, 0.4, 0.6, [{ weight: 1, value: 1 }])).toBeCloseTo((0.2 + 0.3 + 1) / 2);
  });
});
