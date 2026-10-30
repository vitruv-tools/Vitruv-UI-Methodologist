import { classEmbeddingMeasure, featureEmbeddingMeasure } from '../../../../../utils/semanticOverlap/improved/measures/embeddingMeasure';
import type { ElementProfile } from '../../../../../utils/semanticOverlap/improved/measures/types';
import { resolveImprovedSettings } from '../../../../../utils/semanticOverlap/improved/settings';
import { axisVector } from '../embeddings/fakeEmbeddingSource';

const profile = (embedding?: Float32Array) => ({ embedding } as unknown as ElementProfile);
const ctx = (embeddingBaseline?: number) => ({ settings: resolveImprovedSettings(), embeddingBaseline });

describe('embedding measure', () => {
  it('scores the relative cosine against the level baseline', () => {
    const a = profile(axisVector(1, 1));
    const b = profile(axisVector(1));
    expect(classEmbeddingMeasure.score(a, b, ctx())).toBe(0.7071);
    expect(classEmbeddingMeasure.score(a, b, ctx(0.5))).toBe(0.4142);
    expect(classEmbeddingMeasure.score(a, profile(axisVector(0, 0, 1)), ctx(0.2))).toBe(0);
  });

  it('is not applicable when a vector is missing', () => {
    expect(classEmbeddingMeasure.applicable!(profile(axisVector(1)), profile(), ctx())).toBe(false);
    expect(classEmbeddingMeasure.applicable!(profile(), profile(axisVector(1)), ctx())).toBe(false);
    expect(classEmbeddingMeasure.applicable!(profile(axisVector(1)), profile(axisVector(1)), ctx())).toBe(true);
  });

  it('exists on class and feature level with the id "embedding" and uses the mean for groups', () => {
    expect([classEmbeddingMeasure.level, featureEmbeddingMeasure.level]).toEqual(['class', 'feature']);
    expect(new Set([classEmbeddingMeasure.id, featureEmbeddingMeasure.id])).toEqual(new Set(['embedding']));
    expect(classEmbeddingMeasure.scoreGroup).toBeUndefined();
  });
});
