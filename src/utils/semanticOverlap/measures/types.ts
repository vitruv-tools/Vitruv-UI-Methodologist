import type { AnalysisSettings, ElementRef, MatchLevel } from '../types';

/** Per-element data computed once per analysis and shared by all measures. */
export interface ElementProfile {
  ref: ElementRef;
  /** Full name, lower-cased (for edit distance). */
  nameLower: string;
  /** Lemmatised name tokens. */
  tokens: string[];
  /** Term → term-frequency weight (name tokens, context tokens and their synonyms). */
  vocabulary: Map<string, number>;
  /** Euclidean norm of `vocabulary`. */
  norm: number;
  /** Numeric vector for the structural measure (class or feature metrics). */
  metrics: number[];
}

export interface MeasureContext {
  settings: AnalysisSettings;
}

/**
 * A similarity measure between a source and a target element (FR-015). Implementations must be
 * deterministic and side-effect free and return scores in [0, 1].
 */
export interface SimilarityMeasure {
  readonly id: string;
  readonly version: string;
  readonly level: MatchLevel;
  score(source: ElementProfile, target: ElementProfile, ctx: MeasureContext): number;
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
export const BUILT_IN_MEASURES = [STRUCTURAL, COSINE, LEVENSHTEIN] as const;
