import {
  ABBREVIATIONS, acronymMatches, expandAbbreviation,
} from '../../../../../utils/semanticOverlap/improved/lexical/abbreviations';
import { splitCompound } from '../../../../../utils/semanticOverlap/improved/lexical/compounds';
import { levNorm } from '../../../../../utils/semanticOverlap/improved/measures/levenshteinMeasure';
import { nameTokenSimilarity } from '../../../../../utils/semanticOverlap/improved/measures/nameTokenMeasure';
import { buildClassProfiles, nameTokens } from '../../../../../utils/semanticOverlap/improved/measures/profiles';
import { resolveImprovedSettings } from '../../../../../utils/semanticOverlap/improved/settings';
import { createWordNetSource } from '../../../../../utils/semanticOverlap/lexical/wordNetSource';
import type { MetamodelGraph } from '../../../../../utils/semanticOverlap/types';
import table from '../../../../../assets/wordnet/oewn-2025-synonyms.json';
import { refFor } from '../../fixtures';

const lexical = createWordNetSource(table);
const words = new Set(['brake', 'system', 'bra', 'kes', 'stem', 'disk', 'pad', 'set', 'sets', 'tem']);
const isWord = (word: string) => words.has(word);
const compounds = { compounds: { isWord: (word: string) => lexical.lemma(word) !== null } };

describe('compound splitting and abbreviations', () => {
  it('splits unknown tokens into dictionary words', () => {
    expect(splitCompound('brakesystem', isWord)).toEqual(['brake', 'system']);
    expect(splitCompound('brakediskpad', isWord)).toEqual(['brake', 'disk', 'pad']);
  });

  it('keeps known words and tokens that cannot be split', () => {
    expect(splitCompound('system', isWord)).toEqual(['system']);
    expect(splitCompound('xyzzyq', isWord)).toEqual(['xyzzyq']);
    // Parts must have at least 3 letters.
    expect(splitCompound('bsystem', new Set(['b', 'system']).has.bind(new Set(['b', 'system'])))).toEqual(['bsystem']);
  });

  it('prefers fewer parts, then the longest first part', () => {
    // brakes|ystem is no split; "brake|system" (2 parts) beats "bra|kes|ystem"-style splits.
    expect(splitCompound('brakesystem', new Set(['brake', 'brakes', 'system', 'ystem', 'bra', 'kes']).has.bind(
      new Set(['brake', 'brakes', 'system', 'ystem', 'bra', 'kes'])))).toEqual(['brakes', 'ystem']);
  });

  it('has a small, documented abbreviation list', () => {
    expect(Object.keys(ABBREVIATIONS).sort()).toEqual(
      ['abs', 'attr', 'bom', 'def', 'desc', 'id', 'mm', 'no', 'num', 'oem', 'qty', 'ref', 'val']);
    expect(expandAbbreviation('bom')).toEqual(['bill', 'material']);
    expect(expandAbbreviation('oem')).toEqual(['original', 'equipment', 'manufacturer']);
    expect(expandAbbreviation('brake')).toEqual([]);
  });

  it('matches acronyms against initials', () => {
    expect(acronymMatches('BOM', ['bill', 'of', 'materials'])).toBe(true);
    expect(acronymMatches('BOM', ['bill', 'materials'])).toBe(false);
  });

  it('applies splits and expansions to name tokens, keeping the original token', () => {
    expect(nameTokens('Brakesystem', lexical)).toEqual(['brakesystem']);
    expect(nameTokens('Brakesystem', lexical, compounds)).toEqual(['brake', 'system']);
    expect(nameTokens('OEM_number', lexical, compounds)).toEqual(['oem', 'original', 'equipment', 'manufacturer', 'number']);
    expect(nameTokens('id', lexical, compounds)).toEqual(['id', 'identifier']);
  });

  it('gives expansion tokens the weight of the original in the vocabulary', () => {
    const graph: MetamodelGraph = {
      ref: refFor('bom'), rootPackage: 'bom', nsUri: null, enums: [], unresolvedSupertypes: [],
      classes: [{ qualifiedName: 'bom.BOM', name: 'BOM', isAbstract: false, isInterface: false, superTypes: [], attributes: [], references: [], operations: [] }],
    };
    const [bom] = buildClassProfiles(graph, 'source', lexical, resolveImprovedSettings({ synonymWeight: 0 }), compounds);
    expect(bom.tokens).toEqual(['bom', 'bill', 'material']);
    expect(bom.vocabulary.get('bill')).toBe(bom.vocabulary.get('bom'));
    expect(bom.acronym).toBe('bom');
  });

  it('lets an acronym match the name it abbreviates in the name-token measure', () => {
    const named = (name: string) => ({ tokens: nameTokens(name, lexical, compounds), tokenSynonyms: [] as Set<string>[],
      acronym: /^[A-Z]+$/.test(name) ? name.toLowerCase() : undefined, initials: name === 'BillOfMaterials' ? ['bom', 'bm'] : [] });
    expect(nameTokenSimilarity(named('BOM'), named('BillOfMaterials'))).toBe(1);
  });

  it('leaves the edit distance on the raw names', () => {
    expect(levNorm('Brakesystem', 'BrakeSystem')).toBe(0);
  });
});
