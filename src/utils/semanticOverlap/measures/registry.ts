import { classCosineMeasure, featureCosineMeasure } from './cosineMeasure';
import { classLevenshteinMeasure, featureLevenshteinMeasure } from './levenshteinMeasure';
import { classNameTokenMeasure, featureNameTokenMeasure } from './nameTokenMeasure';
import { classNeighbourhoodMeasure } from './neighbourhoodMeasure';
import { classStructuralMeasure, featureStructuralMeasure } from './structuralMeasure';
import type { MeasureRegistry, SimilarityMeasure } from './types';
import { UnknownMeasureError } from './types';

export function createMeasureRegistry(measures: readonly SimilarityMeasure[] = []): MeasureRegistry {
  const byKey = new Map<string, SimilarityMeasure>();
  const key = (id: string, level: string) => `${level}:${id}`;
  const registry: MeasureRegistry = {
    register: measure => { byKey.set(key(measure.id, measure.level), measure); },
    get: (id, level) => {
      const measure = byKey.get(key(id, level));
      if (!measure) throw new UnknownMeasureError(id, level);
      return measure;
    },
    has: (id, level) => byKey.has(key(id, level)),
    list: level => [...byKey.values()].filter(measure => measure.level === level),
  };
  measures.forEach(registry.register);
  return registry;
}

/**
 * Registry with the paper's structural, cosine and edit-distance measures and the additional
 * name-token measure, on both levels. Additional measures only count when given a weight.
 */
export function createDefaultMeasureRegistry(): MeasureRegistry {
  return createMeasureRegistry([
    classStructuralMeasure, classCosineMeasure, classLevenshteinMeasure, classNameTokenMeasure, classNeighbourhoodMeasure,
    featureStructuralMeasure, featureCosineMeasure, featureLevenshteinMeasure, featureNameTokenMeasure,
  ]);
}
