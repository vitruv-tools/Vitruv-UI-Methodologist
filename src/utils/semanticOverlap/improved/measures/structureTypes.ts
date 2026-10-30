import type { ClassNode, FeatureNode, FineDataTypeCategory, MetamodelGraph } from '../../types';
import { featuresWithInherited } from '../hierarchy/features';
import { fineDataTypeCategory } from './datatypeMeasure';
import type { ElementProfile, MeasureContext, SimilarityMeasure } from './types';
import { STRUCTURE_TYPES } from './types';

/**
 * Data-structure similarity after Fang (2022, ch. 4): classes are compared by the types and
 * multiplicities of their flattened features, ignoring names. A second-pass measure: class-typed
 * features count as equal to the degree their classes are similar in the first pass.
 */

export type Multiplicity = 'one' | 'set' | 'seq';

export interface Signature {
  /** Fine data-type category, or `class:<qualified name>` for references. */
  typeKey: FineDataTypeCategory | `class:${string}`;
  multiplicity: Multiplicity;
  /** 0: own or inherited feature; 1 and 2: reached over that many references. */
  hop: number;
  name: string;
}

const NUMBERS = new Set<string>(['integer', 'decimal', 'number']);
const MAX_HOPS = 2;

const multiplicityOf = (feature: FeatureNode): Multiplicity => {
  if (feature.upper === 1) return 'one';
  return feature.ordered === false ? 'set' : 'seq';
};

const referencedClass = (graph: MetamodelGraph, feature: FeatureNode) =>
  graph.classes.find(c => c.name === feature.typeName);

/**
 * Own and inherited features of a class (hop 0) and of the classes reachable over one and two
 * references (hops 1 and 2); each class is expanded once (cycles stop). At most `maxSignatures`,
 * hop 0 first, then by name.
 */
export function flattenSignatures(graph: MetamodelGraph, classQN: string, maxSignatures: number): Signature[] {
  const signatures: Signature[] = [];
  const expanded = new Set<string>([classQN]);
  let frontier: string[] = [classQN];
  for (let hop = 0; hop <= MAX_HOPS && frontier.length > 0; hop++) {
    const next: string[] = [];
    for (const qn of frontier) {
      for (const feature of featuresWithInherited(graph, qn)) {
        const type = feature.kind === 'reference' ? referencedClass(graph, feature) : undefined;
        signatures.push({
          typeKey: type ? `class:${type.qualifiedName}` : fineDataTypeCategory(feature),
          multiplicity: multiplicityOf(feature),
          hop,
          name: feature.name,
        });
        if (type && !expanded.has(type.qualifiedName)) {
          expanded.add(type.qualifiedName);
          next.push(type.qualifiedName);
        }
      }
    }
    frontier = next;
  }
  signatures.sort((a, b) => a.hop - b.hop || a.name.localeCompare(b.name));
  return signatures.slice(0, maxSignatures);
}

/** Multiplicity similarity (Fang 2022, Table 4.3): equal 1, set/seq 0.8, one/many 0.5. */
export function multiplicitySimilarity(a: Multiplicity, b: Multiplicity): number {
  if (a === b) return 1;
  return a === 'one' || b === 'one' ? 0.5 : 0.8;
}

const isClassKey = (key: string) => key.startsWith('class:');

/** Type similarity × multiplicity similarity; class types score their first-pass similarity. */
export function signatureSimilarity(a: Signature, b: Signature, classSimilarity: (source: string, target: string) => number): number {
  let type: number;
  if (isClassKey(a.typeKey) && isClassKey(b.typeKey)) type = classSimilarity(a.typeKey.slice(6), b.typeKey.slice(6));
  else if (isClassKey(a.typeKey) || isClassKey(b.typeKey)) type = 0;
  else if (a.typeKey === b.typeKey) type = 1;
  else type = NUMBERS.has(a.typeKey) && NUMBERS.has(b.typeKey) ? 0.8 : 0;
  return type === 0 ? 0 : type * multiplicitySimilarity(a.multiplicity, b.multiplicity);
}

const hopWeight = (signature: Signature) => 1 / (1 + signature.hop);

/**
 * Greedy assignment between two signature lists: each source signature, in order, takes the most
 * similar unused target signature. Each pair counts with the mean weight `1/(1+hop)` of its two
 * signatures; the sum is divided by the larger total weight. NaN when a list is empty.
 */
export function signatureListSimilarity(
  sources: readonly Signature[],
  targets: readonly Signature[],
  classSimilarity: (source: string, target: string) => number,
): number {
  if (sources.length === 0 || targets.length === 0) return Number.NaN;
  const used = new Uint8Array(targets.length);
  let sum = 0;
  for (const source of sources) {
    let best = -1;
    let bestValue = 0;
    targets.forEach((target, j) => {
      if (used[j]) return;
      const value = signatureSimilarity(source, target, classSimilarity);
      if (value > bestValue) {
        best = j;
        bestValue = value;
      }
    });
    if (best < 0) continue;
    used[best] = 1;
    sum += bestValue * (hopWeight(source) + hopWeight(targets[best])) / 2;
  }
  const total = Math.max(sources.reduce((s, x) => s + hopWeight(x), 0), targets.reduce((s, x) => s + hopWeight(x), 0));
  return Math.min(1, sum / total);
}

/**
 * Row-major n × m data-structure similarity of the classes of two graphs (in their class order),
 * using the first-pass combined similarity for class-typed signatures.
 */
export function structureTypesMatrix(
  source: MetamodelGraph,
  target: MetamodelGraph,
  firstPassCombined: Float32Array,
  maxSignatures: number,
): Float32Array {
  const n = source.classes.length;
  const m = target.classes.length;
  const sourceIndex = new Map(source.classes.map((c, i) => [c.qualifiedName, i]));
  const targetIndex = new Map(target.classes.map((c, j) => [c.qualifiedName, j]));
  const classSimilarity = (s: string, t: string) => {
    const i = sourceIndex.get(s);
    const j = targetIndex.get(t);
    return i === undefined || j === undefined ? 0 : firstPassCombined[i * m + j];
  };
  const flatten = (graph: MetamodelGraph) => (node: ClassNode) => flattenSignatures(graph, node.qualifiedName, maxSignatures);
  const sourceSignatures = source.classes.map(flatten(source));
  const targetSignatures = target.classes.map(flatten(target));
  const matrix = new Float32Array(n * m);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) matrix[i * m + j] = signatureListSimilarity(sourceSignatures[i], targetSignatures[j], classSimilarity);
  }
  return matrix;
}

/** Looks up a precomputed data-structure matrix by class qualified names. */
export interface StructureTypesLookup {
  score(source: string, target: string): number;
}

export function structureTypesLookup(source: MetamodelGraph, target: MetamodelGraph, matrix: Float32Array): StructureTypesLookup {
  const m = target.classes.length;
  const sourceIndex = new Map(source.classes.map((c, i) => [c.qualifiedName, i]));
  const targetIndex = new Map(target.classes.map((c, j) => [c.qualifiedName, j]));
  return {
    score: (s, t) => {
      const i = sourceIndex.get(s);
      const j = targetIndex.get(t);
      return i === undefined || j === undefined ? Number.NaN : matrix[i * m + j];
    },
  };
}

const lookupScore = (source: ElementProfile, target: ElementProfile, ctx: MeasureContext) =>
  ctx.structureTypes?.score(source.ref.qualifiedName, target.ref.qualifiedName) ?? Number.NaN;

/** Class-level measure over the second-pass matrix in `ctx.structureTypes`; not applicable without signatures. */
export const classStructureTypesMeasure: SimilarityMeasure = {
  id: STRUCTURE_TYPES,
  version: '1',
  level: 'class',
  score: (source, target, ctx) => {
    const value = lookupScore(source, target, ctx);
    return Number.isNaN(value) ? 0 : value;
  },
  applicable: (source, target, ctx) => !Number.isNaN(lookupScore(source, target, ctx)),
};
