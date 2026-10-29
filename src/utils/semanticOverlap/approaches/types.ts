import type { HypernymSource } from '../improved/lexical/hypernymSource';
import type { LexicalSource } from '../lexical/wordNetSource';
import type { AnalysisSettings, MetamodelGraph, OverlapResult, Progress } from '../types';

export type ApproachId = 'paper' | 'improved';
/** Data an approach needs in the worker, loaded lazily. */
export type ResourceId = 'synonyms' | 'hypernyms';

export interface ApproachDeps {
  lexical: LexicalSource;
  /** Only used by the improved approach; null when it could not be loaded. */
  hypernyms?: HypernymSource | null;
  onProgress?: (progress: Progress) => void;
  now?: () => number;
  createId?: () => string;
}

/** A named, versioned way to compute an overlap result (paper approach, improved approach). */
export interface Approach<S extends AnalysisSettings = AnalysisSettings> {
  readonly id: ApproachId;
  readonly version: string;
  readonly label: string;
  /** Defaults with a fresh random seed. */
  defaultSettings(): S;
  /** Human-readable problems; empty means valid. */
  validate(settings: S): string[];
  requiredResources(settings: S): ResourceId[];
  /** Pure and deterministic for a fixed seed; sets `result.approach`. */
  run(input: { source: MetamodelGraph; target: MetamodelGraph; settings: S }, deps: ApproachDeps): OverlapResult;
}
