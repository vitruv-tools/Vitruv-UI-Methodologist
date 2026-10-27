import { runGeneticAlgorithm } from '../../../../utils/semanticOverlap/search/geneticAlgorithm';
import { hybridGaSaStrategy } from '../../../../utils/semanticOverlap/search/hybridGaSaStrategy';
import { createDefaultStrategyRegistry, UnknownStrategyError } from '../../../../utils/semanticOverlap/search/registry';
import { createRng } from '../../../../utils/semanticOverlap/search/rng';
import type { SearchStrategy } from '../../../../utils/semanticOverlap/search/strategy';
import { diagonalProblem } from '../helpers';

describe('hybrid GA + SA strategy', () => {
  it('is at least as good as the GA alone with the same seed', () => {
    const problem = diagonalProblem(8, { ga: { populationSize: 4, generations: 2, crossoverRate: 0.9, mutationRate: 0.2, mutatedFraction: 0.05, stallGenerations: 5 } });
    const settings = { ...problem.settings, ga: { ...problem.settings.ga, populationSize: 4, generations: 2 } };
    const gaOnly = runGeneticAlgorithm(problem, settings, createRng(6));
    const hybrid = hybridGaSaStrategy.search(problem, settings, createRng(6));
    expect(hybrid.fitness).toBeGreaterThanOrEqual(gaOnly.fitness - 1e-9);
  });

  it('reports monotonic GA then SA progress', () => {
    const problem = diagonalProblem(4);
    const progress: { phase: string; fraction: number }[] = [];
    hybridGaSaStrategy.search(problem, problem.settings, createRng(1), p => progress.push(p));
    expect(progress[0].phase).toBe('ga');
    expect(progress[progress.length - 1]).toEqual({ phase: 'sa', fraction: 1 });
    progress.slice(1).forEach((p, k) => expect(p.fraction).toBeGreaterThanOrEqual(progress[k].fraction));
  });

  it('has a registry with the default strategies that accepts custom ones', () => {
    const registry = createDefaultStrategyRegistry();
    expect(registry.list().map(s => s.id)).toEqual(['hybrid-ga-sa', 'ga', 'sa']);
    const custom: SearchStrategy = { id: 'none', version: '1', search: p => ({ assignments: p.sources.map(() => []), fitness: 0 }) };
    registry.register(custom);
    expect(registry.get('none')).toBe(custom);
    expect(() => registry.get('missing')).toThrow(UnknownStrategyError);
  });
});
