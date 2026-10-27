import type { AnalysisSettings } from '../types';
import type { MatchingProblem, Solution } from './matchingProblem';
import type { Rng } from './rng';

export interface SearchProgress {
  phase: 'ga' | 'sa';
  /** 0..1 within this search. */
  fraction: number;
}

/** A search strategy for the matching problem (FR-016). Must only use `rng` for randomness. */
export interface SearchStrategy {
  readonly id: string;
  readonly version: string;
  search(
    problem: MatchingProblem,
    settings: AnalysisSettings,
    rng: Rng,
    onProgress?: (progress: SearchProgress) => void,
  ): Solution;
}

/**
 * The paper's change operator (§4.3.3): a new assignment for one dimension. Mostly one of the most
 * similar targets, sometimes a random target, an additional target (1:n) or no target.
 */
export function randomAssignment(problem: MatchingProblem, i: number, rng: Rng): number[] {
  if (problem.m === 0) return [];
  const roll = rng.next();
  if (roll < 0.1) return [];
  const pickOne = () => (rng.next() < 0.85 ? rng.pick(problem.candidates[i]) : rng.int(problem.m));
  const first = pickOne();
  if (problem.maxTargets > 1 && roll > 0.8) {
    const extra = new Set([first]);
    const size = 2 + (problem.maxTargets > 2 && rng.next() < 0.2 ? rng.int(problem.maxTargets - 1) : 0);
    for (let attempt = 0; attempt < size * 3 && extra.size < size; attempt++) extra.add(pickOne());
    return [...extra].sort((a, b) => a - b);
  }
  return [first];
}

/** Number of dimensions re-assigned by one mutation. */
export function mutatedDimensions(problem: MatchingProblem, settings: AnalysisSettings): number {
  return Math.max(1, Math.ceil(settings.ga.mutatedFraction * problem.n));
}

export const cloneAssignments = (assignments: readonly (readonly number[])[]) =>
  assignments.map(targets => [...targets]);
