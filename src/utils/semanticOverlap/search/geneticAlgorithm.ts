import type { AnalysisSettings } from '../types';
import type { MatchingProblem, Solution } from './matchingProblem';
import type { Rng } from './rng';
import { cloneAssignments, mutatedDimensions, randomAssignment, type SearchProgress, type SearchStrategy } from './strategy';

interface Individual {
  assignments: number[][];
  fitness: number;
}

function initialPopulation(problem: MatchingProblem, size: number, rng: Rng): Individual[] {
  const population: Individual[] = [];
  for (let k = 0; k < size; k++) {
    // Half random, half seeded from each element's most similar targets to speed up convergence.
    const seeded = k % 2 === 1;
    const assignments = Array.from({ length: problem.n }, (_, i) => {
      if (seeded && problem.m > 0) {
        const rank = rng.next() < 0.7 ? 0 : rng.int(problem.candidates[i].length);
        return [problem.candidates[i][rank]];
      }
      return randomAssignment(problem, i, rng);
    });
    population.push({ assignments, fitness: problem.fitness(assignments) });
  }
  return population;
}

/** Stochastic universal sampling (Moscato 1989), fitness-proportional. */
function selectParents(population: readonly Individual[], count: number, rng: Rng): Individual[] {
  const total = population.reduce((sum, ind) => sum + ind.fitness, 0);
  if (total <= 0) return Array.from({ length: count }, () => rng.pick(population));
  const step = total / count;
  let pointer = rng.next() * step;
  const selected: Individual[] = [];
  let cumulative = 0;
  let index = 0;
  for (let k = 0; k < count; k++) {
    while (cumulative + population[index].fitness < pointer && index < population.length - 1) {
      cumulative += population[index].fitness;
      index++;
    }
    selected.push(population[index]);
    pointer += step;
  }
  return selected;
}

function mutate(problem: MatchingProblem, assignments: number[][], dimensions: number, rng: Rng): void {
  for (let d = 0; d < dimensions; d++) {
    const i = rng.int(problem.n);
    assignments[i] = randomAssignment(problem, i, rng);
  }
}

/**
 * Genetic algorithm (paper Algorithm 1): SUS parent selection, one-point crossover on the solution
 * vector, mutation by re-assigning random dimensions, elitist environmental selection.
 */
export function runGeneticAlgorithm(
  problem: MatchingProblem,
  settings: AnalysisSettings,
  rng: Rng,
  onProgress?: (progress: SearchProgress) => void,
): Solution {
  const { ga } = settings;
  if (problem.n === 0) return { assignments: [], fitness: 0 };
  const dimensions = mutatedDimensions(problem, settings);
  let population = initialPopulation(problem, ga.populationSize, rng)
    .sort((a, b) => b.fitness - a.fitness);
  let best = population[0].fitness;
  let stall = 0;

  for (let generation = 0; generation < ga.generations; generation++) {
    const parents = selectParents(population, Math.max(2, Math.ceil(ga.populationSize / 2)), rng);
    const offspring: Individual[] = [];
    for (let k = 0; k + 1 < parents.length; k += 2) {
      const children = [cloneAssignments(parents[k].assignments), cloneAssignments(parents[k + 1].assignments)];
      if (problem.n > 1 && rng.next() < ga.crossoverRate) {
        const cut = 1 + rng.int(problem.n - 1);
        for (let i = cut; i < problem.n; i++) {
          [children[0][i], children[1][i]] = [children[1][i], children[0][i]];
        }
      }
      for (const child of children) {
        if (rng.next() < ga.mutationRate) mutate(problem, child, dimensions, rng);
        offspring.push({ assignments: child, fitness: problem.fitness(child) });
      }
    }
    population = [...population, ...offspring]
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, ga.populationSize);

    if (population[0].fitness > best + 1e-12) {
      best = population[0].fitness;
      stall = 0;
    } else if (++stall >= ga.stallGenerations) {
      onProgress?.({ phase: 'ga', fraction: 1 });
      break;
    }
    onProgress?.({ phase: 'ga', fraction: (generation + 1) / ga.generations });
  }
  return { assignments: cloneAssignments(population[0].assignments), fitness: population[0].fitness };
}

export const geneticAlgorithmStrategy: SearchStrategy = {
  id: 'ga',
  version: '1',
  search: runGeneticAlgorithm,
};
