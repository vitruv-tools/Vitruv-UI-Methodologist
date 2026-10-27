import { createRng } from '../../../../utils/semanticOverlap/search/rng';
import { runSimulatedAnnealing } from '../../../../utils/semanticOverlap/search/simulatedAnnealing';
import { diagonalProblem } from '../helpers';

describe('simulated annealing', () => {
  it('improves a deliberately bad start', () => {
    const problem = diagonalProblem(6);
    const bad = [[5], [4], [3], [2], [1], [0]];
    const start = { assignments: bad, fitness: problem.fitness(bad) };
    const result = runSimulatedAnnealing(problem, problem.settings, createRng(4), start);
    expect(result.fitness).toBeGreaterThan(start.fitness);
    expect(result.assignments).toEqual([[0], [1], [2], [3], [4], [5]]);
  });

  it('is deterministic for a seed', () => {
    const problem = diagonalProblem(6);
    const start = { assignments: [[0], [0], [0], [0], [0], [0]], fitness: 0 };
    start.fitness = problem.fitness(start.assignments);
    expect(runSimulatedAnnealing(problem, problem.settings, createRng(2), start))
      .toEqual(runSimulatedAnnealing(problem, problem.settings, createRng(2), start));
  });
});
