import { cosineSimilarity } from '../../../../utils/semanticOverlap/measures/cosineMeasure';
import { buildClassProfiles } from '../../../../utils/semanticOverlap/measures/profiles';
import { createWordNetSource } from '../../../../utils/semanticOverlap/lexical/wordNetSource';
import { DEFAULT_SETTINGS } from '../../../../utils/semanticOverlap/settings';
import type { MetamodelGraph } from '../../../../utils/semanticOverlap/types';
import { profile, } from '../helpers';
import { refFor } from '../fixtures';

const graphWith = (name: string): MetamodelGraph => ({
  ref: refFor(name), rootPackage: 'p', nsUri: null, enums: [], unresolvedSupertypes: [],
  classes: [{ qualifiedName: `p.${name}`, name, isAbstract: false, isInterface: false, superTypes: [], attributes: [], references: [], operations: [] }],
});

describe('cosine measure (Eq. 1–2)', () => {
  it('is 1 for identical and 0 for disjoint vocabularies', () => {
    expect(cosineSimilarity(profile('Person', 'source'), profile('Person', 'target'))).toBeCloseTo(1);
    expect(cosineSimilarity(profile('Person', 'source'), profile('Invoice', 'target'))).toBe(0);
  });

  it('finds similarity between different names through WordNet synonyms', () => {
    const lexical = createWordNetSource({
      source: 't', version: 't', license: 't', url: 't',
      words: ['attribute', 'property'], synsets: [[0, 1]],
    });
    const [attribute] = buildClassProfiles(graphWith('EAttribute'), 'source', lexical, DEFAULT_SETTINGS);
    const [property] = buildClassProfiles(graphWith('Property'), 'target', lexical, DEFAULT_SETTINGS);
    expect(cosineSimilarity(attribute, property)).toBeGreaterThan(0.5);
    const [noSynonyms] = buildClassProfiles(graphWith('EAttribute'), 'source', lexical, { ...DEFAULT_SETTINGS, synonymWeight: 0 });
    const [propertyNoSynonyms] = buildClassProfiles(graphWith('Property'), 'target', lexical, { ...DEFAULT_SETTINGS, synonymWeight: 0 });
    expect(cosineSimilarity(noSynonyms, propertyNoSynonyms)).toBe(0);
  });
});
