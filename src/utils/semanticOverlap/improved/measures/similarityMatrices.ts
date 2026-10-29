/*
 * Independent copy of the paper approach's `measures/similarityMatrices.ts`; evolves separately — do not
 * import from the paper pipeline for logic.
 */
import type { AnalysisSettings, MatchLevel } from '../../types';
import type { ElementProfile, MeasureContext, MeasureRegistry, SimilarityMeasure } from './types';
import { COSINE, LEVENSHTEIN, STRUCTURAL } from './types';
import { isOn } from '../settings';
import { adaptiveWeights, harmony } from './harmony';

/** Weights actually used to combine the objectives (adaptive weighting changes them per problem). */
export interface EffectiveWeights {
  structural: number;
  syntactic: number;
  /** By measure id. */
  extras: Record<string, number>;
}

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
  /** Set when adaptive weighting is on; group scores must use the same weights. */
  effectiveWeights?: EffectiveWeights;
  /** Set when similarity flooding is on: the fixpoint and its weight λ in `combined`. */
  flooding?: { matrix: Float32Array; weight: number };
}

/**
 * Additional measures used on a level: given a weight in the settings and registered for that level
 * (a measure registered only for classes does not apply to attributes and references).
 */
export function extraMeasures(registry: MeasureRegistry, level: MatchLevel, settings: AnalysisSettings) {
  return settings.measures
    .filter(entry => entry.weight > 0 && registry.has(entry.id, level))
    .map(entry => ({ measure: registry.get(entry.id, level), weight: entry.weight }));
}

/**
 * Combines the objectives: `(wStruct · structural + wSyn · syntactic + Σ wₑ · extraₑ) / (1 + Σ wₑ)`.
 * Without additional measures this is the paper's weighting (Eq. 7). `objectiveWeights` replaces
 * the settings' structural/syntactic weights (adaptive weighting); extras whose value is NaN do not
 * apply to the pair and are left out.
 */
export function combineScores(
  settings: AnalysisSettings,
  structural: number,
  syntactic: number,
  extras: readonly { weight: number; value: number }[] = [],
  objectiveWeights: { structural: number; syntactic: number } = settings.weights,
): number {
  let sum = objectiveWeights.structural * structural + objectiveWeights.syntactic * syntactic;
  let weights = objectiveWeights.structural + objectiveWeights.syntactic;
  for (const extra of extras) {
    if (Number.isNaN(extra.value)) continue;
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
  context: Omit<MeasureContext, 'settings'> = {},
): SimilarityMatrices {
  const n = sources.length;
  const m = targets.length;
  const ctx: MeasureContext = { settings, ...context };
  const extras = extraMeasures(registry, level, settings);
  const measures: SimilarityMeasure[] = [
    registry.get(STRUCTURAL, level), registry.get(COSINE, level), registry.get(LEVENSHTEIN, level),
    ...extras.map(e => e.measure),
  ];
  const perMeasure: Record<string, Float32Array> = {};
  for (const measure of measures) {
    const matrix = new Float32Array(n * m);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const applicable = measure.applicable?.(sources[i], targets[j], ctx) ?? true;
        // NaN marks a measure that does not apply to the pair; combineScores leaves it out.
        matrix[i * m + j] = applicable ? measure.score(sources[i], targets[j], ctx) : Number.NaN;
      }
    }
    perMeasure[measure.id] = matrix;
  }
  const structural = perMeasure[STRUCTURAL];
  const syntactic = new Float32Array(n * m);
  const combined = new Float32Array(n * m);
  const { alpha, beta } = settings.syntactic;
  for (let k = 0; k < n * m; k++) syntactic[k] = alpha * perMeasure[COSINE][k] + beta * perMeasure[LEVENSHTEIN][k];
  const effectiveWeights = isOn(settings, 'adaptive-weights')
    ? adaptiveEffectiveWeights(settings, extras, structural, syntactic, perMeasure, n, m)
    : undefined;
  const objectives = effectiveWeights ?? settings.weights;
  const extraWeight = (e: typeof extras[number]) => effectiveWeights?.extras[e.measure.id] ?? e.weight;
  for (let k = 0; k < n * m; k++) {
    combined[k] = combineScores(settings, structural[k], syntactic[k],
      extras.map(e => ({ weight: extraWeight(e), value: perMeasure[e.measure.id][k] })), objectives);
  }
  return { n, m, perMeasure, structural, syntactic, combined, ...(effectiveWeights ? { effectiveWeights } : {}) };
}

/** Weights scaled by the harmony of each objective's matrix (Mao et al. 2008). */
function adaptiveEffectiveWeights(
  settings: AnalysisSettings,
  extras: readonly { measure: SimilarityMeasure; weight: number }[],
  structural: Float32Array,
  syntactic: Float32Array,
  perMeasure: Record<string, Float32Array>,
  n: number,
  m: number,
): EffectiveWeights {
  // Not-applicable cells (NaN) count as 0 for the harmony.
  const finite = (matrix: Float32Array) => Array.from(matrix, v => (Number.isNaN(v) ? 0 : v));
  const weights = [settings.weights.structural, settings.weights.syntactic, ...extras.map(e => e.weight)];
  const harmonies = [structural, syntactic, ...extras.map(e => perMeasure[e.measure.id])]
    .map(matrix => harmony(finite(matrix), n, m));
  const scaled = adaptiveWeights(weights, harmonies);
  return {
    structural: scaled[0],
    syntactic: scaled[1],
    extras: Object.fromEntries(extras.map((e, k) => [e.measure.id, scaled[k + 2]])),
  };
}
