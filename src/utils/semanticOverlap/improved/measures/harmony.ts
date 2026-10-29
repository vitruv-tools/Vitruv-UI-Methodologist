/**
 * Harmony of a similarity matrix (Mao, Peng & Spring 2008): the share of cells that are the
 * strict maximum of both their row and their column (and > 0), relative to min(n, m). A measure
 * that does not discriminate (e.g. 0 everywhere) has harmony 0. Matrices are row-major n × m.
 */
export function harmony(matrix: ArrayLike<number>, n: number, m: number): number {
  if (n === 0 || m === 0) return 0;
  const rowBest = new Int32Array(n).fill(-1);
  const columnBest = new Int32Array(m).fill(-1);
  const strictMax = (values: (k: number) => number, length: number) => {
    let best = -1;
    let unique = false;
    for (let k = 0; k < length; k++) {
      const value = values(k);
      if (!(value > 0)) continue;
      if (best < 0 || value > values(best)) {
        best = k;
        unique = true;
      } else if (value === values(best)) {
        unique = false;
      }
    }
    return unique ? best : -1;
  };
  for (let i = 0; i < n; i++) rowBest[i] = strictMax(j => matrix[i * m + j], m);
  for (let j = 0; j < m; j++) columnBest[j] = strictMax(i => matrix[i * m + j], n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const j = rowBest[i];
    if (j >= 0 && columnBest[j] === i) count++;
  }
  return count / Math.min(n, m);
}

/**
 * Weights scaled by harmony: `w · h`. When every scaled weight is 0 the plain weights are kept, so
 * the combination never degenerates.
 */
export function adaptiveWeights(weights: readonly number[], harmonies: readonly number[]): number[] {
  const scaled = weights.map((w, k) => w * harmonies[k]);
  return scaled.some(w => w > 0) ? scaled : [...weights];
}

/** `Σ w·h·s / Σ w·h` over the values that are numbers (NaN = not applicable). */
export function adaptiveCombine(values: readonly number[], weights: readonly number[], harmonies: readonly number[]): number {
  const effective = adaptiveWeights(weights, harmonies);
  let sum = 0;
  let total = 0;
  values.forEach((value, k) => {
    if (Number.isNaN(value)) return;
    sum += effective[k] * value;
    total += effective[k];
  });
  return total === 0 ? 0 : sum / total;
}
