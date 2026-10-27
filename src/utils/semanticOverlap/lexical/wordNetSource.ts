import { lemmatize } from './lemmatize';

/** Supplies base forms and synonyms of words; replaceable (FR-017). */
export interface LexicalSource {
  readonly id: string;
  readonly version: string;
  /** Base form if the source knows it, else null. */
  lemma(token: string): string | null;
  /** Synonyms of a base form, excluding the word itself; empty if unknown. */
  synonyms(lemma: string): readonly string[];
}

/** Shape of `src/assets/wordnet/oewn-2025-synonyms.json` (see its README). */
export interface SynonymTable {
  source: string;
  version: string;
  license: string;
  url: string;
  words: string[];
  synsets: number[][];
}

/** Used when no lexical data is available: no lemmas, no synonyms. */
export const noLexicalSource: LexicalSource = {
  id: 'none',
  version: '0',
  lemma: () => null,
  synonyms: () => [],
};

export function createWordNetSource(table: SynonymTable): LexicalSource {
  const synsetsOfWord = new Map<string, number[]>();
  table.synsets.forEach((members, synsetIndex) => {
    for (const wordIndex of members) {
      const word = table.words[wordIndex];
      const list = synsetsOfWord.get(word);
      if (list) list.push(synsetIndex);
      else synsetsOfWord.set(word, [synsetIndex]);
    }
  });
  const isWord = (word: string) => synsetsOfWord.has(word);
  const synonymCache = new Map<string, readonly string[]>();

  return {
    id: 'oewn',
    version: table.version,
    lemma: token => {
      const base = lemmatize(token, isWord);
      return isWord(base) ? base : null;
    },
    synonyms: lemma => {
      const cached = synonymCache.get(lemma);
      if (cached) return cached;
      const result = new Set<string>();
      for (const synsetIndex of synsetsOfWord.get(lemma) ?? []) {
        for (const wordIndex of table.synsets[synsetIndex]) result.add(table.words[wordIndex]);
      }
      result.delete(lemma);
      const sorted = [...result].sort();
      synonymCache.set(lemma, sorted);
      return sorted;
    },
  };
}

/** Loads the bundled Open English WordNet table as a separate chunk on first use. */
export async function loadWordNetSource(): Promise<LexicalSource> {
  const module = await import('../../../assets/wordnet/oewn-2025-synonyms.json');
  return createWordNetSource((module.default ?? module) as SynonymTable);
}
