import type { ElementProfile, SimilarityMeasure } from './types';
import { STRUCTURAL } from './types';

/**
 * Eq. 8 of the paper: `1 − Σ|s − t| / Σ max(s, t)` over the metric vectors; 1 when both are all
 * zero. Metrics are non-negative.
 */
export function structuralSimilarity(source: readonly number[], target: readonly number[]): number {
  let difference = 0;
  let maximum = 0;
  for (let j = 0; j < source.length; j++) {
    difference += Math.abs(source[j] - target[j]);
    maximum += Math.max(source[j], target[j]);
  }
  return maximum === 0 ? 1 : 1 - difference / maximum;
}

/** Component-wise mean of the targets' metric vectors (paper: "average quality metrics values"). */
export function averageMetrics(targets: readonly ElementProfile[]): number[] {
  const length = targets[0]?.metrics.length ?? 0;
  const sum = new Array<number>(length).fill(0);
  for (const target of targets) {
    for (let j = 0; j < length; j++) sum[j] += target.metrics[j];
  }
  return sum.map(value => value / Math.max(1, targets.length));
}

const createStructuralMeasure = (level: 'class' | 'feature'): SimilarityMeasure => ({
  id: STRUCTURAL,
  version: '1',
  level,
  score: (source, target) => structuralSimilarity(source.metrics, target.metrics),
  scoreGroup: (source, targets) => structuralSimilarity(source.metrics, averageMetrics(targets)),
});

/** Class metrics: NAT, NAC, WMC, DIT, NOC (see profiles.ts). */
export const classStructuralMeasure = createStructuralMeasure('class');
/** Feature metrics: kind, lower bound, upper bound, containment, type category (see profiles.ts). */
export const featureStructuralMeasure = createStructuralMeasure('feature');
