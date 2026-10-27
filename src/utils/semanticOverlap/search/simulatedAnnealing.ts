import type { AnalysisSettings } from '../types';
import type { MatchingProblem, Solution } from './matchingProblem';
import type { Rng } from './rng';
import { cloneAssignments, randomAssignment, type SearchProgress, type SearchStrategy } from './strategy';

/**
 * Simulated annealing (paper Algorithm 2, Eq. 5) starting from `start`: neighbour = re-assign one
 * random dimension; better neighbours are always accepted, worse ones with `exp(Δ/T)`. Δ is the
 * change of the summed element values (fitness · n), so temperatures do not depend on the size of
 * the metamodels. Returns the best solution seen.
 */
export function runSimulatedAnnealing(
  problem: MatchingProblem,
  settings: AnalysisSettings,
  rng: Rng,
  start: Solution,
  onProgress?: (progress: SearchProgress) => void,
): Solution {
  if (problem.n === 0) return { assignments: [], fitness: 0 };
  const { sa } = settings;
  const current: Solution = { assignments: cloneAssignments(start.assignments), fitness: start.fitness };
  let best: Solution = { assignments: cloneAssignments(current.assignments), fitness: current.fitness };
  const iterations = Math.max(1, Math.round(sa.iterationsPerElement * problem.n));
  const steps = Math.max(1, Math.ceil(Math.log(sa.endTemperature / sa.startTemperature) / Math.log(sa.coolingFactor)));

  let temperature = sa.startTemperature;
  for (let step = 0; temperature > sa.endTemperature; step++) {
    for (let k = 0; k < iterations; k++) {
      const i = rng.int(problem.n);
      const candidate = randomAssignment(problem, i, rng);
      const delta = problem.delta(current, i, candidate);
      if (delta >= 0 || rng.next() < Math.exp((delta * problem.n) / temperature)) {
        current.assignments[i] = candidate;
        current.fitness += delta;
        if (current.fitness > best.fitness + 1e-12) {
          best = { assignments: cloneAssignments(current.assignments), fitness: current.fitness };
        }
      }
    }
    temperature *= sa.coolingFactor;
    onProgress?.({ phase: 'sa', fraction: Math.min(1, (step + 1) / steps) });
  }
  // Recompute to avoid accumulated floating-point drift from the incremental updates.
  return { assignments: best.assignments, fitness: problem.fitness(best.assignments) };
}

/** SA alone, starting from every element's most similar target. */
export const simulatedAnnealingStrategy: SearchStrategy = {
  id: 'sa',
  version: '1',
  search: (problem, settings, rng, onProgress) => {
    const assignments = problem.candidates.map(candidates => candidates.slice(0, 1));
    return runSimulatedAnnealing(problem, settings, rng,
      { assignments, fitness: problem.fitness(assignments) }, onProgress);
  },
};
