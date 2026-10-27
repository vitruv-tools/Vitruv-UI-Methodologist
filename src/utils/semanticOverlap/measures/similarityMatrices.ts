import type { AnalysisSettings, MatchLevel } from '../types';
import type { ElementProfile, MeasureContext, MeasureRegistry, SimilarityMeasure } from './types';
import { COSINE, LEVENSHTEIN, STRUCTURAL } from './types';

/** Row-major n × m matrices (row = source element, column = target element). */
export interface SimilarityMatrices {
  n: number;
  m: number;
  /** Raw score per measure id (built-ins and additional measures). */
  perMeasure: Record<string, Float32Array>;
  structural: Float32Array;
  /** `alpha · cosine + beta · (1 − LevNorm)` (Eq. 4). */
  syntactic: Float32Array;
  /** Weighted combination of the objectives, see {@link combineScores}. */
  combined: Float32Array;
}

/** Additional measures used in an analysis: registered on the level and given a weight. */
export function extraMeasures(registry: MeasureRegistry, level: MatchLevel, settings: AnalysisSettings) {
  return settings.measures
    .filter(entry => entry.weight > 0)
    .map(entry => ({ measure: registry.get(entry.id, level), weight: entry.weight }));
}

/**
 * Combines the objectives: `(wStruct · structural + wSyn · syntactic + Σ wₑ · extraₑ) / (1 + Σ wₑ)`.
 * Without additional measures this is the paper's weighting (Eq. 7).
 */
export function combineScores(
  settings: AnalysisSettings,
  structural: number,
  syntactic: number,
  extras: readonly { weight: number; value: number }[] = [],
): number {
  let sum = settings.weights.structural * structural + settings.weights.syntactic * syntactic;
  let weights = settings.weights.structural + settings.weights.syntactic;
  for (const extra of extras) {
    sum += extra.weight * extra.value;
    weights += extra.weight;
  }
  return weights === 0 ? 0 : sum / weights;
}

export function computeMatrices(
  level: MatchLevel,
  sources: readonly ElementProfile[],
  targets: readonly ElementProfile[],
  registry: MeasureRegistry,
  settings: AnalysisSettings,
): SimilarityMatrices {
  const n = sources.length;
  const m = targets.length;
  const ctx: MeasureContext = { settings };
  const extras = extraMeasures(registry, level, settings);
  const measures: SimilarityMeasure[] = [
    registry.get(STRUCTURAL, level), registry.get(COSINE, level), registry.get(LEVENSHTEIN, level),
    ...extras.map(e => e.measure),
  ];
  const perMeasure: Record<string, Float32Array> = {};
  for (const measure of measures) {
    const matrix = new Float32Array(n * m);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) matrix[i * m + j] = measure.score(sources[i], targets[j], ctx);
    }
    perMeasure[measure.id] = matrix;
  }
  const structural = perMeasure[STRUCTURAL];
  const syntactic = new Float32Array(n * m);
  const combined = new Float32Array(n * m);
  const { alpha, beta } = settings.syntactic;
  for (let k = 0; k < n * m; k++) {
    syntactic[k] = alpha * perMeasure[COSINE][k] + beta * perMeasure[LEVENSHTEIN][k];
    combined[k] = combineScores(settings, structural[k], syntactic[k],
      extras.map(e => ({ weight: e.weight, value: perMeasure[e.measure.id][k] })));
  }
  return { n, m, perMeasure, structural, syntactic, combined };
}
