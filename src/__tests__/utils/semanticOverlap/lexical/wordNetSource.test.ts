import { createWordNetSource, loadWordNetSource, noLexicalSource } from '../../../../utils/semanticOverlap/lexical/wordNetSource';

describe('WordNet lexical source', () => {
  const tiny = createWordNetSource({
    source: 'test', version: 't', license: 'x', url: 'x',
    words: ['attribute', 'dimension', 'property', 'quality'],
    synsets: [[0, 2], [1, 2], [2, 3]],
  });

  it('returns synonyms across all synsets of a word, without the word itself', () => {
    expect(tiny.synonyms('property')).toEqual(['attribute', 'dimension', 'quality']);
    expect(tiny.synonyms('attribute')).toEqual(['property']);
    expect(tiny.synonyms('unknown')).toEqual([]);
  });

  it('lemmatises to known words only', () => {
    expect(tiny.lemma('properties')).toBe('property');
    expect(tiny.lemma('attributes')).toBe('attribute');
    expect(tiny.lemma('foo')).toBeNull();
  });

  it('has a null-object source without data', () => {
    expect(noLexicalSource.lemma('property')).toBeNull();
    expect(noLexicalSource.synonyms('property')).toEqual([]);
  });

  it('loads the bundled Open English WordNet table', async () => {
    const source = await loadWordNetSource();
    expect(source.id).toBe('oewn');
    expect(source.version).toBe('2025');
    expect(source.synonyms('attribute')).toContain('property');
    expect(source.lemma('properties')).toBe('property');
  });
});
