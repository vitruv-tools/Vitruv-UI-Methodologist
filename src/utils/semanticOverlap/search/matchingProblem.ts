import { combineScores, extraMeasures, type SimilarityMatrices } from '../measures/similarityMatrices';
import { averageMetrics, structuralSimilarity } from '../measures/structuralMeasure';
import type { ElementProfile, MeasureRegistry } from '../measures/types';
import type { AnalysisSettings, MatchLevel } from '../types';

/**
 * A candidate matching (paper §4.3.1): `assignments[i]` holds the target indices chosen for source
 * element i, possibly none. Invariant: at most `maxTargetsPerElement` distinct indices in [0, m).
 */
export interface Solution {
  assignments: number[][];
  fitness: number;
}

/** Objective values of one source element against its chosen targets. */
export interface ScoreBreakdown {
  structural: number;
  syntactic: number;
  /** Additional measures by id. */
  extras: Record<string, number>;
  combined: number;
}

/** Number of preferred candidate targets per source element used by the change operator. */
const CANDIDATES_PER_ELEMENT = 8;

export interface MatchingProblem {
  level: MatchLevel;
  n: number;
  m: number;
  sources: readonly ElementProfile[];
  targets: readonly ElementProfile[];
  matrices: SimilarityMatrices;
  settings: AnalysisSettings;
  maxTargets: number;
  /** Per source element: target indices sorted by descending combined similarity (top few). */
  candidates: number[][];
  /** Objective breakdown of source i against `targets` (must be non-empty). */
  scoreOf(i: number, targets: readonly number[]): ScoreBreakdown;
  /** Contribution of source i to the fitness: combined score, or the null score if unmatched. */
  valueOf(i: number, targets: readonly number[]): number;
  /** Eq. 7 normalised: mean element value over all source elements. */
  fitness(assignments: readonly (readonly number[])[]): number;
  /** Fitness change if source i is re-assigned to `newTargets`. */
  delta(solution: Solution, i: number, newTargets: readonly number[]): number;
}

export function createMatchingProblem(
  level: MatchLevel,
  sources: readonly ElementProfile[],
  targets: readonly ElementProfile[],
  matrices: SimilarityMatrices,
  registry: MeasureRegistry,
  settings: AnalysisSettings,
): MatchingProblem {
  const { n, m } = matrices;
  const extras = extraMeasures(registry, level, settings);
  const ctx = { settings };
  const groupCache = new Map<string, ScoreBreakdown>();

  const candidates = Array.from({ length: n }, (_, i) => {
    const order = Array.from({ length: m }, (_, j) => j);
    order.sort((a, b) => matrices.combined[i * m + b] - matrices.combined[i * m + a] || a - b);
    return order.slice(0, Math.min(m, CANDIDATES_PER_ELEMENT));
  });

  const scoreOf = (i: number, chosen: readonly number[]): ScoreBreakdown => {
    if (chosen.length === 1) {
      const k = i * m + chosen[0];
      const extraValues: Record<string, number> = {};
      for (const e of extras) extraValues[e.measure.id] = matrices.perMeasure[e.measure.id][k];
      return {
        structural: matrices.structural[k],
        syntactic: matrices.syntactic[k],
        extras: extraValues,
        combined: matrices.combined[k],
      };
    }
    const key = `${i}:${[...chosen].sort((a, b) => a - b).join(',')}`;
    const cached = groupCache.get(key);
    if (cached) return cached;
    const groupTargets = chosen.map(j => targets[j]);
    // Eq. 8 against the averaged target metrics; Eq. 9: mean syntactic homogeneity over the targets.
    const structural = structuralSimilarity(sources[i].metrics, averageMetrics(groupTargets));
    const syntactic = chosen.reduce((sum, j) => sum + matrices.syntactic[i * m + j], 0) / chosen.length;
    const extraValues: Record<string, number> = {};
    for (const e of extras) {
      extraValues[e.measure.id] = e.measure.scoreGroup
        ? e.measure.scoreGroup(sources[i], groupTargets, ctx)
        : chosen.reduce((sum, j) => sum + matrices.perMeasure[e.measure.id][i * m + j], 0) / chosen.length;
    }
    const breakdown = {
      structural,
      syntactic,
      extras: extraValues,
      combined: combineScores(settings, structural, syntactic,
        extras.map(e => ({ weight: e.weight, value: extraValues[e.measure.id] }))),
    };
    groupCache.set(key, breakdown);
    return breakdown;
  };

  const valueOf = (i: number, chosen: readonly number[]) =>
    chosen.length === 0 ? settings.nullScore : scoreOf(i, chosen).combined;

  return {
    level,
    n,
    m,
    sources,
    targets,
    matrices,
    settings,
    maxTargets: Math.max(1, Math.min(settings.maxTargetsPerElement, m)),
    candidates,
    scoreOf,
    valueOf,
    fitness: assignments => {
      if (n === 0) return 0;
      let sum = 0;
      for (let i = 0; i < n; i++) sum += valueOf(i, assignments[i]);
      return sum / n;
    },
    delta: (solution, i, newTargets) =>
      (valueOf(i, newTargets) - valueOf(i, solution.assignments[i])) / Math.max(1, n),
  };
}
