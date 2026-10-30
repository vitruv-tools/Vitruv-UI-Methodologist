import { cosine, relative } from '../embeddings/relativeCosine';
import type { ElementProfile, MeasureContext, SimilarityMeasure } from './types';
import { EMBEDDING } from './types';

/**
 * Meaning of the elements' descriptions: the cosine of their sentence embeddings, rescaled against
 * the median cosine of the level (`ctx.embeddingBaseline`), so unrelated pairs score near 0. Not
 * applicable when either element has no embedding. Groups use the mean over the targets.
 */
export function embeddingSimilarity(source: ElementProfile, target: ElementProfile, ctx: MeasureContext): number {
  if (!source.embedding || !target.embedding) return 0;
  return relative(cosine(source.embedding, target.embedding), ctx.embeddingBaseline ?? 0);
}

const createEmbeddingMeasure = (level: 'class' | 'feature'): SimilarityMeasure => ({
  id: EMBEDDING,
  version: '1',
  level,
  score: embeddingSimilarity,
  applicable: (source, target) => source.embedding !== undefined && target.embedding !== undefined,
});

export const classEmbeddingMeasure = createEmbeddingMeasure('class');
export const featureEmbeddingMeasure = createEmbeddingMeasure('feature');
