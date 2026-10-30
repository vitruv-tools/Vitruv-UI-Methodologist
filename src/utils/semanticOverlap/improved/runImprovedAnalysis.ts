/*
 * Independent copy of the paper approach's `runOverlapAnalysis.ts`; evolves separately — do not
 * import from the paper pipeline for logic.
 */
import type { LexicalSource } from '../lexical/wordNetSource';
import { buildClassProfiles, buildFeatureProfiles, classDocument, nameTokens, type ProfileOptions } from './measures/profiles';
import { documentFrequencies, idfWeights } from './lexical/idf';
import { completeHierarchyBothSides } from './hierarchy/completeHierarchyBothSides';
import { featuresWithInherited } from './hierarchy/features';
import { blend, buildClassGraph, similarityFlooding } from './flooding/similarityFlooding';
import { detectTypeObject, type FixedCorrespondence, type TypeObjectMatch } from './typeObject/detectTypeObject';
import { detectConditional, type ConditionalCorrespondence } from './conditional/detectConditional';
import { labelGroups } from './grouping/splitMerge';
import { pathCandidates, pickPaths } from './features/paths';
import { describePath } from './embeddings/describe';
import type { SimilarityMatrices } from './measures/similarityMatrices';
import { createDefaultMeasureRegistry } from './measures/registry';
import { computeMatrices, extraMeasures } from './measures/similarityMatrices';
import { DATATYPES, EMBEDDING, HYPERNYM, ROLES, STRUCTURE_TYPES, type MeasureRegistry } from './measures/types';
import { structureTypesLookup, structureTypesMatrix, type StructureTypesLookup } from './measures/structureTypes';
import { coverage, repairClassCorrespondences, repairFeatureCorrespondences } from './repair/consistencyRepair';
import { featureBaseline, pairBaseline, withClassEmbeddings, withFeatureEmbeddings } from './embeddings/embeddingContext';
import { BUILT_IN_MEASURES } from './measures/types';
import { createMatchingProblem, type MatchingProblem, type Solution } from './matchingProblem';
import { searchAlternatives } from './search/nsga2';
import { createDefaultStrategyRegistry, type StrategyRegistry } from '../search/registry';
import { createRng, hashString } from '../search/rng';
import { isOn, validateImprovedSettings, type ImprovedSettings } from './settings';
import type { HypernymSource } from './lexical/hypernymSource';
import type { EmbeddingTable } from './embeddings/types';
import type { SearchStrategy } from '../search/strategy';
import type {
  Alternative, AnalysisSettings, Correspondence, CorrespondenceKind, ElementRef, FeatureNode, MatchLevel, MeasureWeight, MetamodelGraph,
  OverlapInput, OverlapResult, Progress, RepairRecord, TypeObjectPattern,
} from '../types';

/** Version of the improved approach; results and the calibrated threshold's note name it. */
export const IMPROVED_VERSION = '0.3';

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
  /** Sentence-embedding vectors of the element descriptions; null or absent when unavailable. */
  embeddings?: EmbeddingTable | null;
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

export { featuresWithInherited } from './hierarchy/features';

/**
 * Settings plus the additional measures that the switched-on improvements contribute. The embedding
 * measure only counts when an embedding table is available.
 */
export function analysisSettingsOf(settings: ImprovedSettings, available: { embeddings?: boolean } = {}): ImprovedSettings {
  const added: MeasureWeight[] = [];
  if (isOn(settings, 'hypernyms')) added.push({ id: HYPERNYM, weight: settings.params.hypernymWeight });
  if (isOn(settings, 'roles')) added.push({ id: ROLES, weight: settings.params.roleWeight });
  if (isOn(settings, 'datatypes')) added.push({ id: DATATYPES, weight: settings.params.datatypeWeight });
  if (isOn(settings, 'embeddings') && available.embeddings) added.push({ id: EMBEDDING, weight: settings.params.embeddingWeight });
  if (isOn(settings, 'structure-types')) added.push({ id: STRUCTURE_TYPES, weight: settings.params.structureTypesWeight });
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
  deps: {
    lexical: LexicalSource; measures: MeasureRegistry; strategy: SearchStrategy; hypernyms: HypernymSource | null;
    embeddings: { table: EmbeddingTable; baseline: number } | null;
  },
  settings: AnalysisSettings,
): Correspondence[] {
  const collect = (graph: MetamodelGraph, refs: ElementRef[]) =>
    uniqueFeatures(refs.flatMap(ref => featuresWithInherited(graph, ref.qualifiedName)));
  const sourceFeatures = collect(input.source, correspondence.sources);
  const targetFeatures = collect(input.target, correspondence.targets);
  const options = profileOptions(settings, deps.lexical, deps.hypernyms,
    compound => [...sourceFeatures, ...targetFeatures].map(f => nameTokens(f.name, deps.lexical, compound)));
  const table = deps.embeddings?.table ?? null;
  const sources = withFeatureEmbeddings(buildFeatureProfiles(sourceFeatures, 'source', deps.lexical, settings, options), sourceFeatures, table);
  const targets = withFeatureEmbeddings(buildFeatureProfiles(targetFeatures, 'target', deps.lexical, settings, options), targetFeatures, table);
  if (sources.length === 0 || targets.length === 0) return [];
  const matrices = computeMatrices('feature', sources, targets, deps.measures, settings,
    { hypernyms: deps.hypernyms, embeddingBaseline: deps.embeddings?.baseline });
  const problem = createMatchingProblem('feature', sources, targets, matrices, deps.measures, settings);
  const solution = deps.strategy.search(problem, settings, createRng((settings.seed ^ hashString(correspondence.id)) >>> 0));
  const found = solutionToCorrespondences(problem, solution, 'feature', `${correspondence.id}-f`);
  if (!isOn(settings, 'paths')) return found.correspondences;
  // Path correspondences, only for features the search left unmatched (both directions).
  const profilePaths = (graph: MetamodelGraph, refs: ElementRef[], side: 'source' | 'target') => {
    const candidates = pathCandidates(graph, refs, side);
    const profiles = buildFeatureProfiles(candidates.map(c => c.feature), side, deps.lexical, settings, options)
      .map((profile, k) => ({ ...profile, ref: candidates[k].ref, embedding: table?.vectors.get(describePath(candidates[k].first, candidates[k].second)) }));
    return { candidates, profiles };
  };
  const unmatchedOf = (all: typeof sources, refs: ElementRef[]) => all.filter(p => refs.some(r => r.qualifiedName === p.ref.qualifiedName));
  const pathProblem = (from: typeof sources, to: typeof targets) => createMatchingProblem('feature', from, to,
    computeMatrices('feature', from, to, deps.measures, settings, { hypernyms: deps.hypernyms, embeddingBaseline: deps.embeddings?.baseline }),
    deps.measures, settings);
  const paths: Omit<Correspondence, 'id'>[] = [];
  const addPicks = (pathsProblem: MatchingProblem) => {
    for (const pick of pickPaths(pathsProblem, settings.nullScore)) {
      const breakdown = pathsProblem.scoreOf(pick.source, [pick.target]);
      const extras = Object.fromEntries(Object.entries(breakdown.extras).filter(([, value]) => !Number.isNaN(value)).map(([id, value]) => [id, clampUnit(value)]));
      paths.push({
        level: 'feature', kind: 'path',
        sources: [pathsProblem.sources[pick.source].ref], targets: [pathsProblem.targets[pick.target].ref],
        score: clampUnit(breakdown.combined),
        scores: { structural: clampUnit(breakdown.structural), syntactic: clampUnit(breakdown.syntactic), ...extras },
      });
    }
  };
  const unmatchedSources = unmatchedOf(sources, found.unmatched.source);
  const unmatchedTargets = unmatchedOf(targets, found.unmatched.target);
  const targetPaths = profilePaths(input.target, correspondence.targets, 'target');
  if (unmatchedSources.length > 0 && targetPaths.profiles.length > 0) addPicks(pathProblem(unmatchedSources, targetPaths.profiles));
  const sourcePaths = profilePaths(input.source, correspondence.sources, 'source');
  if (unmatchedTargets.length > 0 && sourcePaths.profiles.length > 0) addPicks(pathProblem(sourcePaths.profiles, unmatchedTargets));
  return [...found.correspondences, ...paths.map((c, k) => ({ id: `${correspondence.id}-f-${found.correspondences.length + k + 1}`, ...c }))];
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

/** A fixed (rule-based) correspondence with its rule confidence as score (under the rule's name). */
function fixedCorrespondence(
  fixed: FixedCorrespondence & Partial<Pick<ConditionalCorrespondence, 'condition'>>,
  level: MatchLevel,
  scores: { structural: number; syntactic: number },
): Omit<Correspondence, 'id'> {
  const rule = fixed.kind === 'conditional' ? 'conditional' : 'type-object';
  return {
    level,
    sources: fixed.sources,
    targets: fixed.targets,
    score: clampUnit(fixed.confidence),
    scores: { structural: clampUnit(scores.structural), syntactic: clampUnit(scores.syntactic), [rule]: clampUnit(fixed.confidence) },
    kind: fixed.kind,
    ...(fixed.instance ? { instance: fixed.instance } : {}),
    ...(fixed.condition ? { condition: fixed.condition } : {}),
    fixed: true,
  };
}

/** Fixed correspondences of the rules (type-object, conditional) and the classes they explain. */
interface RuleMatches {
  classFixed: FixedCorrespondence[];
  featureFixed: FixedCorrespondence[];
  covered: { source: Set<string>; target: Set<string> };
}

function ruleMatches(typeObject: TypeObjectMatch | null, conditional: ReturnType<typeof detectConditional>): RuleMatches | null {
  if (!typeObject && !conditional) return null;
  return {
    classFixed: [...(typeObject?.classFixed ?? []), ...(conditional?.classFixed ?? [])],
    featureFixed: [...(typeObject?.featureFixed.values() ?? [])].flat(),
    covered: {
      source: new Set([...(typeObject?.covered.source ?? []), ...(conditional?.covered.source ?? [])]),
      target: new Set([...(typeObject?.covered.target ?? []), ...(conditional?.covered.target ?? [])]),
    },
  };
}

/**
 * Adds the rules' fixed class correspondences to those the search found for the free classes. Ids
 * follow the descending score; classes a rule covers but does not use stay unmatched.
 */
function mergeFixed(
  problem: MatchingProblem,
  free: ReturnType<typeof solutionToCorrespondences>,
  rules: RuleMatches,
  freeSources: number[],
  freeTargets: number[],
  freeAssignments: number[][],
): { correspondences: Correspondence[]; unmatched: { source: ElementRef[]; target: ElementRef[] }; fitness: number } {
  const { m, matrices } = problem;
  const sourceIndex = new Map(problem.sources.map((p, i) => [p.ref.qualifiedName, i]));
  const targetIndex = new Map(problem.targets.map((p, j) => [p.ref.qualifiedName, j]));
  const assignments: number[][] = problem.sources.map(() => []);
  freeAssignments.forEach((targets, r) => { assignments[freeSources[r]] = targets.map(c => freeTargets[c]); });

  const fixed = rules.classFixed.map(c => {
    const i = sourceIndex.get(c.sources[0].qualifiedName)!;
    const j = targetIndex.get(c.targets[0].qualifiedName)!;
    if (!assignments[i].includes(j)) assignments[i].push(j);
    return fixedCorrespondence(c, 'class', { structural: matrices.structural[i * m + j], syntactic: matrices.syntactic[i * m + j] });
  });
  const all = [...free.correspondences.map(({ id: _id, ...c }) => c), ...fixed];
  all.sort((a, b) => b.score - a.score || keyOf(a.sources).localeCompare(keyOf(b.sources)) || keyOf(a.targets).localeCompare(keyOf(b.targets)));
  const correspondences = all.map((c, k) => ({ id: `c-${k + 1}`, ...c }));

  const used = new Set([...rules.classFixed, ...rules.featureFixed].flatMap(c => [...c.sources, ...c.targets]).map(ref => ref.qualifiedName));
  const unusedCovered = (side: 'source' | 'target') => problem[side === 'source' ? 'sources' : 'targets']
    .filter(p => rules.covered[side].has(p.ref.qualifiedName) && !used.has(p.ref.qualifiedName))
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

/** Matched classes per side and the overlap percentage, from the unmatched classes. */
function overlapSummary(sourceCount: number, targetCount: number, unmatched: { source: readonly ElementRef[]; target: readonly ElementRef[] }) {
  const matchedSourceClasses = sourceCount - unmatched.source.length;
  const matchedTargetClasses = targetCount - unmatched.target.length;
  const total = sourceCount + targetCount;
  return {
    matchedSourceClasses,
    matchedTargetClasses,
    overlapPercent: total === 0 ? 0 : round3(((matchedSourceClasses + matchedTargetClasses) / total) * 100),
  };
}

/**
 * Correspondences per kind: class-level kinds, plus feature-level path correspondences under `path`.
 * Kinds that do not occur are left out, except `same` and `instance` (always counted, as in 0.2).
 */
function kindCounts(correspondences: readonly Correspondence[]): Partial<Record<CorrespondenceKind, number>> {
  const counts: Partial<Record<CorrespondenceKind, number>> = { same: 0, instance: 0 };
  const add = (kind: CorrespondenceKind) => { counts[kind] = (counts[kind] ?? 0) + 1; };
  for (const c of correspondences) {
    add(c.kind ?? 'same');
    (c.children ?? []).filter(child => child.kind === 'path').forEach(() => add('path'));
  }
  return counts;
}

/** Improvements whose results may contain kinds other than same-concept. */
const KIND_IMPROVEMENTS = ['type-object', 'paths', 'split-merge', 'conditional'] as const;

/**
 * Class profiles and the class-level similarity matrices of an analysis (no search): profiles with
 * embeddings, the measures, the data-structure second pass and flooding. Shared with calibration.
 */
export function classMatrices(
  input: OverlapInput,
  settings: ImprovedSettings,
  deps: { lexical: LexicalSource; hypernyms: HypernymSource | null; measures: MeasureRegistry; embeddings: EmbeddingTable | null },
  warnings: string[] = [],
) {
  const { source, target } = input;
  const { hypernyms, measures } = deps;
  const embeddingTable = deps.embeddings;
  const classOptions = profileOptions(settings, deps.lexical, hypernyms,
    compound => [...source.classes, ...target.classes].map(node => classDocument(node, deps.lexical, compound)));
  const sourceProfiles = withClassEmbeddings(buildClassProfiles(source, 'source', deps.lexical, settings, classOptions), source, embeddingTable);
  const targetProfiles = withClassEmbeddings(buildClassProfiles(target, 'target', deps.lexical, settings, classOptions), target, embeddingTable);
  // Embedding similarities are rescaled against the median cosine of each level, computed once per run.
  const embeddingBaseline = embeddingTable
    ? {
      class: pairBaseline(sourceProfiles.map(p => p.embedding), targetProfiles.map(p => p.embedding)),
      feature: featureBaseline(source, target, embeddingTable),
    }
    : null;
  const featureEmbeddings = embeddingTable && embeddingBaseline ? { table: embeddingTable, baseline: embeddingBaseline.feature } : null;
  const classContext = { hypernyms, embeddingBaseline: embeddingBaseline?.class };
  let structureTypes: StructureTypesLookup | undefined;
  if (isOn(settings, 'structure-types')) {
    // Second pass: the data-structure measure needs the first-pass similarity of the classes that
    // features are typed by; the matrices are then combined with it (and adaptive weights).
    const firstPassSettings = { ...settings, measures: settings.measures.filter(m => m.id !== STRUCTURE_TYPES) };
    const firstPass = computeMatrices('class', sourceProfiles, targetProfiles, measures, firstPassSettings, classContext);
    const structure = structureTypesMatrix(source, target, firstPass.combined, settings.params.structureTypesMaxSignatures);
    structureTypes = structureTypesLookup(source, target, structure);
  }
  const matrices = computeMatrices('class', sourceProfiles, targetProfiles, measures, settings, { ...classContext, structureTypes });
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
  return { sourceProfiles, targetProfiles, matrices, embeddingBaseline, featureEmbeddings };
}

/**
 * Runs the improved semantic overlap analysis: the paper approach (Kessentini et al. 2014) plus the
 * improvements switched on in the settings. Pure: no DOM, network or global state. The same input
 * (incl. seed) and dependencies give the same result apart from `id`, `createdAt` and `durationMs`.
 */
export function runImprovedAnalysis(input: ImprovedInput, deps: AnalysisDeps): OverlapResult {
  const { source, target } = input;
  const problems = validateImprovedSettings(input.settings);
  if (problems.length > 0) throw new InvalidSettingsError(problems);
  const embeddingTable = isOn(input.settings, 'embeddings') ? deps.embeddings ?? null : null;
  // The result keeps the user's settings; the analysis also uses the improvements' measures.
  const withMeasures = analysisSettingsOf(input.settings, { embeddings: embeddingTable !== null });
  // The calibrated acceptance threshold replaces the null score on both levels (and in hierarchy
  // completion). The fitness already averages over all source elements with the null score for
  // unmatched ones, which normalises scores by the number of elements as Fang's division by the
  // match count does; no further normalisation is needed.
  const calibrated = isOn(withMeasures, 'calibrated-null');
  const settings = calibrated ? { ...withMeasures, nullScore: withMeasures.params.calibratedNullScore } : withMeasures;
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
  if (isOn(settings, 'embeddings') && !embeddingTable) {
    warnings.push('No sentence embeddings were available, so the embedding measure was skipped.');
  }
  for (const graph of [source, target]) {
    for (const supertype of graph.unresolvedSupertypes) {
      warnings.push(`${graph.ref.name}: supertype ${supertype} is defined in another file and was ignored.`);
    }
  }

  report({ phase: 'profiling', fraction: 0.02 });
  const { sourceProfiles, targetProfiles, matrices, embeddingBaseline, featureEmbeddings } = classMatrices(
    input, settings, { lexical: deps.lexical, hypernyms, measures, embeddings: embeddingTable }, warnings);
  report({ phase: 'profiling', fraction: PROFILING_END });

  const problem = createMatchingProblem('class', sourceProfiles, targetProfiles, matrices, measures, settings);
  let correspondences: Correspondence[] = [];
  let unmatched = { source: sourceProfiles.map(p => p.ref), target: targetProfiles.map(p => p.ref) };
  let fitness = 0;
  let typeObjectPatterns: TypeObjectPattern[] | undefined;
  let alternatives: Alternative[] | undefined;
  const repairs: RepairRecord[] = [];
  if (problem.n === 0 || problem.m === 0) {
    warnings.push('One of the metamodels has no classes, so no overlap can be computed.');
  } else {
    const typeObject = isOn(settings, 'type-object')
      ? detectTypeObject(source, target, settings.params.typeObjectMinSubclasses)
      : null;
    const conditional = isOn(settings, 'conditional')
      ? detectConditional(source, target, word => deps.lexical.lemma(word) !== null)
      : null;
    const rules = ruleMatches(typeObject, conditional);
    // Classes explained by a rule (type-object, conditional) are fixed; the search only sees the others.
    const freeSources = sourceProfiles.flatMap((p, i) => (rules?.covered.source.has(p.ref.qualifiedName) ? [] : [i]));
    const freeTargets = targetProfiles.flatMap((p, j) => (rules?.covered.target.has(p.ref.qualifiedName) ? [] : [j]));
    const free = rules ? restrictProblem(problem, freeSources, freeTargets, measures) : problem;
    const searchProgress = (p: { phase: 'ga' | 'sa'; fraction: number }) =>
      report({ phase: p.phase, fraction: PROFILING_END + p.fraction * (CLASS_SEARCH_END - PROFILING_END) });
    if (typeObject) typeObjectPatterns = [typeObject.pattern];
    /**
     * Steps after the class-level search, for one solution of the free classes: hierarchy
     * completion, split/merge labelling, the rules' fixed correspondences, class repair, feature
     * matching (with paths) and feature repair.
     */
    const finish = (solution: Solution | null, featureProgress: (fraction: number) => void) => {
      let freeResult: ReturnType<typeof solutionToCorrespondences> = {
        correspondences: [], unmatched: { source: free.sources.map(p => p.ref), target: free.targets.map(p => p.ref) },
      };
      let freeAssignments: number[][] = free.sources.map(() => []);
      if (solution) {
        const completed = isOn(settings, 'hierarchy-both')
          ? completeHierarchyBothSides(free, solution, source, target)
          : completeHierarchy(free, solution, target);
        freeAssignments = completed.assignments;
        freeResult = solutionToCorrespondences(free, completed, 'class');
        if (isOn(settings, 'split-merge')) {
          freeResult = { ...freeResult, correspondences: labelGroups(freeResult.correspondences, source, target, warnings) };
        }
      }
      let found: Correspondence[];
      let notFound: { source: ElementRef[]; target: ElementRef[] };
      let value: number;
      if (rules) {
        ({ correspondences: found, unmatched: notFound, fitness: value } = mergeFixed(problem, freeResult, rules, freeSources, freeTargets, freeAssignments));
      } else {
        ({ correspondences: found, unmatched: notFound } = freeResult);
        value = problem.fitness(freeAssignments);
      }
      const removed: RepairRecord[] = [];
      if (isOn(settings, 'consistency')) {
        const repaired = repairClassCorrespondences(found, source, target);
        found = repaired.correspondences;
        removed.push(...repaired.repairs);
        const used = new Set(found.flatMap(c => [...c.sources, ...c.targets]).map(ref => ref.qualifiedName));
        notFound = {
          source: sourceProfiles.filter(p => !used.has(p.ref.qualifiedName)).map(p => p.ref),
          target: targetProfiles.filter(p => !used.has(p.ref.qualifiedName)).map(p => p.ref),
        };
      }
      found = found.map((correspondence, k) => {
        featureProgress(k / found.length);
        const fixedChildren = correspondence.fixed && correspondence.kind === 'instance' && typeObject
          ? fixedFeatureCorrespondences(correspondence, typeObject)
          : null;
        return {
          ...correspondence,
          children: fixedChildren ?? matchFeatures(correspondence, input,
            { lexical: deps.lexical, measures, strategy, hypernyms, embeddings: featureEmbeddings }, settings),
        };
      });
      if (isOn(settings, 'consistency')) {
        const repaired = repairFeatureCorrespondences(found, source, target);
        found = repaired.correspondences;
        removed.push(...repaired.repairs);
      }
      return { correspondences: found, unmatched: notFound, fitness: value, repairs: removed };
    };
    const featureFraction = (start: number, share: number) => (fraction: number) =>
      report({ phase: 'features', fraction: CLASS_SEARCH_END + (start + fraction * share) * (1 - CLASS_SEARCH_END) });
    const searchable = free.n > 0 && free.m > 0;
    let outcome: ReturnType<typeof finish>;
    if (isOn(settings, 'alternatives') && searchable) {
      // Alternatives: the lexical and structural objectives are searched separately (NSGA-II);
      // every alternative is finished on its own, the balanced one fills the main fields.
      const labelled = searchAlternatives(free, settings, createRng(settings.seed), searchProgress);
      const finished = labelled.map((alternative, k) => ({
        alternative,
        outcome: finish({ assignments: alternative.assignments, fitness: free.fitness(alternative.assignments) },
          featureFraction(k / labelled.length, 1 / labelled.length)),
      }));
      outcome = finished.find(f => f.alternative.labels.includes('balanced'))!.outcome;
      alternatives = finished.map(({ alternative, outcome: alt }) => ({
        label: alternative.labels.join(', '),
        isDefault: alternative.labels.includes('balanced'),
        objectives: { lexical: round3(alternative.objectives.lexical), structural: round3(alternative.objectives.structural) },
        correspondences: alt.correspondences,
        unmatched: alt.unmatched,
        summary: overlapSummary(sourceProfiles.length, targetProfiles.length, alt.unmatched),
      }));
    } else {
      const solution = searchable ? strategy.search(free, settings, createRng(settings.seed), searchProgress) : null;
      outcome = finish(solution, featureFraction(0, 1));
    }
    ({ correspondences, unmatched, fitness } = outcome);
    repairs.push(...outcome.repairs);
  }
  report({ phase: 'features', fraction: 1 });

  const { matchedSourceClasses, matchedTargetClasses, overlapPercent } = overlapSummary(sourceProfiles.length, targetProfiles.length, unmatched);
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
    // Split/merge labelling runs once per alternative and may repeat a warning.
    warnings: [...new Set(warnings)],
    summary: {
      sourceClassCount: sourceProfiles.length,
      targetClassCount: targetProfiles.length,
      matchedSourceClasses,
      matchedTargetClasses,
      overlapPercent,
      fitness: round3(fitness),
      ...(KIND_IMPROVEMENTS.some(id => isOn(settings, id)) ? { kindCounts: kindCounts(correspondences) } : {}),
      ...(isOn(settings, 'consistency') ? { coverage: coverage(correspondences, source, target) } : {}),
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
    ...(embeddingTable && embeddingBaseline ? { embeddingBaseline, embeddingModel: { ...embeddingTable.model } } : {}),
    ...(isOn(settings, 'consistency') ? { repairs } : {}),
    ...(alternatives ? { alternatives } : {}),
    ...(calibrated ? {
      acceptanceThreshold: {
        value: settings.nullScore,
        source: 'calibrated' as const,
        note: `calibrated on the benchmark suite (improved ${IMPROVED_VERSION})`,
      },
    } : {}),
  };
}
