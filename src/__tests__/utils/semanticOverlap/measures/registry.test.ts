import { createDefaultMeasureRegistry } from '../../../../utils/semanticOverlap/measures/registry';
import { UnknownMeasureError, type SimilarityMeasure } from '../../../../utils/semanticOverlap/measures/types';

describe('measure registry', () => {
  it('contains the built-in and the additional measures', () => {
    const registry = createDefaultMeasureRegistry();
    expect(registry.list('class').map(m => m.id)).toEqual(['structural', 'cosine', 'levenshtein', 'name-tokens', 'neighbourhood']);
    expect(registry.list('feature').map(m => m.id)).toEqual(['structural', 'cosine', 'levenshtein', 'name-tokens']);
  });

  it('registers additional measures and rejects unknown ids', () => {
    const registry = createDefaultMeasureRegistry();
    const constant: SimilarityMeasure = { id: 'constant', version: '1', level: 'class', score: () => 1 };
    registry.register(constant);
    expect(registry.get('constant', 'class')).toBe(constant);
    expect(registry.has('constant', 'feature')).toBe(false);
    expect(() => registry.get('constant', 'feature')).toThrow(UnknownMeasureError);
  });
});
