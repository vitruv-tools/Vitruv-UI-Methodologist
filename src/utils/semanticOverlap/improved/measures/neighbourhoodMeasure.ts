/*
 * Independent copy of the paper approach's `measures/neighbourhoodMeasure.ts`; evolves separately — do not
 * import from the paper pipeline for logic.
 */
import { nameTokenSimilarity } from './nameTokenMeasure';
import type { NameTokens, SimilarityMeasure } from './types';
import { NEIGHBOURHOOD } from './types';

/** Mean over a's neighbours of the best name-token similarity to one of b's neighbours. */
function directed(a: readonly NameTokens[], b: readonly NameTokens[]): number {
  let sum = 0;
  for (const neighbour of a) {
    let best = 0;
    for (const other of b) best = Math.max(best, nameTokenSimilarity(neighbour, other));
    sum += best;
  }
  return sum / a.length;
}

/**
 * Compares the context of two classes: the names of their direct supertypes and of the types
 * their references point to, word by word as in the name-token measure, averaged in both
 * directions. Classes that sit at the same place in their metamodels score high even when their
 * own names differ, e.g. `EAttribute` (supertype `EStructuralFeature`) and `Property` (supertype
 * `StructuralFeature`). A lightweight graph-context extension of the paper's measures; 0 when either
 * class has no such neighbours.
 */
export function neighbourhoodSimilarity(a: { neighbours: readonly NameTokens[] }, b: { neighbours: readonly NameTokens[] }): number {
  if (a.neighbours.length === 0 || b.neighbours.length === 0) return 0;
  return (directed(a.neighbours, b.neighbours) + directed(b.neighbours, a.neighbours)) / 2;
}

/** Registered for classes only; attribute and reference matching is unaffected. */
export const classNeighbourhoodMeasure: SimilarityMeasure = {
  id: NEIGHBOURHOOD,
  version: '1',
  level: 'class',
  score: neighbourhoodSimilarity,
};
