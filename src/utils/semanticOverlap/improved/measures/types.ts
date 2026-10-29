/*
 * Independent copy of the paper approach's `measures/types.ts`; evolves separately — do not
 * import from the paper pipeline for logic.
 */
import type { AnalysisSettings, ElementRef, MatchLevel } from '../../types';
import type { HypernymSource } from '../lexical/hypernymSource';

/** Lemmatised tokens of a name with the WordNet synonyms of each token. */
export interface NameTokens {
  tokens: string[];
  /** WordNet synonyms of each name token (same order as `tokens`). */
  tokenSynonyms: ReadonlySet<string>[];
  /** Weight of each name token (IDF); absent means 1 for every token. */
  tokenWeights?: number[];
  /** The name as an acronym (`BOM` → `bom`), only with compound handling. */
  acronym?: string;
  /** Initials of the name's words an acronym may match, only with compound handling. */
  initials?: string[];
}

/** Per-element data computed once per analysis and shared by all measures. */
export interface ElementProfile extends NameTokens {
  ref: ElementRef;
  /** Full name, lower-cased (for edit distance). */
  nameLower: string;
  /** Term → term-frequency weight (name tokens, context tokens and their synonyms). */
  vocabulary: Map<string, number>;
  /** Euclidean norm of `vocabulary`. */
  norm: number;
  /** Numeric vector for the structural measure (class or feature metrics). */
  metrics: number[];
  /** Names of related classes (classes: direct supertypes and reference target types). */
  neighbours: NameTokens[];
  /** Role of a class in its metamodel (see roleMeasure.ts); classes only. */
  roleVector?: number[];
  /** Share of attribute data-type categories (see datatypeMeasure.ts); null without attributes. */
  datatypeHistogram?: number[] | null;
}

export interface MeasureContext {
  settings: AnalysisSettings;
  /** WordNet hypernyms (improved approach); null or absent when not loaded. */
  hypernyms?: HypernymSource | null;
}

/**
 * A similarity measure between a source and a target element. Implementations must be
 * deterministic and side-effect free and return scores in [0, 1].
 */
export interface SimilarityMeasure {
  readonly id: string;
  readonly version: string;
  readonly level: MatchLevel;
  score(source: ElementProfile, target: ElementProfile, ctx: MeasureContext): number;
  /**
   * False if the measure says nothing about the pair (e.g. no attributes to compare); it is then
   * left out of that pair's combination. Absent means always applicable.
   */
  applicable?(source: ElementProfile, target: ElementProfile, ctx: MeasureContext): boolean;
  /** Score of one source against a group of targets (1:n). Defaults to the mean of `score`. */
  scoreGroup?(source: ElementProfile, targets: readonly ElementProfile[], ctx: MeasureContext): number;
}

export class UnknownMeasureError extends Error {
  constructor(id: string, level: MatchLevel) {
    super(`Unknown ${level}-level similarity measure "${id}"`);
    this.name = 'UnknownMeasureError';
  }
}

export interface MeasureRegistry {
  register(measure: SimilarityMeasure): void;
  get(id: string, level: MatchLevel): SimilarityMeasure;
  has(id: string, level: MatchLevel): boolean;
  list(level: MatchLevel): readonly SimilarityMeasure[];
}

/** Ids of the paper's built-in measures; always used, combined into the two objectives. */
export const STRUCTURAL = 'structural';
export const COSINE = 'cosine';
export const LEVENSHTEIN = 'levenshtein';
/** Optional additional measure comparing name tokens directly (see nameTokenMeasure.ts). */
export const NAME_TOKENS = 'name-tokens';
/** Optional additional measure comparing the names of related classes (see neighbourhoodMeasure.ts). */
export const NEIGHBOURHOOD = 'neighbourhood';
/** Wu-Palmer similarity of name tokens over WordNet hypernyms (see hypernymMeasure.ts). */
export const HYPERNYM = 'hypernym';
/** Role of a class in its metamodel (see roleMeasure.ts). */
export const ROLES = 'roles';
/** Mix of attribute data types (see datatypeMeasure.ts). */
export const DATATYPES = 'datatypes';
export const BUILT_IN_MEASURES = [STRUCTURAL, COSINE, LEVENSHTEIN] as const;
