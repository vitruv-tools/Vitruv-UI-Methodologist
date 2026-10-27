import type { ElementProfile, SimilarityMeasure } from './types';
import { COSINE } from './types';

/** Eq. 1–2: cosine of the term-frequency vectors of both elements' vocabularies. */
export function cosineSimilarity(a: ElementProfile, b: ElementProfile): number {
  if (a.norm === 0 || b.norm === 0) return 0;
  const [smaller, larger] = a.vocabulary.size <= b.vocabulary.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, weight] of smaller.vocabulary) {
    const other = larger.vocabulary.get(term);
    if (other !== undefined) dot += weight * other;
  }
  return Math.min(1, dot / (a.norm * b.norm));
}

const createCosineMeasure = (level: 'class' | 'feature'): SimilarityMeasure => ({
  id: COSINE,
  version: '1',
  level,
  score: cosineSimilarity,
});

export const classCosineMeasure = createCosineMeasure('class');
export const featureCosineMeasure = createCosineMeasure('feature');
