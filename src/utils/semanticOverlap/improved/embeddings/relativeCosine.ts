/**
 * Cosine similarity of sentence embeddings, rescaled against the typical similarity of unrelated
 * elements. Raw cosines of a model start at a model-dependent floor; the median over all compared
 * pairs of a level estimates that floor, because most pairs in a matching problem do not match.
 */

/** Rounding step that keeps floating-point differences between machines from changing results. */
const STEP = 1e4;

export const round4 = (value: number) => Math.round(value * STEP) / STEP;

/** Dot product of two L2-normalised vectors, rounded to 1e-4. */
export function cosine(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let k = 0; k < a.length; k++) sum += a[k] * b[k];
  return round4(sum);
}

/** Median of the values (mean of the two middle ones for an even count); 0 for none. */
export function medianBaseline(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return round4(sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

/** `clamp01((cos − b) / (1 − b))`, rounded to 1e-4. */
export function relative(cos: number, baseline: number): number {
  if (baseline >= 1) return cos >= 1 ? 1 : 0;
  return round4(Math.min(1, Math.max(0, (cos - baseline) / (1 - baseline))));
}

/** At most `max` indices of `0..count-1`, evenly spaced and in ascending order. */
export function sampleIndices(count: number, max = 200): number[] {
  if (count <= max) return Array.from({ length: count }, (_, k) => k);
  return Array.from({ length: max }, (_, k) => Math.floor((k * count) / max));
}
