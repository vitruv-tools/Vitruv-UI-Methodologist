import type { MetamodelGraph } from '../../types';

/** Edge labels of the class graph; each has an inverse so similarity flows both ways. */
export const EDGE_LABELS = ['contains', 'containedBy', 'refers', 'referredBy', 'extends', 'extendedBy'] as const;
export type EdgeLabel = typeof EDGE_LABELS[number];

/** Out-neighbours per label and class index (classes in `graph.classes` order). */
export type ClassGraph = Record<EdgeLabel, number[][]>;

/** Above this many pair-graph edges per iteration flooding is skipped (browser budget). */
export const MAX_PAIR_EDGES = 5_000_000;
const RESIDUAL = 1e-4;

/**
 * Class graph with labelled edges: `contains` (owner → type of a containment reference), `refers`
 * (owner → type of another reference), `extends` (sub → super), plus their inverses.
 */
export function buildClassGraph(graph: MetamodelGraph): ClassGraph {
  const index = new Map(graph.classes.map((c, k) => [c.qualifiedName, k]));
  const bySimpleName = new Map<string, number>();
  graph.classes.forEach((c, k) => { if (!bySimpleName.has(c.name)) bySimpleName.set(c.name, k); });
  const edges = Object.fromEntries(EDGE_LABELS.map(label => [label, graph.classes.map(() => [] as number[])])) as ClassGraph;
  const add = (label: EdgeLabel, inverse: EdgeLabel, from: number, to: number) => {
    if (!edges[label][from].includes(to)) edges[label][from].push(to);
    if (!edges[inverse][to].includes(from)) edges[inverse][to].push(from);
  };
  graph.classes.forEach((node, k) => {
    for (const reference of node.references) {
      const to = bySimpleName.get(reference.typeName);
      if (to === undefined) continue;
      if (reference.containment) add('contains', 'containedBy', k, to);
      else add('refers', 'referredBy', k, to);
    }
    for (const parent of node.superTypes) {
      const to = index.get(parent);
      if (to !== undefined) add('extends', 'extendedBy', k, to);
    }
  });
  return edges;
}

/** Number of edges of the pairwise connectivity graph. */
export function pairEdgeCount(a: ClassGraph, b: ClassGraph): number {
  const total = (edges: number[][]) => edges.reduce((sum, list) => sum + list.length, 0);
  return EDGE_LABELS.reduce((sum, label) => sum + total(a[label]) * total(b[label]), 0);
}

export interface FloodingResult {
  /** Fixpoint similarity in [0, 1] (row-major n × m), or null when skipped. */
  flood: Float32Array | null;
  iterations: number;
}

/**
 * Similarity flooding (Melnik, Garcia-Molina & Rahm 2002), fixpoint formula C:
 * `σᵏ⁺¹ = normalise(σ⁰ + σᵏ + φ(σ⁰ + σᵏ))`. The pair (s, t) passes its similarity to (s′, t′) when
 * s →ℓ s′ and t →ℓ t′ carry the same label ℓ, weighted `1 / (outdegℓ(s) · outdegℓ(t))`;
 * `normalise` divides by the maximum. Stops when no value changes by more than 1e-4.
 */
export function similarityFlooding(
  source: ClassGraph,
  target: ClassGraph,
  initial: ArrayLike<number>,
  n: number,
  m: number,
  maxIterations: number,
): FloodingResult {
  if (n === 0 || m === 0 || pairEdgeCount(source, target) > MAX_PAIR_EDGES) return { flood: null, iterations: 0 };
  const sigma0 = Float32Array.from({ length: n * m }, (_, k) => (Number.isNaN(initial[k]) ? 0 : initial[k]));
  let sigma = Float32Array.from(sigma0);
  let iterations = 0;
  while (iterations < maxIterations) {
    iterations++;
    const base = new Float32Array(n * m);
    for (let k = 0; k < n * m; k++) base[k] = sigma0[k] + sigma[k];
    const next = Float32Array.from(base);
    for (const label of EDGE_LABELS) {
      const sourceEdges = source[label];
      const targetEdges = target[label];
      for (let s = 0; s < n; s++) {
        const sOut = sourceEdges[s];
        if (sOut.length === 0) continue;
        for (let t = 0; t < m; t++) {
          const tOut = targetEdges[t];
          if (tOut.length === 0) continue;
          const flow = base[s * m + t] / (sOut.length * tOut.length);
          if (flow === 0) continue;
          for (const s2 of sOut) for (const t2 of tOut) next[s2 * m + t2] += flow;
        }
      }
    }
    let max = 0;
    for (let k = 0; k < n * m; k++) max = Math.max(max, next[k]);
    if (max > 0) for (let k = 0; k < n * m; k++) next[k] /= max;
    let residual = 0;
    for (let k = 0; k < n * m; k++) residual = Math.max(residual, Math.abs(next[k] - sigma[k]));
    sigma = next;
    if (residual < RESIDUAL) break;
  }
  return { flood: sigma, iterations };
}

/** `(1 − λ) · combined + λ · flood`. */
export function blend(combined: ArrayLike<number>, flood: ArrayLike<number>, weight: number): Float32Array {
  return Float32Array.from({ length: combined.length }, (_, k) => (1 - weight) * combined[k] + weight * flood[k]);
}
