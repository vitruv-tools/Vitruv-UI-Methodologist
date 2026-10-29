import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { approachOf } from '../../../../utils/semanticOverlap/approaches/registry';
import type { ApproachDeps, ApproachId } from '../../../../utils/semanticOverlap/approaches/types';
import { readMetamodelGraph } from '../../../../utils/semanticOverlap/ecore/readMetamodelGraph';
import { createHypernymSource, type HypernymTable } from '../../../../utils/semanticOverlap/improved/lexical/hypernymSource';
import { createWordNetSource } from '../../../../utils/semanticOverlap/lexical/wordNetSource';
import type {
  AnalysisSettings, Correspondence, CorrespondenceKind, InstanceRole, MetamodelGraph, OverlapResult, Side,
} from '../../../../utils/semanticOverlap/types';
import table from '../../../../assets/wordnet/oewn-2025-synonyms.json';
import hypernymTable from '../../../../assets/wordnet/oewn-2025-hypernyms.json';

/**
 * Benchmark suite of the semantic overlap analysis: scenarios, reference sets and the
 * kind-aware evaluation shared by the benchmark, regression and ablation tests.
 */
export const FIXTURES_DIR = path.resolve(__dirname, '../../../fixtures/semanticOverlap');
export const BENCHMARK_DIR = path.join(FIXTURES_DIR, 'benchmark');
export const METAMODEL_DIR = path.join(BENCHMARK_DIR, 'metamodels');
/** Local-only Brake Specification Model (never committed). */
export const BRAKE_FILE = path.join(BENCHMARK_DIR, 'brake-bom/brakesystem.ecore');
export const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export interface ReferenceEntry {
  sources: string[];
  targets: string[];
  /** Absent means `'same'`. */
  kind?: CorrespondenceKind;
  /** Side whose class is instantiated (`kind = 'instance'`). */
  instanceSide?: Side;
  role?: InstanceRole;
  uncertain?: boolean;
  note?: string;
}

export interface Reference {
  correspondences: ReferenceEntry[];
  features?: ReferenceEntry[];
}

export interface Scores { precision: number; recall: number; fMeasure: number }
export interface LevelScores { class: Scores; feature?: Scores }

export type ScenarioId = 'fig1' | 'ecore-uml20' | 'brake-bom' | 'bom-brake';
export type ScenarioOrigin = 'committed' | 'downloaded' | 'local';

export interface Scenario {
  id: ScenarioId;
  label: string;
  source: string;
  target: string;
  referenceFile: string;
  origin: ScenarioOrigin;
  available: boolean;
  /** The scenario is the reverse of this one (sides and reference swapped). */
  reverseOf?: ScenarioId;
}

export interface LoadedScenario {
  scenario: Scenario;
  source: MetamodelGraph;
  target: MetamodelGraph;
  reference: Reference;
}

const file = (...parts: string[]) => path.join(FIXTURES_DIR, ...parts);

/** The four scenarios; availability depends on the downloaded and local-only files. */
export function scenarios(): Scenario[] {
  const brake = file('benchmark/brake-bom/brakesystem.ecore');
  const bom = file('benchmark/brake-bom/bom.ecore');
  const ecore = path.join(METAMODEL_DIR, 'Ecore.ecore');
  const uml = path.join(METAMODEL_DIR, 'UML_2.0_CD.ecore');
  const brakeReference = file('benchmark/brake-bom/brake-bom.expected.json');
  return [
    { id: 'fig1', label: 'Fig. 1 excerpt', source: file('ecore-excerpt.ecore'), target: file('uml-excerpt.ecore'),
      referenceFile: file('fig1-expected.json'), origin: 'committed', available: true },
    { id: 'ecore-uml20', label: 'Ecore -> UML 2.0', source: ecore, target: uml,
      referenceFile: file('benchmark/ecore-uml20.expected.json'), origin: 'downloaded', available: existsSync(ecore) && existsSync(uml) },
    { id: 'brake-bom', label: 'Brake -> BOM', source: brake, target: bom,
      referenceFile: brakeReference, origin: 'local', available: existsSync(brake) },
    { id: 'bom-brake', label: 'BOM -> Brake', source: bom, target: brake,
      referenceFile: brakeReference, origin: 'local', available: existsSync(brake), reverseOf: 'brake-bom' },
  ];
}

/** Reads a reference file (v1 or v2). In v1 files `uncertain` is a list of notes and ignored. */
export function readReference(json: string): Reference {
  const data = JSON.parse(json) as { correspondences: ReferenceEntry[]; features?: ReferenceEntry[] };
  const entry = (e: ReferenceEntry): ReferenceEntry => ({ ...e, uncertain: e.uncertain === true ? true : undefined });
  return {
    correspondences: data.correspondences.map(entry),
    features: data.features?.map(entry),
  };
}

const swap = (e: ReferenceEntry): ReferenceEntry => ({
  ...e,
  sources: e.targets,
  targets: e.sources,
  instanceSide: e.instanceSide === undefined ? undefined : e.instanceSide === 'source' ? 'target' : 'source',
});

/** The reference of the reverse scenario: sides swapped, `instanceSide` flipped. */
export function reverseScenario(reference: Reference): Reference {
  return { correspondences: reference.correspondences.map(swap), features: reference.features?.map(swap) };
}

/**
 * Splits mixed references (Fig. 1): entries whose qualified names are all classes count as class
 * level, the others as feature level.
 */
export function splitByLevel(reference: Reference, classNames: ReadonlySet<string>): Reference {
  const isClassEntry = (e: ReferenceEntry) => [...e.sources, ...e.targets].every(name => classNames.has(name));
  const features = [...(reference.features ?? []), ...reference.correspondences.filter(e => !isClassEntry(e))];
  return { correspondences: reference.correspondences.filter(isClassEntry), features: features.length > 0 ? features : undefined };
}

const keyOf = (source: string, target: string, kind: CorrespondenceKind = 'same', role?: InstanceRole) =>
  `${source} -> ${target} #${kind}${kind === 'instance' && role ? `/${role}` : ''}`;

/** `"<source> -> <target> #<kind>[/<role>]"` per source × target combination. */
export function pairKeys(entries: readonly ReferenceEntry[]): Set<string> {
  return new Set(entries.flatMap(e => e.sources.flatMap(s => e.targets.map(t => keyOf(s, t, e.kind, e.role)))));
}

const correspondenceKeys = (correspondences: readonly Correspondence[]) => new Set(correspondences.flatMap(c =>
  c.sources.flatMap(s => c.targets.map(t => keyOf(s.qualifiedName, t.qualifiedName, c.kind, c.instance?.role))),
));

function score(proposed: Set<string>, reference: Set<string>): Scores {
  const correct = [...proposed].filter(p => reference.has(p)).length;
  const precision = proposed.size === 0 ? 0 : correct / proposed.size;
  const recall = reference.size === 0 ? 0 : correct / reference.size;
  const fMeasure = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, fMeasure };
}

/** Precision, recall and F-measure on class level and, if the reference has one, feature level. */
export function evaluate(result: OverlapResult, reference: Reference): LevelScores {
  const classScores = score(correspondenceKeys(result.correspondences), pairKeys(reference.correspondences));
  if (!reference.features || reference.features.length === 0) return { class: classScores };
  const children = result.correspondences.flatMap(c => c.children ?? []);
  return { class: classScores, feature: score(correspondenceKeys(children), pairKeys(reference.features)) };
}

export const mean = (scores: readonly Scores[]): Scores => {
  const n = Math.max(1, scores.length);
  return {
    precision: scores.reduce((s, x) => s + x.precision, 0) / n,
    recall: scores.reduce((s, x) => s + x.recall, 0) / n,
    fMeasure: scores.reduce((s, x) => s + x.fMeasure, 0) / n,
  };
};

export const formatScores = (s: Scores | undefined) =>
  (s ? `P ${s.precision.toFixed(2)}  R ${s.recall.toFixed(2)}  F ${s.fMeasure.toFixed(2)}` : '–');

const graphRef = (name: string, id: number) => ({
  libraryId: id, name, version: '1.0', ecoreFileId: id * 10, nsUri: null, contentHash: `hash-${name}`,
});
const load = (fileName: string, id: number) =>
  readMetamodelGraph(readFileSync(fileName, 'utf8'), graphRef(path.basename(fileName), id));

/** Graphs and reference of a scenario, or null if one of its files is not available. */
export function loadScenario(id: ScenarioId): LoadedScenario | null {
  const scenario = scenarios().find(s => s.id === id)!;
  if (!scenario.available) return null;
  const source = load(scenario.source, 1);
  const target = load(scenario.target, 2);
  let reference = readReference(readFileSync(scenario.referenceFile, 'utf8'));
  if (scenario.reverseOf) reference = reverseScenario(reference);
  const classNames = new Set([...source.classes, ...target.classes].map(c => c.qualifiedName));
  return { scenario, source, target, reference: splitByLevel(reference, classNames) };
}

const lexical = createWordNetSource(table);
// Tests have no `fetch` for the asset URL, so the table is imported directly.
const hypernyms = createHypernymSource(hypernymTable as HypernymTable);

/** Dependencies of benchmark runs: bundled WordNet data, fixed clock and id. */
export function benchmarkDeps(): ApproachDeps {
  return { lexical, hypernyms, now: () => 0, createId: () => 'benchmark' };
}

export interface ScenarioRun {
  results: OverlapResult[];
  scores: LevelScores;
}

/** Runs one approach on a loaded scenario for each seed and averages the scores. */
export function runScenario<S extends AnalysisSettings>(
  loaded: LoadedScenario,
  approachId: ApproachId,
  settingsFor: (seed: number) => S,
  seeds: readonly number[] = SEEDS,
): ScenarioRun {
  const approach = approachOf(approachId);
  const results = seeds.map(seed =>
    approach.run({ source: loaded.source, target: loaded.target, settings: settingsFor(seed) }, benchmarkDeps()));
  const perSeed = results.map(r => evaluate(r, loaded.reference));
  const feature = perSeed.every(s => s.feature) ? mean(perSeed.map(s => s.feature!)) : undefined;
  return { results, scores: { class: mean(perSeed.map(s => s.class)), feature } };
}
