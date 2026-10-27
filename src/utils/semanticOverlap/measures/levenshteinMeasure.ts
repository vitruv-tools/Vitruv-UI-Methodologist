import type { SimilarityMeasure } from './types';
import { LEVENSHTEIN } from './types';

/** Classic edit distance (insertions, deletions, substitutions of single characters). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

/** Eq. 3: edit distance divided by the length of the longer string (case-insensitive). */
export function levNorm(a: string, b: string): number {
  const longer = Math.max(a.length, b.length);
  return longer === 0 ? 0 : levenshtein(a.toLowerCase(), b.toLowerCase()) / longer;
}

/** Scores `1 − LevNorm` on the full element names, the edit-distance part of Eq. 4. */
const createLevenshteinMeasure = (level: 'class' | 'feature'): SimilarityMeasure => ({
  id: LEVENSHTEIN,
  version: '1',
  level,
  score: (source, target) => 1 - levNorm(source.nameLower, target.nameLower),
});

export const classLevenshteinMeasure = createLevenshteinMeasure('class');
export const featureLevenshteinMeasure = createLevenshteinMeasure('feature');
