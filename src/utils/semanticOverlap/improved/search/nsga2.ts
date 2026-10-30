/*
 * Two-objective search for alternative results (Fang 2022; NSGA-II, Deb et al. 2002). Crossover and
 * mutation are copies of the paper approach's GA operators (`search/geneticAlgorithm.ts`); they
 * evolve separately — do not import from the paper pipeline for logic.
 */
import type { AnalysisSettings, AlternativeLabel } from '../../types';
import type { Rng } from '../../search/rng';
import { cloneAssignments, mutatedDimensions, randomAssignment, type SearchProgress } from '../../search/strategy';
import type { MatchingProblem, ScoreBreakdown } from '../matchingProblem';
import type { ImprovedSettings } from '../settings';

/** Additional measures that count towards the lexical objective; all others are structural. */
const LEXICAL_MEASURES = new Set(['name-tokens', 'hypernym', 'embedding']);

export interface Objectives {
  lexical: number;
  structural: number;
}

interface Individual {
  assignments: number[][];
  objectives: Objectives;
  rank: number;
  crowding: number;
}

/** A labelled solution of the final front. */
export interface LabelledSolution {
  assignments: number[][];
  objectives: Objectives;
  labels: AlternativeLabel[];
}

const weightOf = (problem: MatchingProblem, id: string) =>
  problem.matrices.effectiveWeights?.extras[id] ?? problem.settings.measures.find(m => m.id === id)?.weight ?? 0;

/** Lexical and structural score of one source against its targets (weighted like the combination). */
function elementObjectives(problem: MatchingProblem, i: number, breakdown: ScoreBreakdown, targets: readonly number[]): Objectives {
  const weights = problem.matrices.effectiveWeights ?? problem.settings.weights;
  const parts = { lexical: [weights.syntactic * breakdown.syntactic, weights.syntactic], structural: [weights.structural * breakdown.structural, weights.structural] };
  for (const [id, value] of Object.entries(breakdown.extras)) {
    if (Number.isNaN(value)) continue;
    const weight = weightOf(problem, id);
    const part = LEXICAL_MEASURES.has(id) ? parts.lexical : parts.structural;
    part[0] += weight * value;
    part[1] += weight;
  }
  const flooding = problem.matrices.flooding;
  if (flooding) {
    const flood = targets.reduce((sum, j) => sum + flooding.matrix[i * problem.m + j], 0) / targets.length;
    parts.structural[0] += flooding.weight * flood;
    parts.structural[1] += flooding.weight;
  }
  return {
    lexical: parts.lexical[1] === 0 ? 0 : parts.lexical[0] / parts.lexical[1],
    structural: parts.structural[1] === 0 ? 0 : parts.structural[0] / parts.structural[1],
  };
}

/** Both objectives: means over all sources, with the null score for unmatched ones. */
export function objectivesOf(problem: MatchingProblem, assignments: readonly (readonly number[])[]): Objectives {
  if (problem.n === 0) return { lexical: 0, structural: 0 };
  let lexical = 0;
  let structural = 0;
  for (let i = 0; i < problem.n; i++) {
    const targets = assignments[i];
    if (targets.length === 0) {
      lexical += problem.settings.nullScore;
      structural += problem.settings.nullScore;
      continue;
    }
    const values = elementObjectives(problem, i, problem.scoreOf(i, targets), targets);
    lexical += values.lexical;
    structural += values.structural;
  }
  return { lexical: lexical / problem.n, structural: structural / problem.n };
}

const dominates = (a: Objectives, b: Objectives) =>
  a.lexical >= b.lexical && a.structural >= b.structural && (a.lexical > b.lexical || a.structural > b.structural);

/** Fast non-dominated sorting: fronts of indices, the first one non-dominated. */
export function nonDominatedFronts(points: readonly Objectives[]): number[][] {
  const dominatedBy = points.map(() => [] as number[]);
  const counts = points.map(() => 0);
  const fronts: number[][] = [[]];
  points.forEach((p, i) => {
    points.forEach((q, j) => {
      if (i === j) return;
      if (dominates(p, q)) dominatedBy[i].push(j);
      else if (dominates(q, p)) counts[i]++;
    });
    if (counts[i] === 0) fronts[0].push(i);
  });
  for (let k = 0; fronts[k].length > 0; k++) {
    const next: number[] = [];
    for (const i of fronts[k]) {
      for (const j of dominatedBy[i]) if (--counts[j] === 0) next.push(j);
    }
    fronts.push(next);
  }
  return fronts.filter(front => front.length > 0);
}

/** Crowding distance of the points of one front (extremes get infinity). */
export function crowdingDistances(points: readonly Objectives[]): number[] {
  const distances = points.map(() => 0);
  for (const key of ['lexical', 'structural'] as const) {
    const order = points.map((_, i) => i).sort((a, b) => points[a][key] - points[b][key] || a - b);
    const range = points[order[order.length - 1]][key] - points[order[0]][key];
    distances[order[0]] = Number.POSITIVE_INFINITY;
    distances[order[order.length - 1]] = Number.POSITIVE_INFINITY;
    if (range === 0) continue;
    for (let k = 1; k < order.length - 1; k++) {
      distances[order[k]] += (points[order[k + 1]][key] - points[order[k - 1]][key]) / range;
    }
  }
  return distances;
}

function rankAndCrowd(population: Individual[]): Individual[] {
  const fronts = nonDominatedFronts(population.map(p => p.objectives));
  fronts.forEach((front, rank) => {
    const distances = crowdingDistances(front.map(i => population[i].objectives));
    front.forEach((i, k) => Object.assign(population[i], { rank, crowding: distances[k] }));
  });
  return population;
}

const better = (a: Individual, b: Individual) => a.rank < b.rank || (a.rank === b.rank && a.crowding > b.crowding);

function initialPopulation(problem: MatchingProblem, size: number, rng: Rng): Individual[] {
  return Array.from({ length: size }, (_, k) => {
    // Half random, half seeded from each element's most similar targets (as in the GA).
    const seeded = k % 2 === 1;
    const assignments = Array.from({ length: problem.n }, (_, i) => {
      if (seeded && problem.m > 0) {
        const rank = rng.next() < 0.7 ? 0 : rng.int(problem.candidates[i].length);
        return [problem.candidates[i][rank]];
      }
      return randomAssignment(problem, i, rng);
    });
    return { assignments, objectives: objectivesOf(problem, assignments), rank: 0, crowding: 0 };
  });
}

function mutate(problem: MatchingProblem, assignments: number[][], dimensions: number, rng: Rng): void {
  for (let d = 0; d < dimensions; d++) {
    const i = rng.int(problem.n);
    assignments[i] = randomAssignment(problem, i, rng);
  }
}

const keyOf = (assignments: readonly (readonly number[])[]) => assignments.map(targets => targets.join('.')).join('|');

/** Binary tournament on rank, then crowding distance. */
const tournament = (population: readonly Individual[], rng: Rng) => {
  const a = rng.pick(population);
  const b = rng.pick(population);
  return better(b, a) ? b : a;
};

/** The final non-dominated front of an NSGA-II run (population and generations from the GA settings). */
export function nsga2Front(problem: MatchingProblem, settings: AnalysisSettings, rng: Rng, onProgress?: (progress: SearchProgress) => void): { assignments: number[][]; objectives: Objectives }[] {
  const { ga } = settings;
  if (problem.n === 0) return [{ assignments: [], objectives: { lexical: 0, structural: 0 } }];
  const dimensions = mutatedDimensions(problem, settings);
  let population = rankAndCrowd(initialPopulation(problem, ga.populationSize, rng));
  for (let generation = 0; generation < ga.generations; generation++) {
    const offspring: Individual[] = [];
    while (offspring.length < ga.populationSize) {
      const children = [cloneAssignments(tournament(population, rng).assignments), cloneAssignments(tournament(population, rng).assignments)];
      if (problem.n > 1 && rng.next() < ga.crossoverRate) {
        const cut = 1 + rng.int(problem.n - 1);
        for (let i = cut; i < problem.n; i++) [children[0][i], children[1][i]] = [children[1][i], children[0][i]];
      }
      for (const child of children) {
        if (rng.next() < ga.mutationRate) mutate(problem, child, dimensions, rng);
        offspring.push({ assignments: child, objectives: objectivesOf(problem, child), rank: 0, crowding: 0 });
      }
    }
    // Environmental selection: whole fronts, the last one cut by crowding distance; duplicates once.
    const unique = new Map<string, Individual>();
    for (const ind of [...population, ...offspring]) {
      const key = keyOf(ind.assignments);
      if (!unique.has(key)) unique.set(key, ind);
    }
    const combined = rankAndCrowd([...unique.values()]);
    population = combined.sort((a, b) => a.rank - b.rank || b.crowding - a.crowding || keyOf(a.assignments).localeCompare(keyOf(b.assignments)))
      .slice(0, ga.populationSize);
    onProgress?.({ phase: 'ga', fraction: (generation + 1) / ga.generations });
  }
  return population.filter(ind => ind.rank === 0)
    .map(ind => ({ assignments: cloneAssignments(ind.assignments), objectives: ind.objectives }))
    .sort((a, b) => a.objectives.lexical - b.objectives.lexical || keyOf(a.assignments).localeCompare(keyOf(b.assignments)));
}

/**
 * The lexical extreme, the structural extreme and the knee (largest distance to the line between
 * the extremes on the side of the ideal point, the balanced default) of a front. Identical picks collapse into one with joined
 * labels. Returns lexical, balanced, structural in this order, at most `count`, balanced always.
 */
export function selectAlternatives(front: readonly { assignments: number[][]; objectives: Objectives }[], count: number): LabelledSolution[] {
  const byLexical = [...front].sort((a, b) => b.objectives.lexical - a.objectives.lexical || b.objectives.structural - a.objectives.structural);
  const byStructural = [...front].sort((a, b) => b.objectives.structural - a.objectives.structural || b.objectives.lexical - a.objectives.lexical);
  const lexical = byLexical[0];
  const structural = byStructural[0];
  const dx = structural.objectives.lexical - lexical.objectives.lexical;
  const dy = structural.objectives.structural - lexical.objectives.structural;
  const length = Math.hypot(dx, dy);
  // Signed distance to the line between the extremes, positive on the side of the ideal point (1, 1):
  // only points bulging outwards are knees; points on the inner side (e.g. "nothing matched") are not.
  const side = (p: Objectives) => dx * (p.structural - lexical.objectives.structural) - dy * (p.lexical - lexical.objectives.lexical);
  const towardsIdeal = Math.sign(side({ lexical: 1, structural: 1 })) || 1;
  const distance = (p: Objectives) => (length === 0 ? 0 : (towardsIdeal * side(p)) / length);
  const sum = (p: Objectives) => p.lexical + p.structural;
  const outward = front.filter(p => distance(p.objectives) > 1e-12);
  // Without an outward point, the better extreme (larger sum of both objectives) is the balanced one.
  const knee = outward.length > 0
    ? [...outward].sort((a, b) => distance(b.objectives) - distance(a.objectives) || sum(b.objectives) - sum(a.objectives))[0]
    : [lexical, structural].sort((a, b) => sum(b.objectives) - sum(a.objectives))[0];
  const picks: [AlternativeLabel, typeof front[number]][] = [['lexical', lexical], ['balanced', knee], ['structural', structural]];
  const merged: LabelledSolution[] = [];
  for (const [label, pick] of picks) {
    const same = merged.find(m => keyOf(m.assignments) === keyOf(pick.assignments));
    if (same) same.labels.push(label);
    else merged.push({ assignments: pick.assignments, objectives: pick.objectives, labels: [label] });
  }
  const balanced = merged.find(m => m.labels.includes('balanced'))!;
  const others = merged.filter(m => m !== balanced);
  const kept = new Set([balanced, ...others.slice(0, Math.max(0, count - 1))]);
  return merged.filter(m => kept.has(m));
}

/** Up to `params.alternativesCount` labelled alternatives of an NSGA-II run. */
export function searchAlternatives(
  problem: MatchingProblem,
  settings: ImprovedSettings,
  rng: Rng,
  onProgress?: (progress: SearchProgress) => void,
): LabelledSolution[] {
  return selectAlternatives(nsga2Front(problem, settings, rng, onProgress), settings.params.alternativesCount);
}
