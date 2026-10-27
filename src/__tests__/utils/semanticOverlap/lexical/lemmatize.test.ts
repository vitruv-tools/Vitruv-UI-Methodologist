import { lemmatize } from '../../../../utils/semanticOverlap/lexical/lemmatize';

const words = new Set(['attribute', 'class', 'property', 'contain', 'name', 'box']);
const isWord = (w: string) => words.has(w);

describe('lemmatize', () => {
  it.each([
    ['attributes', 'attribute'],
    ['classes', 'class'],
    ['properties', 'property'],
    ['boxes', 'box'],
    ['containing', 'contain'],
    ['named', 'name'],
    ['attribute', 'attribute'],
    ['unknownwords', 'unknownwords'],
  ])('reduces %s to %s', (token, lemma) => {
    expect(lemmatize(token, isWord)).toBe(lemma);
  });
});
