/*
 * Independent copy of the paper approach's `runOverlapAnalysis.ts`; evolves separately — do not
 * import from the paper pipeline for logic.
 */
import type { LexicalSource } from '../lexical/wordNetSource';
import { buildClassProfiles, buildFeatureProfiles, classDocument, nameTokens, type ProfileOptions } from './measures/profiles';
import { documentFrequencies, idfWeights } from './lexical/idf';
import { completeHierarchyBothSides } from './hierarchy/completeHierarchyBothSides';
import { blend, buildClassGraph, similarityFlooding } from './flooding/similarityFlooding';
import { detectTypeObject, type FixedCorrespondence, type TypeObjectMatch } from './typeObject/detectTypeObject';
import type { SimilarityMatrices } from './measures/similarityMatrices';
import { createDefaultMeasureRegistry } from './measures/registry';
import { computeMatrices, extraMeasures } from './measures/similarityMatrices';
import { DATATYPES, HYPERNYM, ROLES, type MeasureRegistry } from './measures/types';
import { BUILT_IN_MEASURES } from './measures/types';
import { createMatchingProblem, type MatchingProblem, type Solution } from './matchingProblem';
import { createDefaultStrategyRegistry, type StrategyRegistry } from '../search/registry';
import { createRng, hashString } from '../search/rng';
import { isOn, validateImprovedSettings, type ImprovedSettings } from './settings';
import type { HypernymSource } from './lexical/hypernymSource';
import type { SearchStrategy } from '../search/strategy';
import type {
  AnalysisSettings, ClassNode, Correspondence, ElementRef, FeatureNode, MatchLevel, MeasureWeight, MetamodelGraph, OverlapInput,
  OverlapResult, Progress, TypeObjectPattern,
} from '../types';

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
  /** WordNet hypernym graph; null or absent when it could not be loaded. */
  hypernyms?: HypernymSource | null;
}

/** Input of the improved approach: like {@link OverlapInput}, with the improved settings. */
export interface ImprovedInput extends OverlapInput {
  settings: ImprovedSettings;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const clampUnit = (value: number) => Math.min(1, Math.max(0, value));
const byQualifiedName = (a: ElementRef, b: ElementRef) => a.qualifiedName.localeCompare(b.qualifiedName);

/** Progress milestones: profiling, then the class-level search, then the feature level. */
const PROFILING_END = 0.1;
const CLASS_SEARCH_END = 0.8;

/**
 * Hierarchy completion (extension of the paper, after the search): an unmatched target class whose
 * most similar source is already matched to the target's direct supertype or subtype, with a
 * combined similarity of at least the null score, joins that source's correspondence. UML often
 * splits one Ecore concept over a class and its super- or subtype (`Classifier`/`Type`,
 * `DataType`/`PrimitiveType`); the search alone rarely adds such weaker second targets.
 */
export function completeHierarchy(problem: MatchingProblem, solution: Solution, target: MetamodelGraph): Solution {
  const { n, m, matrices, settings } = problem;
  const index = new Map(problem.targets.map((p, j) => [p.ref.qualifiedName, j]));
  const related = new Map<number, Set<number>>();
  const link = (a: number, b: number) => {
    if (!related.has(a)) related.set(a, new Set());
    related.get(a)!.add(b);
  };
  for (const node of target.classes) {
    const child = index.get(node.qualifiedName);
    for (const parent of node.superTypes.map(name => index.get(name))) {
      if (child === undefined || parent === undefined) continue;
      link(child, parent);
      link(parent, child);
    }
  }
  const assignments = solution.assignments.map(targets => [...targets]);
  const matched = new Set(assignments.flat());
  for (let j = 0; j < m; j++) {
    if (matched.has(j)) continue;
    let best = -1;
    for (let i = 0; i < n; i++) {
      if (best < 0 || matrices.combined[i * m + j] > matrices.combined[best * m + j]) best = i;
    }
    if (best < 0 || matrices.combined[best * m + j] < settings.nullScore) continue;
    const targets = assignments[best];
    if (targets.length >= problem.maxTargets || !targets.some(t => related.get(j)?.has(t))) continue;
    targets.push(j);
    targets.sort((a, b) => a - b);
    matched.add(j);
  }
  return { assignments, fitness: problem.fitness(assignments) };
}

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

/** Settings plus the additional measures that the switched-on improvements contribute. */
export function analysisSettingsOf(settings: ImprovedSettings): ImprovedSettings {
  const added: MeasureWeight[] = [];
  if (isOn(settings, 'hypernyms')) added.push({ id: HYPERNYM, weight: settings.params.hypernymWeight });
  if (isOn(settings, 'roles')) added.push({ id: ROLES, weight: settings.params.roleWeight });
  if (isOn(settings, 'datatypes')) added.push({ id: DATATYPES, weight: settings.params.datatypeWeight });
  return added.length === 0 ? settings : { ...settings, measures: [...settings.measures, ...added] };
}

/**
 * Profile options of one matching problem. `documents` are the token lists of all its elements
 * (built with the compound options, so IDF counts the split words).
 */
function profileOptions(
  settings: AnalysisSettings,
  lexical: LexicalSource,
  hypernyms: HypernymSource | null,
  documents: (options: ProfileOptions) => string[][],
): ProfileOptions {
  const options: ProfileOptions = isOn(settings, 'compounds')
    ? { compounds: { isWord: word => lexical.lemma(word) !== null || (hypernyms?.isWord(word) ?? false) } }
    : {};
  if (!isOn(settings, 'idf')) return options;
  const docs = documents(options);
  return { ...options, idf: idfWeights(documentFrequencies(docs), docs.length) };
}

const uniqueFeatures = (features: FeatureNode[]) =>
  [...new Map(features.map(f => [f.qualifiedName, f])).values()];

/**
 * Matches the attributes and references of the classes in one class correspondence with
 * the same strategy; the child RNG is derived from the seed and the correspondence id.
 */
function matchFeatures(
  correspondence: Correspondence,
  input: OverlapInput,
  deps: { lexical: LexicalSource; measures: MeasureRegistry; strategy: SearchStrategy; hypernyms: HypernymSource | null },
  settings: AnalysisSettings,
): Correspondence[] {
  const collect = (graph: MetamodelGraph, refs: ElementRef[]) =>
    uniqueFeatures(refs.flatMap(ref => featuresWithInherited(graph, ref.qualifiedName)));
  const sourceFeatures = collect(input.source, correspondence.sources);
  const targetFeatures = collect(input.target, correspondence.targets);
  const options = profileOptions(settings, deps.lexical, deps.hypernyms,
    compound => [...sourceFeatures, ...targetFeatures].map(f => nameTokens(f.name, deps.lexical, compound)));
  const sources = buildFeatureProfiles(sourceFeatures, 'source', deps.lexical, settings, options);
  const targets = buildFeatureProfiles(targetFeatures, 'target', deps.lexical, settings, options);
  if (sources.length === 0 || targets.length === 0) return [];
  const matrices = computeMatrices('feature', sources, targets, deps.measures, settings, { hypernyms: deps.hypernyms });
  const problem = createMatchingProblem('feature', sources, targets, matrices, deps.measures, settings);
  const solution = deps.strategy.search(problem, settings, createRng((settings.seed ^ hashString(correspondence.id)) >>> 0));
  return solutionToCorrespondences(problem, solution, 'feature', `${correspondence.id}-f`).correspondences;
}

/**
 * Turns a solution into correspondences (grouping rule): every connected component of the
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
    for (const id of Object.keys(breakdowns[0].extras)) {
      // Measures that do not apply to a pair (NaN) are left out; with no applicable pair, omitted.
      const values = breakdowns.map(b => b.extras[id]).filter(value => !Number.isNaN(value));
      if (values.length > 0) scores[id] = clampUnit(values.reduce((sum, value) => sum + value, 0) / values.length);
    }
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

/** The class-level problem restricted to some sources (rows) and targets (columns). */
function restrictProblem(problem: MatchingProblem, rows: number[], columns: number[], measures: MeasureRegistry): MatchingProblem {
  const { m, matrices } = problem;
  const slice = (matrix: Float32Array) => {
    const result = new Float32Array(rows.length * columns.length);
    rows.forEach((i, r) => columns.forEach((j, c) => { result[r * columns.length + c] = matrix[i * m + j]; }));
    return result;
  };
  const restricted: SimilarityMatrices = {
    n: rows.length,
    m: columns.length,
    perMeasure: Object.fromEntries(Object.entries(matrices.perMeasure).map(([id, matrix]) => [id, slice(matrix)])),
    structural: slice(matrices.structural),
    syntactic: slice(matrices.syntactic),
    combined: slice(matrices.combined),
    ...(matrices.effectiveWeights ? { effectiveWeights: matrices.effectiveWeights } : {}),
    ...(matrices.flooding ? { flooding: { matrix: slice(matrices.flooding.matrix), weight: matrices.flooding.weight } } : {}),
  };
  return createMatchingProblem(problem.level, rows.map(i => problem.sources[i]), columns.map(j => problem.targets[j]),
    restricted, measures, problem.settings);
}

const keyOf = (refs: readonly ElementRef[]) => refs.map(r => r.qualifiedName).join(',');

/** A fixed (rule-based) correspondence with its rule confidence as score. */
function fixedCorrespondence(fixed: FixedCorrespondence, level: MatchLevel, scores: { structural: number; syntactic: number }): Omit<Correspondence, 'id'> {
  return {
    level,
    sources: fixed.sources,
    targets: fixed.targets,
    score: clampUnit(fixed.confidence),
    scores: { structural: clampUnit(scores.structural), syntactic: clampUnit(scores.syntactic), 'type-object': clampUnit(fixed.confidence) },
    kind: fixed.kind,
    ...(fixed.instance ? { instance: fixed.instance } : {}),
    fixed: true,
  };
}

/**
 * Adds the type-object rule's fixed class correspondences to those the search found for the free
 * classes. Ids follow the descending score; classes the rule covers but does not use stay unmatched.
 */
function mergeTypeObject(
  problem: MatchingProblem,
  free: ReturnType<typeof solutionToCorrespondences>,
  typeObject: TypeObjectMatch,
  freeSources: number[],
  freeTargets: number[],
  freeAssignments: number[][],
): { correspondences: Correspondence[]; unmatched: { source: ElementRef[]; target: ElementRef[] }; fitness: number } {
  const { m, matrices } = problem;
  const sourceIndex = new Map(problem.sources.map((p, i) => [p.ref.qualifiedName, i]));
  const targetIndex = new Map(problem.targets.map((p, j) => [p.ref.qualifiedName, j]));
  const assignments: number[][] = problem.sources.map(() => []);
  freeAssignments.forEach((targets, r) => { assignments[freeSources[r]] = targets.map(c => freeTargets[c]); });

  const fixed = typeObject.classFixed.map(c => {
    const i = sourceIndex.get(c.sources[0].qualifiedName)!;
    const j = targetIndex.get(c.targets[0].qualifiedName)!;
    if (!assignments[i].includes(j)) assignments[i].push(j);
    return fixedCorrespondence(c, 'class', { structural: matrices.structural[i * m + j], syntactic: matrices.syntactic[i * m + j] });
  });
  const all = [...free.correspondences.map(({ id: _id, ...c }) => c), ...fixed];
  all.sort((a, b) => b.score - a.score || keyOf(a.sources).localeCompare(keyOf(b.sources)) || keyOf(a.targets).localeCompare(keyOf(b.targets)));
  const correspondences = all.map((c, k) => ({ id: `c-${k + 1}`, ...c }));

  const used = new Set([
    ...typeObject.classFixed.flatMap(c => [...c.sources, ...c.targets]),
    ...[...typeObject.featureFixed.values()].flat().flatMap(c => [...c.sources, ...c.targets]),
  ].map(ref => ref.qualifiedName));
  const unusedCovered = (side: 'source' | 'target') => problem[side === 'source' ? 'sources' : 'targets']
    .filter(p => typeObject.covered[side].has(p.ref.qualifiedName) && !used.has(p.ref.qualifiedName))
    .map(p => p.ref);
  return {
    correspondences,
    unmatched: {
      source: [...free.unmatched.source, ...unusedCovered('source')],
      target: [...free.unmatched.target, ...unusedCovered('target')],
    },
    fitness: problem.fitness(assignments),
  };
}

/** Attribute ↔ definition / value instance correspondences of a fixed `subclass ↔ type` correspondence. */
function fixedFeatureCorrespondences(correspondence: Correspondence, typeObject: TypeObjectMatch): Correspondence[] {
  const subclass = typeObject.pattern.side === 'target' ? correspondence.sources[0] : correspondence.targets[0];
  return (typeObject.featureFixed.get(subclass.qualifiedName) ?? [])
    .map((c, k) => ({ id: `${correspondence.id}-f-${k + 1}`, ...fixedCorrespondence(c, 'feature', { structural: 0, syntactic: 0 }) }));
}

/** Class-level correspondences per kind. */
const kindCounts = (correspondences: readonly Correspondence[]) => ({
  same: correspondences.filter(c => (c.kind ?? 'same') === 'same').length,
  instance: correspondences.filter(c => c.kind === 'instance').length,
});

/**
 * Runs the improved semantic overlap analysis: the paper approach (Kessentini et al. 2014) plus the
 * improvements switched on in the settings. Pure: no DOM, network or global state. The same input
 * (incl. seed) and dependencies give the same result apart from `id`, `createdAt` and `durationMs`.
 */
export function runImprovedAnalysis(input: ImprovedInput, deps: AnalysisDeps): OverlapResult {
  const { source, target } = input;
  const problems = validateImprovedSettings(input.settings);
  if (problems.length > 0) throw new InvalidSettingsError(problems);
  // The result keeps the user's settings; the analysis also uses the improvements' measures.
  const settings = analysisSettingsOf(input.settings);
  const hypernyms = deps.hypernyms ?? null;
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
  if (isOn(settings, 'hypernyms') && !hypernyms) {
    warnings.push('WordNet hypernyms could not be loaded; hypernym similarity was skipped.');
  }
  for (const graph of [source, target]) {
    for (const supertype of graph.unresolvedSupertypes) {
      warnings.push(`${graph.ref.name}: supertype ${supertype} is defined in another file and was ignored.`);
    }
  }

  report({ phase: 'profiling', fraction: 0.02 });
  const classOptions = profileOptions(settings, deps.lexical, hypernyms,
    compound => [...source.classes, ...target.classes].map(node => classDocument(node, deps.lexical, compound)));
  const sourceProfiles = buildClassProfiles(source, 'source', deps.lexical, settings, classOptions);
  const targetProfiles = buildClassProfiles(target, 'target', deps.lexical, settings, classOptions);
  const matrices = computeMatrices('class', sourceProfiles, targetProfiles, measures, settings, { hypernyms });
  if (isOn(settings, 'flooding')) {
    const { flood } = similarityFlooding(buildClassGraph(source), buildClassGraph(target), matrices.combined,
      matrices.n, matrices.m, settings.params.floodingMaxIterations);
    if (flood) {
      const weight = settings.params.floodingWeight;
      matrices.perMeasure.flooding = flood;
      matrices.flooding = { matrix: flood, weight };
      matrices.combined = blend(matrices.combined, flood, weight);
    } else if (matrices.n > 0 && matrices.m > 0) {
      warnings.push('Similarity flooding was skipped because the metamodels are too large.');
    }
  }
  report({ phase: 'profiling', fraction: PROFILING_END });

  const problem = createMatchingProblem('class', sourceProfiles, targetProfiles, matrices, measures, settings);
  let correspondences: Correspondence[] = [];
  let unmatched = { source: sourceProfiles.map(p => p.ref), target: targetProfiles.map(p => p.ref) };
  let fitness = 0;
  let typeObjectPatterns: TypeObjectPattern[] | undefined;
  if (problem.n === 0 || problem.m === 0) {
    warnings.push('One of the metamodels has no classes, so no overlap can be computed.');
  } else {
    const typeObject = isOn(settings, 'type-object')
      ? detectTypeObject(source, target, settings.params.typeObjectMinSubclasses)
      : null;
    // Classes explained by the type-object rule are fixed; the search only sees the others.
    const freeSources = sourceProfiles.flatMap((p, i) => (typeObject?.covered.source.has(p.ref.qualifiedName) ? [] : [i]));
    const freeTargets = targetProfiles.flatMap((p, j) => (typeObject?.covered.target.has(p.ref.qualifiedName) ? [] : [j]));
    const free = typeObject ? restrictProblem(problem, freeSources, freeTargets, measures) : problem;
    const searchProgress = (p: { phase: 'ga' | 'sa'; fraction: number }) =>
      report({ phase: p.phase, fraction: PROFILING_END + p.fraction * (CLASS_SEARCH_END - PROFILING_END) });
    let freeResult: ReturnType<typeof solutionToCorrespondences> = {
      correspondences: [], unmatched: { source: free.sources.map(p => p.ref), target: free.targets.map(p => p.ref) },
    };
    let freeAssignments: number[][] = free.sources.map(() => []);
    if (free.n > 0 && free.m > 0) {
      const solution = strategy.search(free, settings, createRng(settings.seed), searchProgress);
      const completed = isOn(settings, 'hierarchy-both')
        ? completeHierarchyBothSides(free, solution, source, target)
        : completeHierarchy(free, solution, target);
      freeAssignments = completed.assignments;
      freeResult = solutionToCorrespondences(free, completed, 'class');
    }
    if (typeObject) {
      const merged = mergeTypeObject(problem, freeResult, typeObject, freeSources, freeTargets, freeAssignments);
      ({ correspondences, unmatched, fitness } = merged);
      typeObjectPatterns = [typeObject.pattern];
    } else {
      ({ correspondences, unmatched } = freeResult);
      fitness = problem.fitness(freeAssignments);
    }
    correspondences = correspondences.map((correspondence, k) => {
      report({ phase: 'features', fraction: CLASS_SEARCH_END + (k / correspondences.length) * (1 - CLASS_SEARCH_END) });
      const fixedChildren = correspondence.fixed && correspondence.kind === 'instance' && typeObject
        ? fixedFeatureCorrespondences(correspondence, typeObject)
        : null;
      return {
        ...correspondence,
        children: fixedChildren ?? matchFeatures(correspondence, input, { lexical: deps.lexical, measures, strategy, hypernyms }, settings),
      };
    });
  }
  report({ phase: 'features', fraction: 1 });

  const matchedSource = sourceProfiles.length - unmatched.source.length;
  const matchedTarget = targetProfiles.length - unmatched.target.length;
  const totalClasses = sourceProfiles.length + targetProfiles.length;
  const perMeasure: Record<string, number[]> = {};
  // Pairs a measure does not apply to (NaN internally) are exported as 0.
  for (const [id, matrix] of Object.entries(matrices.perMeasure)) {
    perMeasure[id] = Array.from(matrix, value => (Number.isNaN(value) ? 0 : round3(value)));
  }

  return {
    schemaVersion: 1,
    id: deps.createId?.() ?? globalThis.crypto.randomUUID(),
    createdAt: new Date(startedAt).toISOString(),
    durationMs: Math.max(0, now() - startedAt),
    source: source.ref,
    target: target.ref,
    settings: input.settings,
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
      ...(isOn(settings, 'type-object') ? { kindCounts: kindCounts(correspondences) } : {}),
    },
    classMatrix: {
      rows: sourceProfiles.map(p => p.ref.qualifiedName),
      columns: targetProfiles.map(p => p.ref.qualifiedName),
      overall: Array.from(matrices.combined, value => round3(clampUnit(value))),
      perMeasure,
    },
    correspondences,
    unmatched,
    ...(typeObjectPatterns ? { typeObjectPatterns } : {}),
  };
}
