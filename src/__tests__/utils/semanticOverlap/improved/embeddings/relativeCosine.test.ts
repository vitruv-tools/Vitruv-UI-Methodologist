import { cosine, medianBaseline, relative, round4, sampleIndices } from '../../../../../utils/semanticOverlap/improved/embeddings/relativeCosine';
import { axisVector } from './fakeEmbeddingSource';

describe('relative cosine', () => {
  it('computes the cosine of unit vectors, rounded to 1e-4', () => {
    expect(cosine(axisVector(1), axisVector(1))).toBe(1);
    expect(cosine(axisVector(1), axisVector(0, 1))).toBe(0);
    expect(cosine(axisVector(1, 1), axisVector(1))).toBe(0.7071);
  });

  it('takes the median as baseline', () => {
    expect(medianBaseline([0.3, 0.1, 0.2])).toBe(0.2);
    expect(medianBaseline([0.1, 0.2, 0.3, 0.4])).toBe(0.25);
    expect(medianBaseline([])).toBe(0);
  });

  it('rescales against the baseline and clamps to [0, 1]', () => {
    expect(relative(0.6, 0.2)).toBe(0.5);
    expect(relative(0.1, 0.2)).toBe(0);
    expect(relative(1, 0.2)).toBe(1);
    expect(relative(0.5, 0)).toBe(0.5);
    expect(relative(0.33333333, 0.1)).toBe(0.2593);
  });

  it('rounds to 1e-4 so tiny floating-point differences do not change scores', () => {
    expect(round4(0.123449)).toBe(0.1234);
    expect(relative(0.6 + 1e-7, 0.2)).toBe(relative(0.6 - 1e-7, 0.2));
  });

  it('samples at most 200 evenly spaced indices for large products', () => {
    expect(sampleIndices(5)).toEqual([0, 1, 2, 3, 4]);
    const sample = sampleIndices(1000);
    expect(sample).toHaveLength(200);
    expect(sample.slice(0, 3)).toEqual([0, 5, 10]);
    expect(sample.at(-1)).toBe(995);
    expect(sampleIndices(1000)).toEqual(sample);
  });
});
