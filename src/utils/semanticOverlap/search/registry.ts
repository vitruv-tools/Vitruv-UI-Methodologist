import { geneticAlgorithmStrategy } from './geneticAlgorithm';
import { hybridGaSaStrategy } from './hybridGaSaStrategy';
import { simulatedAnnealingStrategy } from './simulatedAnnealing';
import type { SearchStrategy } from './strategy';

export class UnknownStrategyError extends Error {
  constructor(id: string) {
    super(`Unknown search strategy "${id}"`);
    this.name = 'UnknownStrategyError';
  }
}

export interface StrategyRegistry {
  register(strategy: SearchStrategy): void;
  get(id: string): SearchStrategy;
  list(): readonly SearchStrategy[];
}

export function createStrategyRegistry(strategies: readonly SearchStrategy[] = []): StrategyRegistry {
  const byId = new Map<string, SearchStrategy>();
  const registry: StrategyRegistry = {
    register: strategy => { byId.set(strategy.id, strategy); },
    get: id => {
      const strategy = byId.get(id);
      if (!strategy) throw new UnknownStrategyError(id);
      return strategy;
    },
    list: () => [...byId.values()],
  };
  strategies.forEach(registry.register);
  return registry;
}

/** `hybrid-ga-sa` (default), `ga` and `sa`. */
export function createDefaultStrategyRegistry(): StrategyRegistry {
  return createStrategyRegistry([hybridGaSaStrategy, geneticAlgorithmStrategy, simulatedAnnealingStrategy]);
}
