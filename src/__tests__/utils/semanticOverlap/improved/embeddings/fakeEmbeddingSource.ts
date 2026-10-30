import { createHash } from 'node:crypto';
import type { EmbeddingSource, EmbeddingTable } from '../../../../../utils/semanticOverlap/improved/embeddings/types';

export const FAKE_MODEL = { id: 'minilm' as const, revision: 'fake-revision', sha256: 'fake-sha256' };
const DIMENSIONS = 384;

const normalise = (vector: Float32Array) => {
  const norm = Math.hypot(...vector) || 1;
  return vector.map(value => value / norm);
};

/** A deterministic 384-dimensional unit vector derived from the text's hash. */
export function hashVector(text: string): Float32Array {
  const vector = new Float32Array(DIMENSIONS);
  let block = createHash('sha256').update(text).digest();
  for (let k = 0; k < DIMENSIONS; k++) {
    if (k % 32 === 0 && k > 0) block = createHash('sha256').update(block).digest();
    vector[k] = block[k % 32] / 255 - 0.5;
  }
  return normalise(vector);
}

/** A unit vector along a few axes, for tests that need known cosines. */
export const axisVector = (...weights: number[]) => normalise(Float32Array.from({ length: DIMENSIONS }, (_, k) => weights[k] ?? 0));

/**
 * Fake embedding source for unit tests (no model, no network): fixed vectors for some texts, hash
 * vectors for all others. Records every call in `calls`.
 */
export function fakeEmbeddingSource(fixed: Record<string, Float32Array> = {}): EmbeddingSource & { calls: string[] } {
  const calls: string[] = [];
  return {
    model: FAKE_MODEL,
    calls,
    embed: text => {
      calls.push(text);
      return Promise.resolve(fixed[text] ?? hashVector(text));
    },
  };
}

/** A table with hash vectors (or fixed ones) for the given texts. */
export function fakeTable(texts: readonly string[], fixed: Record<string, Float32Array> = {}): EmbeddingTable {
  return { model: FAKE_MODEL, vectors: new Map(texts.map(text => [text, fixed[text] ?? hashVector(text)])) };
}
