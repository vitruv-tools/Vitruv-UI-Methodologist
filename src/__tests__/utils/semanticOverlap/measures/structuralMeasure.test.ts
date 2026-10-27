import { averageMetrics, classStructuralMeasure, structuralSimilarity } from '../../../../utils/semanticOverlap/measures/structuralMeasure';
import { DEFAULT_SETTINGS } from '../../../../utils/semanticOverlap/settings';
import { profile } from '../helpers';

describe('structural measure (Eq. 8)', () => {
  it('is 1 for identical and for all-zero metrics', () => {
    expect(structuralSimilarity([2, 1, 0, 1, 3], [2, 1, 0, 1, 3])).toBe(1);
    expect(structuralSimilarity([0, 0, 0], [0, 0, 0])).toBe(1);
  });

  it('computes 1 − Σ|s−t| / Σ max(s,t)', () => {
    // |1-3| + |2-2| + |0-1| = 3; max: 3 + 2 + 1 = 6 → 1 - 3/6
    expect(structuralSimilarity([1, 2, 0], [3, 2, 1])).toBeCloseTo(0.5);
    expect(structuralSimilarity([4, 0], [0, 4])).toBe(0);
  });

  it('compares a group against the averaged target metrics', () => {
    const source = profile('A', 'source', [2, 2, 0, 0, 0]);
    const targets = [profile('B', 'target', [1, 3, 0, 0, 0]), profile('C', 'target', [3, 1, 0, 0, 0])];
    expect(averageMetrics(targets)).toEqual([2, 2, 0, 0, 0]);
    expect(classStructuralMeasure.scoreGroup!(source, targets, { settings: DEFAULT_SETTINGS })).toBe(1);
  });
});
