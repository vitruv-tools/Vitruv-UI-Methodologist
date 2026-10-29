import type { MeasureContext, NameTokens, SimilarityMeasure } from './types';
import { HYPERNYM } from './types';
import type { ImprovedSettings } from '../settings';

const DEFAULT_SENSES = 3;

/** IDF-weighted mean over a's tokens of the best Wu-Palmer similarity to one of b's tokens. */
function directed(a: NameTokens, b: NameTokens, similarity: (x: string, y: string) => number): number {
  let sum = 0;
  let total = 0;
  for (let i = 0; i < a.tokens.length; i++) {
    let best = 0;
    for (let j = 0; j < b.tokens.length && best < 1; j++) best = Math.max(best, similarity(a.tokens[i], b.tokens[j]));
    const weight = a.tokenWeights?.[i] ?? 1;
    sum += weight * best;
    total += weight;
  }
  return total === 0 ? 0 : sum / total;
}

/**
 * Compares names word by word through their more general terms in WordNet (Wu-Palmer similarity
 * of nouns), averaged in both directions: `BrakeComponent` ↔ `Item` relates `component` and `item`
 * through a common ancestor although they are no synonyms. 0 without hypernym data.
 */
export function hypernymSimilarity(a: NameTokens, b: NameTokens, ctx: MeasureContext): number {
  const hypernyms = ctx.hypernyms;
  if (!hypernyms || a.tokens.length === 0 || b.tokens.length === 0) return 0;
  const senses = (ctx.settings as Partial<ImprovedSettings>).params?.hypernymSenses ?? DEFAULT_SENSES;
  const similarity = (x: string, y: string) => hypernyms.wuPalmer(x, y, senses);
  return (directed(a, b, similarity) + directed(b, a, similarity)) / 2;
}

const createHypernymMeasure = (level: 'class' | 'feature'): SimilarityMeasure => ({
  id: HYPERNYM,
  version: '1',
  level,
  score: hypernymSimilarity,
});

export const classHypernymMeasure = createHypernymMeasure('class');
export const featureHypernymMeasure = createHypernymMeasure('feature');
