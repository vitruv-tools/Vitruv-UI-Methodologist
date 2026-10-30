import { createMatchingProblem } from '../../../../../utils/semanticOverlap/improved/matchingProblem';
import { createDefaultMeasureRegistry } from '../../../../../utils/semanticOverlap/improved/measures/registry';
import {
  crowdingDistances, nonDominatedFronts, nsga2Front, objectivesOf, searchAlternatives, selectAlternatives, type Objectives,
} from '../../../../../utils/semanticOverlap/improved/search/nsga2';
import { improvementsOf, resolveImprovedSettings } from '../../../../../utils/semanticOverlap/improved/settings';
import { createRng } from '../../../../../utils/semanticOverlap/search/rng';

const point = (lexical: number, structural: number): Objectives => ({ lexical, structural });

/** A 2 × 2 problem whose lexical and structural evidence point to different pairs. */
function crossedProblem(nullScore = 0.25) {
  const settings = resolveImprovedSettings({ seed: 1, nullScore, maxTargetsPerElement: 1, improvements: improvementsOf(['alternatives']) }, 'fast');
  const structural = Float32Array.from([0.9, 0.1, 0.1, 0.9]);
  const syntactic = Float32Array.from([0.1, 0.9, 0.9, 0.1]);
  const combined = structural.map((s, k) => (s + syntactic[k]) / 2);
  const matrices = { n: 2, m: 2, perMeasure: { 'name-tokens': syntactic }, structural, syntactic, combined };
  const profile = () => ({ metrics: [0] }) as never;
  return createMatchingProblem('class', [profile(), profile()], [profile(), profile()], matrices,
    createDefaultMeasureRegistry(), { ...settings, measures: [] });
}

describe('NSGA-II alternatives', () => {
  it('sorts points into non-dominated fronts', () => {
    expect(nonDominatedFronts([point(1, 0), point(0, 1), point(0.5, 0.5), point(0.4, 0.4), point(0, 0)]))
      .toEqual([[0, 1, 2], [3], [4]]);
  });

  it('gives the extremes infinite crowding distance and the others the normalised gap', () => {
    const distances = crowdingDistances([point(0, 1), point(0.5, 0.5), point(1, 0)]);
    expect(distances[0]).toBe(Number.POSITIVE_INFINITY);
    expect(distances[2]).toBe(Number.POSITIVE_INFINITY);
    expect(distances[1]).toBeCloseTo(2);
  });

  it('scores the lexical objective from syntactic evidence and the structural one from structure, τ for unmatched', () => {
    const problem = crossedProblem();
    expect(objectivesOf(problem, [[0], [1]])).toEqual({ lexical: expect.closeTo(0.1), structural: expect.closeTo(0.9) });
    expect(objectivesOf(problem, [[1], [0]])).toEqual({ lexical: expect.closeTo(0.9), structural: expect.closeTo(0.1) });
    expect(objectivesOf(problem, [[], []])).toEqual({ lexical: 0.25, structural: 0.25 });
  });

  it('selects the extremes and the knee (largest distance to the line between them) as balanced', () => {
    const front = [point(1, 0), point(0.8, 0.7), point(0.5, 0.8), point(0, 1)].map((objectives, k) => ({ assignments: [[k]], objectives }));
    const picked = selectAlternatives(front, 3);
    expect(picked.map(p => [p.labels, p.objectives])).toEqual([
      [['lexical'], point(1, 0)], [['balanced'], point(0.8, 0.7)], [['structural'], point(0, 1)],
    ]);
    expect(selectAlternatives(front, 1).map(p => p.labels)).toEqual([['balanced']]);
  });

  it('never picks a point on the inner side of the line as knee; then the better extreme is balanced', () => {
    // "Nothing matched" (τ, τ) lies below the line between the extremes.
    const front = [point(0.917, 0.185), point(0.25, 0.25), point(0.175, 0.278)].map((objectives, k) => ({ assignments: [[k]], objectives }));
    const picked = selectAlternatives(front, 3);
    expect(picked.map(p => [p.labels, p.objectives])).toEqual([[['lexical', 'balanced'], point(0.917, 0.185)], [['structural'], point(0.175, 0.278)]]);
  });

  it('collapses identical picks into one alternative with joined labels', () => {
    const single = [{ assignments: [[0]], objectives: point(0.5, 0.5) }];
    expect(selectAlternatives(single, 3)).toEqual([{ assignments: [[0]], objectives: point(0.5, 0.5), labels: ['lexical', 'balanced', 'structural'] }]);
  });

  it('finds both extremes of a crossed problem and is deterministic for a seed', () => {
    const problem = crossedProblem();
    const front = nsga2Front(problem, problem.settings, createRng(7));
    expect(front.map(f => f.assignments)).toEqual(expect.arrayContaining([[[1], [0]], [[0], [1]]]));
    expect(nsga2Front(problem, problem.settings, createRng(7))).toEqual(front);
    const alternatives = searchAlternatives(problem, problem.settings as never, createRng(7));
    expect(alternatives.filter(a => a.labels.includes('balanced'))).toHaveLength(1);
    expect(alternatives.length).toBeGreaterThanOrEqual(1);
    expect(alternatives.length).toBeLessThanOrEqual(3);
  });
});
