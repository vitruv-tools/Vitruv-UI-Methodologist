import type { NameTokens, SimilarityMeasure } from './types';
import { NAME_TOKENS } from './types';

/** Similarity of two tokens that are WordNet synonyms (identical tokens score 1). */
export const SYNONYM_TOKEN_SIMILARITY = 0.8;

function tokenSimilarity(a: NameTokens, i: number, b: NameTokens, j: number): number {
  if (a.tokens[i] === b.tokens[j]) return 1;
  return a.tokenSynonyms[i]?.has(b.tokens[j]) || b.tokenSynonyms[j]?.has(a.tokens[i]) ? SYNONYM_TOKEN_SIMILARITY : 0;
}

/** Mean over a's name tokens of the best-matching token of b. */
function directed(a: NameTokens, b: NameTokens): number {
  let sum = 0;
  for (let i = 0; i < a.tokens.length; i++) {
    let best = 0;
    for (let j = 0; j < b.tokens.length && best < 1; j++) best = Math.max(best, tokenSimilarity(a, i, b, j));
    sum += best;
  }
  return sum / a.tokens.length;
}

/**
 * Compares element names token by token (same word = 1, WordNet synonym = 0.8, otherwise 0),
 * averaged in both directions. Unlike the vocabulary cosine (Eq. 2) it looks at the names only, so
 * the features of large classes do not dilute it: `EModelElement` ↔ `Element` scores 0.75,
 * `EModelElement` ↔ `TypedElement` 0.5, `EAttribute` ↔ `Property` 0.8. An extension of the paper's
 * syntactic measures, registered as an additional measure.
 */
export function nameTokenSimilarity(a: NameTokens, b: NameTokens): number {
  if (a.tokens.length === 0 || b.tokens.length === 0) return 0;
  return (directed(a, b) + directed(b, a)) / 2;
}

const createNameTokenMeasure = (level: 'class' | 'feature'): SimilarityMeasure => ({
  id: NAME_TOKENS,
  version: '1',
  level,
  score: nameTokenSimilarity,
});

export const classNameTokenMeasure = createNameTokenMeasure('class');
export const featureNameTokenMeasure = createNameTokenMeasure('feature');
