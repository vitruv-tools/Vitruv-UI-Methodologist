import { classNameTokenMeasure, nameTokenSimilarity, SYNONYM_TOKEN_SIMILARITY } from '../../../../utils/semanticOverlap/measures/nameTokenMeasure';
import { buildClassProfiles } from '../../../../utils/semanticOverlap/measures/profiles';
import { createWordNetSource } from '../../../../utils/semanticOverlap/lexical/wordNetSource';
import { DEFAULT_SETTINGS } from '../../../../utils/semanticOverlap/settings';
import type { MetamodelGraph } from '../../../../utils/semanticOverlap/types';
import { refFor } from '../fixtures';

const lexical = createWordNetSource({
  source: 't', version: 't', license: 't', url: 't', words: ['attribute', 'property'], synsets: [[0, 1]],
});
const graph = (...names: string[]): MetamodelGraph => ({
  ref: refFor('G'), rootPackage: 'p', nsUri: null, enums: [], unresolvedSupertypes: [],
  classes: names.map(name => ({ qualifiedName: `p.${name}`, name, isAbstract: false, isInterface: false, superTypes: [], attributes: [], references: [], operations: [] })),
});
const profiles = (...names: string[]) => buildClassProfiles(graph(...names), 'source', lexical, DEFAULT_SETTINGS);

describe('name-token measure', () => {
  const [modelElement, element, typedElement, attribute, property, invoice] =
    profiles('EModelElement', 'Element', 'TypedElement', 'EAttribute', 'Property', 'Invoice');

  it('averages the best token match in both directions', () => {
    expect(nameTokenSimilarity(modelElement, element)).toBeCloseTo(0.75);
    expect(nameTokenSimilarity(modelElement, typedElement)).toBeCloseTo(0.5);
    expect(nameTokenSimilarity(element, element)).toBe(1);
  });

  it('scores WordNet synonyms below identical words and unrelated names as 0', () => {
    expect(nameTokenSimilarity(attribute, property)).toBe(SYNONYM_TOKEN_SIMILARITY);
    expect(nameTokenSimilarity(attribute, invoice)).toBe(0);
    expect(classNameTokenMeasure.score(attribute, property, { settings: DEFAULT_SETTINGS })).toBe(SYNONYM_TOKEN_SIMILARITY);
  });

  it('is 0 when a name has no tokens', () => {
    const [id] = profiles('iD');
    expect(nameTokenSimilarity(id, element)).toBe(0);
  });
});
