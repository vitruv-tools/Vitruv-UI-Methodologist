import { documentFrequencies, idfWeights } from '../../../../../utils/semanticOverlap/improved/lexical/idf';
import { nameTokenSimilarity } from '../../../../../utils/semanticOverlap/improved/measures/nameTokenMeasure';
import { buildClassProfiles, classDocument } from '../../../../../utils/semanticOverlap/improved/measures/profiles';
import { resolveImprovedSettings } from '../../../../../utils/semanticOverlap/improved/settings';
import { createWordNetSource } from '../../../../../utils/semanticOverlap/lexical/wordNetSource';
import type { ClassNode, MetamodelGraph } from '../../../../../utils/semanticOverlap/types';
import table from '../../../../../assets/wordnet/oewn-2025-synonyms.json';
import { refFor } from '../../fixtures';

const lexical = createWordNetSource(table);

const attribute = (owner: string, name: string) => ({
  kind: 'attribute' as const, name, qualifiedName: `${owner}.${name}`, owner, typeName: 'EString',
  typeCategory: 'primitive' as const, lower: 0, upper: 1, containment: false, opposite: null,
});
const node = (name: string, attributes: string[]): ClassNode => ({
  qualifiedName: `p.${name}`, name, isAbstract: false, isInterface: false, superTypes: [],
  attributes: attributes.map(a => attribute(`p.${name}`, a)), references: [], operations: [],
});
const graph = (classes: ClassNode[]): MetamodelGraph => ({
  ref: refFor('p'), rootPackage: 'p', nsUri: null, classes, enums: [], unresolvedSupertypes: [],
});

describe('IDF token weighting', () => {
  it('counts each token once per document', () => {
    expect(documentFrequencies([['name', 'name', 'brake'], ['name']])).toEqual(new Map([['name', 2], ['brake', 1]]));
  });

  it('weighs frequent tokens below rare ones, normalised to a maximum of 1', () => {
    const weights = idfWeights(new Map([['name', 3], ['brake', 1]]), 3);
    expect(weights.get('brake')).toBe(1);
    expect(weights.get('name')).toBeCloseTo((Math.log(4 / 4) + 1) / (Math.log(4 / 2) + 1));
    expect(weights.get('name')!).toBeLessThan(1);
  });

  it('lowers generic tokens in the vocabulary, including their synonyms', () => {
    const classes = [node('Brake', ['name']), node('Item', ['name']), node('Part', ['name'])];
    const docs = classes.map(c => classDocument(c, lexical));
    const idf = idfWeights(documentFrequencies(docs), docs.length);
    const [brake] = buildClassProfiles(graph(classes), 'source', lexical, resolveImprovedSettings(), { idf });
    expect(brake.vocabulary.get('name')!).toBeLessThan(brake.vocabulary.get('brake')!);
    const synonym = lexical.synonyms('name')[0];
    expect(brake.vocabulary.get(synonym)).toBeCloseTo(brake.vocabulary.get('name')!);
  });

  it('makes the name-token measure an IDF-weighted average', () => {
    const tokens = (list: string[], weights?: number[]) => ({ tokens: list, tokenSynonyms: list.map(() => new Set<string>()), tokenWeights: weights });
    expect(nameTokenSimilarity(tokens(['brake', 'name']), tokens(['name']))).toBeCloseTo(0.75);
    expect(nameTokenSimilarity(tokens(['brake', 'name'], [1, 0.25]), tokens(['name'], [0.25]))).toBeCloseTo((0.2 + 1) / 2);
  });
});
