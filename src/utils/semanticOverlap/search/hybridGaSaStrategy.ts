import { runGeneticAlgorithm } from './geneticAlgorithm';
import { runSimulatedAnnealing } from './simulatedAnnealing';
import type { SearchStrategy } from './strategy';

/** Share of the progress bar spent in the GA; the rest is SA. */
const GA_SHARE = 0.7;

/**
 * The paper's hybrid search: a genetic algorithm explores the search space globally, simulated
 * annealing then refines its best solution locally.
 */
export const hybridGaSaStrategy: SearchStrategy = {
  id: 'hybrid-ga-sa',
  version: '1',
  search: (problem, settings, rng, onProgress) => {
    const global = runGeneticAlgorithm(problem, settings, rng,
      p => onProgress?.({ phase: 'ga', fraction: p.fraction * GA_SHARE }));
    return runSimulatedAnnealing(problem, settings, rng, global,
      p => onProgress?.({ phase: 'sa', fraction: GA_SHARE + p.fraction * (1 - GA_SHARE) }));
  },
};
