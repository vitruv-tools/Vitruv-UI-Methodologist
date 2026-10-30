import type { EmbeddingModelId } from './modelManifest';

/** The model that produced a table's vectors. */
export interface EmbeddingModelRef {
  id: EmbeddingModelId;
  revision: string;
  sha256: string;
}

/**
 * Sentence-embedding vectors of the element descriptions of one analysis, keyed by description
 * text. Built asynchronously before the (synchronous) analysis, which only looks vectors up.
 */
export interface EmbeddingTable {
  model: EmbeddingModelRef;
  vectors: ReadonlyMap<string, Float32Array>;
}

/** The short text that describes a class or feature for the embedding measure. */
export interface ElementDescription {
  qualifiedName: string;
  level: 'class' | 'feature';
  text: string;
}

/** Produces L2-normalised vectors, one text at a time; identical output for identical text. */
export interface EmbeddingSource {
  readonly model: EmbeddingModelRef;
  embed(text: string): Promise<Float32Array>;
}

export type EmbeddingAvailability =
  | { state: 'unknown' | 'loading' | 'ready' }
  | { state: 'unavailable'; reason: string };
