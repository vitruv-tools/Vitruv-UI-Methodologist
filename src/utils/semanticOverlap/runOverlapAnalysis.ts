import type { LexicalSource } from './lexical/wordNetSource';
import { buildClassProfiles, buildFeatureProfiles } from './measures/profiles';
import { createDefaultMeasureRegistry } from './measures/registry';
import { computeMatrices, extraMeasures } from './measures/similarityMatrices';
import type { MeasureRegistry } from './measures/types';
import { BUILT_IN_MEASURES } from './measures/types';
import { createMatchingProblem, type MatchingProblem, type Solution } from './search/matchingProblem';
import { createDefaultStrategyRegistry, type StrategyRegistry } from './search/registry';
import { createRng, hashString } from './search/rng';
import { validateSettings } from './settings';
import type { SearchStrategy } from './search/strategy';
import type {
  AnalysisSettings, ClassNode, Correspondence, ElementRef, FeatureNode, MatchLevel, MetamodelGraph, OverlapInput, OverlapResult, Progress,
} from './types';

export class InvalidSettingsError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid analysis settings: ${problems.join(' ')}`);
    this.name = 'InvalidSettingsError';
  }
}

export interface AnalysisDeps {
  lexical: LexicalSource;
  measures?: MeasureRegistry;
  strategies?: StrategyRegistry;
  onProgress?: (progress: Progress) => void;
  /** Milliseconds since the epoch; injectable for deterministic tests. */
  now?: () => number;
  createId?: () => string;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const clampUnit = (value: number) => Math.min(1, Math.max(0, value));
const byQualifiedName = (a: ElementRef, b: ElementRef) => a.qualifiedName.localeCompare(b.qualifiedName);

/** Progress milestones: profiling, then the class-level search, then the feature level. */
const PROFILING_END = 0.1;
const CLASS_SEARCH_END = 0.8;

/** Own and inherited attributes and references of a class (supertypes within the same file). */
export function featuresWithInherited(graph: MetamodelGraph, qualifiedName: string): FeatureNode[] {
  const byName = new Map(graph.classes.map(c => [c.qualifiedName, c]));
  const seen = new Set<string>();
  const result: FeatureNode[] = [];
  const visit = (node: ClassNode | undefined) => {
    if (!node || seen.has(node.qualifiedName)) return;
    seen.add(node.qualifiedName);
    result.push(...node.attributes, ...node.references);
    node.superTypes.forEach(parent => visit(byName.get(parent)));
  };
  visit(byName.get(qualifiedName));
  return result;
}

const uniqueFeatures = (features: FeatureNode[]) =>
  [...new Map(features.map(f => [f.qualifiedName, f])).values()];

/**
 * Matches the attributes and references of the classes in one class correspondence (FR-012) with
 * the same strategy; the child RNG is derived from the seed and the correspondence id.
 */
function matchFeatures(
  correspondence: Correspondence,
  input: OverlapInput,
  deps: { lexical: LexicalSource; measures: MeasureRegistry; strategy: SearchStrategy },
  settings: AnalysisSettings,
): Correspondence[] {
  const collect = (graph: MetamodelGraph, refs: ElementRef[]) =>
    uniqueFeatures(refs.flatMap(ref => featuresWithInherited(graph, ref.qualifiedName)));
  const sources = buildFeatureProfiles(collect(input.source, correspondence.sources), 'source', deps.lexical, settings);
  const targets = buildFeatureProfiles(collect(input.target, correspondence.targets), 'target', deps.lexical, settings);
  if (sources.length === 0 || targets.length === 0) return [];
  const matrices = computeMatrices('feature', sources, targets, deps.measures, settings);
  const problem = createMatchingProblem('feature', sources, targets, matrices, deps.measures, settings);
  const solution = deps.strategy.search(problem, settings, createRng((settings.seed ^ hashString(correspondence.id)) >>> 0));
  return solutionToCorrespondences(problem, solution, 'feature', `${correspondence.id}-f`).correspondences;
}

/**
 * Turns a solution into correspondences (grouping rule, FR-010): every connected component of the
 * source → target assignment graph becomes one correspondence, so sources sharing a target appear
 * together (e.g. `EAttribute, EReference ↔ Property`). Scores are the means of the sources'
 * objective values against their own chosen targets. Ids `<prefix>-1…` follow the descending score.
 */
export function solutionToCorrespondences(
  problem: MatchingProblem,
  solution: Solution,
  level: MatchLevel,
  idPrefix = 'c',
): { correspondences: Correspondence[]; unmatched: { source: ElementRef[]; target: ElementRef[] } } {
  const { n, m } = problem;
  // Union-find over sources 0..n-1 and targets n..n+m-1.
  const parent = Array.from({ length: n + m }, (_, k) => k);
  const find = (k: number): number => {
    while (parent[k] !== k) {
      parent[k] = parent[parent[k]];
      k = parent[k];
    }
    return k;
  };
  solution.assignments.forEach((targets, i) => {
    for (const j of targets) parent[find(i)] = find(n + j);
  });

  const components = new Map<number, { sources: number[]; targets: Set<number> }>();
  solution.assignments.forEach((targets, i) => {
    if (targets.length === 0) return;
    const root = find(i);
    const component = components.get(root) ?? { sources: [], targets: new Set<number>() };
    component.sources.push(i);
    targets.forEach(j => component.targets.add(j));
    components.set(root, component);
  });

  const unsorted = [...components.values()].map(component => {
    const breakdowns = component.sources.map(i => problem.scoreOf(i, solution.assignments[i]));
    const mean = (pick: (b: typeof breakdowns[number]) => number) =>
      clampUnit(breakdowns.reduce((sum, b) => sum + pick(b), 0) / breakdowns.length);
    const scores: Record<string, number> = {
      structural: mean(b => b.structural),
      syntactic: mean(b => b.syntactic),
    };
    for (const id of Object.keys(breakdowns[0].extras)) scores[id] = mean(b => b.extras[id]);
    return {
      level,
      sources: component.sources.map(i => problem.sources[i].ref).sort(byQualifiedName),
      targets: [...component.targets].map(j => problem.targets[j].ref).sort(byQualifiedName),
      score: mean(b => b.combined),
      scores,
    };
  });
  unsorted.sort((a, b) => b.score - a.score
    || a.sources[0].qualifiedName.localeCompare(b.sources[0].qualifiedName));
  const correspondences = unsorted.map((c, k) => ({ id: `${idPrefix}-${k + 1}`, ...c }));

  const matchedTargets = new Set(solution.assignments.flat());
  return {
    correspondences,
    unmatched: {
      source: problem.sources.filter((_, i) => solution.assignments[i].length === 0).map(p => p.ref),
      target: problem.targets.filter((_, j) => !matchedTargets.has(j)).map(p => p.ref),
    },
  };
}

/**
 * Runs the semantic overlap analysis (Kessentini et al. 2014) on two metamodel graphs. Pure: no DOM,
 * network or global state. The same input (incl. seed) and dependencies give the same result apart
 * from `id`, `createdAt` and `durationMs`.
 */
export function runOverlapAnalysis(input: OverlapInput, deps: AnalysisDeps): OverlapResult {
  const { source, target, settings } = input;
  const problems = validateSettings(settings);
  if (problems.length > 0) throw new InvalidSettingsError(problems);
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const measures = deps.measures ?? createDefaultMeasureRegistry();
  const strategies = deps.strategies ?? createDefaultStrategyRegistry();
  const strategy = strategies.get(settings.strategy);
  const report = (progress: Progress) => deps.onProgress?.(progress);

  const warnings: string[] = [];
  if (deps.lexical.id === 'none') {
    warnings.push('WordNet synonyms could not be loaded; names were compared without synonyms.');
  }
  for (const graph of [source, target]) {
    for (const supertype of graph.unresolvedSupertypes) {
      warnings.push(`${graph.ref.name}: supertype ${supertype} is defined in another file and was ignored.`);
    }
  }

  report({ phase: 'profiling', fraction: 0.02 });
  const sourceProfiles = buildClassProfiles(source, 'source', deps.lexical, settings);
  const targetProfiles = buildClassProfiles(target, 'target', deps.lexical, settings);
  const matrices = computeMatrices('class', sourceProfiles, targetProfiles, measures, settings);
  report({ phase: 'profiling', fraction: PROFILING_END });

  const problem = createMatchingProblem('class', sourceProfiles, targetProfiles, matrices, measures, settings);
  let correspondences: Correspondence[] = [];
  let unmatched = { source: sourceProfiles.map(p => p.ref), target: targetProfiles.map(p => p.ref) };
  let fitness = 0;
  if (problem.n === 0 || problem.m === 0) {
    warnings.push('One of the metamodels has no classes, so no overlap can be computed.');
  } else {
    const solution = strategy.search(problem, settings, createRng(settings.seed),
      p => report({ phase: p.phase, fraction: PROFILING_END + p.fraction * (CLASS_SEARCH_END - PROFILING_END) }));
    fitness = solution.fitness;
    ({ correspondences, unmatched } = solutionToCorrespondences(problem, solution, 'class'));
    correspondences = correspondences.map((correspondence, k) => {
      report({ phase: 'features', fraction: CLASS_SEARCH_END + (k / correspondences.length) * (1 - CLASS_SEARCH_END) });
      return { ...correspondence, children: matchFeatures(correspondence, input, { lexical: deps.lexical, measures, strategy }, settings) };
    });
  }
  report({ phase: 'features', fraction: 1 });

  const matchedSource = sourceProfiles.length - unmatched.source.length;
  const matchedTarget = targetProfiles.length - unmatched.target.length;
  const totalClasses = sourceProfiles.length + targetProfiles.length;
  const perMeasure: Record<string, number[]> = {};
  for (const [id, matrix] of Object.entries(matrices.perMeasure)) perMeasure[id] = Array.from(matrix, round3);

  return {
    schemaVersion: 1,
    id: deps.createId?.() ?? globalThis.crypto.randomUUID(),
    createdAt: new Date(startedAt).toISOString(),
    durationMs: Math.max(0, now() - startedAt),
    source: source.ref,
    target: target.ref,
    settings,
    engine: {
      strategy: { id: strategy.id, version: strategy.version },
      measures: [
        ...BUILT_IN_MEASURES.map(id => ({ id, version: measures.get(id, 'class').version })),
        ...extraMeasures(measures, 'class', settings).map(e => ({ id: e.measure.id, version: e.measure.version, weight: e.weight })),
      ],
      lexicalSource: deps.lexical.id === 'none' ? null : { id: deps.lexical.id, version: deps.lexical.version },
    },
    warnings,
    summary: {
      sourceClassCount: sourceProfiles.length,
      targetClassCount: targetProfiles.length,
      matchedSourceClasses: matchedSource,
      matchedTargetClasses: matchedTarget,
      overlapPercent: totalClasses === 0 ? 0 : round3(((matchedSource + matchedTarget) / totalClasses) * 100),
      fitness: round3(fitness),
    },
    classMatrix: {
      rows: sourceProfiles.map(p => p.ref.qualifiedName),
      columns: targetProfiles.map(p => p.ref.qualifiedName),
      overall: Array.from(matrices.combined, value => round3(clampUnit(value))),
      perMeasure,
    },
    correspondences,
    unmatched,
  };
}
