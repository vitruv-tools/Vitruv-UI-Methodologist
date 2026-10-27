import { createRng } from '../../../../utils/semanticOverlap/search/rng';
import { randomAssignment } from '../../../../utils/semanticOverlap/search/strategy';
import { diagonalProblem } from '../helpers';

describe('matching problem', () => {
  it('scores an unmatched element with the null score and is Eq. 7 when everything is matched', () => {
    const problem = diagonalProblem(3, { nullScore: 0 });
    const diagonal = [[0], [1], [2]];
    const expected = (problem.matrices.combined[0] + problem.matrices.combined[4] + problem.matrices.combined[8]) / 3;
    expect(problem.fitness(diagonal)).toBeCloseTo(expected);
    expect(problem.fitness([[], [], []])).toBe(0);
    const withNull = diagonalProblem(3, { nullScore: 0.3 });
    expect(withNull.fitness([[], [], []])).toBeCloseTo(0.3);
  });

  it('delta equals the fitness difference', () => {
    const problem = diagonalProblem(5);
    const rng = createRng(5);
    const assignments = Array.from({ length: 5 }, (_, i) => randomAssignment(problem, i, rng));
    const solution = { assignments, fitness: problem.fitness(assignments) };
    for (let k = 0; k < 50; k++) {
      const i = rng.int(5);
      const next = randomAssignment(problem, i, rng);
      const changed = assignments.map((t, idx) => (idx === i ? next : t));
      expect(problem.delta(solution, i, next)).toBeCloseTo(problem.fitness(changed) - solution.fitness, 6);
    }
  });

  it('respects the maximum number of targets', () => {
    const problem = diagonalProblem(6, { maxTargetsPerElement: 2 });
    const rng = createRng(1);
    for (let k = 0; k < 200; k++) {
      const targets = randomAssignment(problem, k % 6, rng);
      expect(targets.length).toBeLessThanOrEqual(2);
      expect(new Set(targets).size).toBe(targets.length);
      targets.forEach(j => expect(j >= 0 && j < 6).toBe(true));
    }
  });
});
