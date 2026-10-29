/**
 * Shared types of the semantic overlap analysis (metamodel matching after Kessentini et al. 2014).
 * Everything here is plain, serialisable data so it can cross the Web Worker boundary.
 */

export type Side = 'source' | 'target';
export type MatchLevel = 'class' | 'feature';
export type ElementKind = 'class' | 'attribute' | 'reference';

/** Identifies the library metamodel an analysis input or result belongs to. */
export interface MetamodelRef {
  libraryId: number;
  name: string;
  version?: string;
  ecoreFileId: number;
  nsUri?: string | null;
  /** SHA-256 (hex) of the ecore text, to detect later changes of the file. */
  contentHash: string;
}

export interface FeatureNode {
  kind: 'attribute' | 'reference';
  name: string;
  /** `pkg.Class.feature` */
  qualifiedName: string;
  /** Qualified name of the declaring class. */
  owner: string;
  typeName: string;
  typeCategory: 'primitive' | 'enum' | 'class';
  lower: number;
  /** -1 for many. */
  upper: number;
  containment: boolean;
  opposite: string | null;
  /** `iD="true"` on an attribute; absent otherwise. */
  isId?: boolean;
}

export interface OperationNode {
  name: string;
  parameterNames: string[];
}

export interface ClassNode {
  /** `pkg.sub.Class`, unique within a graph. */
  qualifiedName: string;
  name: string;
  isAbstract: boolean;
  isInterface: boolean;
  /** Qualified names of supertypes resolved within the same file. */
  superTypes: string[];
  attributes: FeatureNode[];
  references: FeatureNode[];
  operations: OperationNode[];
}

export interface EnumNode {
  name: string;
  qualifiedName: string;
  literals: string[];
}

/** Plain extraction of one `.ecore` file. */
export interface MetamodelGraph {
  ref: MetamodelRef;
  rootPackage: string;
  nsUri: string | null;
  classes: ClassNode[];
  enums: EnumNode[];
  /** `eSuperTypes` that point outside the file and are ignored for structural measures. */
  unresolvedSupertypes: string[];
}

export type Effort = 'fast' | 'balanced' | 'thorough';

export interface GaSettings {
  populationSize: number;
  generations: number;
  crossoverRate: number;
  /** Probability that an offspring is mutated. */
  mutationRate: number;
  /** Share of dimensions re-assigned by one mutation: `max(1, ceil(mutatedFraction · n))`. */
  mutatedFraction: number;
  /** Stop after this many generations without improvement. */
  stallGenerations: number;
}

export interface SaSettings {
  startTemperature: number;
  endTemperature: number;
  /** Geometric cooling `T ← coolingFactor · T`, `0 < coolingFactor < 1`. */
  coolingFactor: number;
  /** Iterations per temperature step, relative to the number of source elements. */
  iterationsPerElement: number;
}

export interface MeasureWeight {
  id: string;
  weight: number;
}

export interface AnalysisSettings {
  /** uint32; the same seed and input give the same result. */
  seed: number;
  effort: Effort;
  /** Weighting of the paper's two objectives; sums to 1. */
  weights: { structural: number; syntactic: number };
  /** `SynHomog = alpha · cosine + beta · (1 − LevNorm)` (Eq. 4); sums to 1. */
  syntactic: { alpha: number; beta: number };
  /** Weight of WordNet synonyms in the name vocabulary; 0 disables synonym expansion. */
  synonymWeight: number;
  /** Score of a source element left without correspondence; 0 reproduces the paper's fitness. */
  nullScore: number;
  /** Maximum number of targets one source element may be matched to (1..5). */
  maxTargetsPerElement: number;
  ga: GaSettings;
  sa: SaSettings;
  /** Additional registered similarity measures and their weights (built-ins are always used). */
  measures: MeasureWeight[];
  /** Id of the search strategy in the strategy registry. */
  strategy: string;
}

/** Stable reference to a metamodel element, resolvable in the referenced ecore. */
export interface ElementRef {
  side: Side;
  kind: ElementKind;
  qualifiedName: string;
  name: string;
  /** Qualified name of the declaring class, for attributes and references. */
  containingClass?: string;
}

/** `same`: equivalent elements; `instance`: an element corresponds to an *instance* of a class. */
export type CorrespondenceKind = 'same' | 'instance';
/** Role of the instantiated class in a type-object pattern. */
export type InstanceRole = 'type' | 'definition' | 'value';
/** Data-type category of an attribute (improved approach). */
export type DataTypeCategory = 'text' | 'number' | 'boolean' | 'enum' | 'other';
/** Like {@link DataTypeCategory}, with numbers split into whole and decimal numbers where known. */
export type FineDataTypeCategory = DataTypeCategory | 'integer' | 'decimal';

export interface Correspondence {
  /** Stable within a result (`c-1`, `c-2`, …). */
  id: string;
  level: MatchLevel;
  sources: ElementRef[];
  targets: ElementRef[];
  /** Combined score in [0, 1]. */
  score: number;
  /** Per-objective / per-measure scores in [0, 1]; always contains `structural` and `syntactic`. */
  scores: Record<string, number>;
  /** Feature-level correspondences, only on class level. */
  children?: Correspondence[];
  /** Absent means `'same'`. */
  kind?: CorrespondenceKind;
  /**
   * Only for `kind = 'instance'`: `side` is the metamodel whose class is instantiated, e.g. for
   * `BrakeDisk ↔ ItemType` in Brake → BOM `{ side: 'target', role: 'type' }`.
   */
  instance?: { side: Side; role: InstanceRole };
  /** Produced by a rule (type-object pattern), not by the search. */
  fixed?: boolean;
}

/** A type-object pattern detected in one metamodel, with its counterpart in the other one. */
export interface TypeObjectPattern {
  /** Metamodel that contains the pattern. */
  side: Side;
  item: string;
  type: string;
  definition: string;
  value: string;
  container: string | null;
  definitionsByCategory: Partial<Record<FineDataTypeCategory, string>>;
  valuesByCategory: Partial<Record<FineDataTypeCategory, string>>;
  counterpart: { base: string; subclasses: string[]; container: string | null } | null;
  /** Rule confidence in [0, 1]. */
  confidence: number;
}

export interface OverlapSummary {
  sourceClassCount: number;
  targetClassCount: number;
  matchedSourceClasses: number;
  matchedTargetClasses: number;
  /** `(matchedSource + matchedTarget) / (sourceCount + targetCount) · 100` */
  overlapPercent: number;
  fitness: number;
  /** Class-level correspondences per kind (improved approach with type-object detection). */
  kindCounts?: { same: number; instance: number };
}

export interface ClassSimilarityMatrix {
  /** Source class qualified names. */
  rows: string[];
  /** Target class qualified names. */
  columns: string[];
  /** Combined similarity, row-major, rounded to 3 decimals. */
  overall: number[];
  perMeasure?: Record<string, number[]>;
}

export interface VersionedId {
  id: string;
  version: string;
  weight?: number;
}

/**
 * Result of one analysis (schema version 1). A class appears in `unmatched` iff it is in no
 * correspondence.
 */
export interface OverlapResult {
  schemaVersion: 1;
  /** Approach that produced the result; absent means the paper approach. */
  approach?: VersionedId;
  id: string;
  createdAt: string;
  durationMs: number;
  source: MetamodelRef;
  target: MetamodelRef;
  settings: AnalysisSettings;
  engine: { strategy: VersionedId; measures: VersionedId[]; lexicalSource: VersionedId | null };
  warnings: string[];
  summary: OverlapSummary;
  classMatrix: ClassSimilarityMatrix;
  correspondences: Correspondence[];
  unmatched: { source: ElementRef[]; target: ElementRef[] };
  typeObjectPatterns?: TypeObjectPattern[];
}

export interface OverlapInput {
  source: MetamodelGraph;
  target: MetamodelGraph;
  settings: AnalysisSettings;
}

/** `loading` is set on the main thread; the other phases come from the worker. */
export type ProgressPhase = 'loading' | 'lexicon' | 'profiling' | 'ga' | 'sa' | 'features';

export interface Progress {
  phase: ProgressPhase;
  /** 0..1 within the whole run, monotonic. */
  fraction: number;
}
