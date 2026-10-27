import { runGeneticAlgorithm } from '../../../../utils/semanticOverlap/search/geneticAlgorithm';
import { createRng } from '../../../../utils/semanticOverlap/search/rng';
import { diagonalProblem } from '../helpers';

describe('genetic algorithm', () => {
  it('finds the diagonal optimum of a 5×5 problem', () => {
    const problem = diagonalProblem(5);
    const solution = runGeneticAlgorithm(problem, problem.settings, createRng(3));
    expect(solution.assignments).toEqual([[0], [1], [2], [3], [4]]);
    expect(solution.fitness).toBeCloseTo(problem.fitness(solution.assignments));
  });

  it('is deterministic for a seed and reports progress', () => {
    const problem = diagonalProblem(6);
    const progress: number[] = [];
    const a = runGeneticAlgorithm(problem, problem.settings, createRng(8), p => progress.push(p.fraction));
    const b = runGeneticAlgorithm(problem, problem.settings, createRng(8));
    expect(a).toEqual(b);
    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1]).toBe(1);
  });
});
