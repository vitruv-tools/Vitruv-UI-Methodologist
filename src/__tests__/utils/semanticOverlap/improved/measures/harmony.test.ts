import { adaptiveCombine, adaptiveWeights, harmony } from '../../../../../utils/semanticOverlap/improved/measures/harmony';
import { computeMatrices } from '../../../../../utils/semanticOverlap/improved/measures/similarityMatrices';
import { createDefaultMeasureRegistry } from '../../../../../utils/semanticOverlap/improved/measures/registry';
import { improvementsOf, resolveImprovedSettings } from '../../../../../utils/semanticOverlap/improved/settings';
import { profile } from '../../helpers';

describe('harmony', () => {
  it('counts cells that are the strict maximum of their row and column', () => {
    // Diagonal maxima in a 2×3 matrix: both rows have a mutual best column.
    expect(harmony([0.9, 0.1, 0.2, 0.1, 0.8, 0.3], 2, 3)).toBe(1);
    // Row 1 prefers column 0, which belongs to row 0.
    expect(harmony([0.9, 0.1, 0.7, 0.2], 2, 2)).toBe(0.5);
  });

  it('is 0 for constant matrices', () => {
    expect(harmony([0, 0, 0, 0], 2, 2)).toBe(0);
    expect(harmony([0.5, 0.5, 0.5, 0.5], 2, 2)).toBe(0);
    expect(harmony([], 0, 0)).toBe(0);
  });

  it('scales weights and falls back to plain weights when nothing discriminates', () => {
    expect(adaptiveWeights([0.5, 0.5, 1], [1, 0.5, 0])).toEqual([0.5, 0.25, 0]);
    expect(adaptiveWeights([0.5, 0.5], [0, 0])).toEqual([0.5, 0.5]);
    expect(adaptiveCombine([0.4, 0.8, 0], [0.5, 0.5, 1], [1, 1, 0])).toBeCloseTo(0.6);
    expect(adaptiveCombine([0.4, Number.NaN], [1, 1], [1, 1])).toBeCloseTo(0.4);
  });

  it('keeps measures without signal from capping the combined score', () => {
    // Structural metrics discriminate, but the extra name measures are 0 everywhere (as on Brake -> BOM).
    const sources = [profile('Root', 'source', [3, 2, 0, 0, 0]), profile('Part', 'source', [1, 0, 0, 1, 0])];
    const targets = [profile('Whole', 'target', [3, 2, 0, 0, 0]), profile('Piece', 'target', [1, 0, 0, 1, 0])];
    const registry = createDefaultMeasureRegistry();
    const plain = computeMatrices('class', sources, targets, registry, resolveImprovedSettings({ seed: 1 }));
    const adaptive = computeMatrices('class', sources, targets, registry,
      resolveImprovedSettings({ seed: 1, improvements: improvementsOf(['adaptive-weights']) }));
    expect(plain.combined[0]).toBeLessThan(0.5);
    expect(adaptive.combined[0]).toBeGreaterThan(plain.combined[0] + 0.2);
    expect(adaptive.effectiveWeights?.extras['name-tokens']).toBe(0);
  });
});
