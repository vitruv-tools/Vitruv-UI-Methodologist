import { classLevenshteinMeasure, levenshtein, levNorm } from '../../../../utils/semanticOverlap/measures/levenshteinMeasure';
import { DEFAULT_SETTINGS } from '../../../../utils/semanticOverlap/settings';
import { profile } from '../helpers';

describe('edit distance (Eq. 3)', () => {
  it('reproduces the paper example LevNorm(eAttribute, Attribute) = 0.1', () => {
    expect(levNorm('eAttribute', 'Attribute')).toBeCloseTo(0.1);
  });

  it('computes classic Levenshtein distances', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levNorm('', '')).toBe(0);
  });

  it('scores 1 − LevNorm', () => {
    const score = classLevenshteinMeasure.score(profile('EClass', 'source'), profile('Class', 'target'), { settings: DEFAULT_SETTINGS });
    expect(score).toBeCloseTo(1 - 1 / 6);
  });
});
