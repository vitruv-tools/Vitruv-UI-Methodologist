/** WordNet hypernym graph (nouns) for Wu-Palmer similarity; replaceable like the synonym source. */
export interface HypernymSource {
  readonly id: string;
  readonly version: string;
  /** True if the word is a noun lemma of the table. */
  isWord(word: string): boolean;
  /** Synset indices of a word, most frequent sense first; empty if unknown. */
  senses(word: string): readonly number[];
  /** Longest path from the synset to a root (roots have depth 1). */
  depth(synset: number): number;
  /** Wu-Palmer similarity of two words over their first `maxSenses` senses; 0 if unknown. */
  wuPalmer(a: string, b: string, maxSenses: number): number;
}

/** Shape of `src/assets/wordnet/oewn-2025-hypernyms.json` (see scripts/build-wordnet-hypernyms.mjs). */
export interface HypernymTable {
  source: string;
  version: string;
  license: string;
  url: string;
  words: string[];
  /** Per word: synset indices in sense order. */
  senses: number[][];
  /** Per synset: indices of its hypernyms. */
  parents: number[][];
}

export function createHypernymSource(table: HypernymTable): HypernymSource {
  const wordIndex = new Map(table.words.map((word, index) => [word, index]));
  const depths = new Map<number, number>();
  const ancestorCache = new Map<number, Set<number>>();
  const similarityCache = new Map<string, number>();

  const depth = (synset: number, visiting = new Set<number>()): number => {
    const known = depths.get(synset);
    if (known !== undefined) return known;
    if (visiting.has(synset)) return 1;
    visiting.add(synset);
    const parents = table.parents[synset] ?? [];
    const value = parents.length === 0 ? 1 : 1 + Math.max(...parents.map(parent => depth(parent, visiting)));
    visiting.delete(synset);
    depths.set(synset, value);
    return value;
  };

  /** The synset and all its hypernyms. */
  const ancestors = (synset: number): Set<number> => {
    const cached = ancestorCache.get(synset);
    if (cached) return cached;
    const result = new Set<number>();
    const stack = [synset];
    while (stack.length > 0) {
      const next = stack.pop()!;
      if (result.has(next)) continue;
      result.add(next);
      stack.push(...(table.parents[next] ?? []));
    }
    ancestorCache.set(synset, result);
    return result;
  };

  const senses = (word: string) => {
    const index = wordIndex.get(word);
    return index === undefined ? [] : table.senses[index];
  };

  const synsetSimilarity = (a: number, b: number) => {
    const above = ancestors(b);
    let deepest = 0;
    for (const ancestor of ancestors(a)) {
      if (above.has(ancestor)) deepest = Math.max(deepest, depth(ancestor));
    }
    return deepest === 0 ? 0 : (2 * deepest) / (depth(a) + depth(b));
  };

  return {
    id: 'oewn-hypernyms',
    version: table.version,
    isWord: word => wordIndex.has(word),
    senses,
    depth: synset => depth(synset),
    wuPalmer: (a, b, maxSenses) => {
      if (a === b) return wordIndex.has(a) ? 1 : 0;
      const key = a < b ? `${a}|${b}|${maxSenses}` : `${b}|${a}|${maxSenses}`;
      const cached = similarityCache.get(key);
      if (cached !== undefined) return cached;
      let best = 0;
      for (const sa of senses(a).slice(0, maxSenses)) {
        for (const sb of senses(b).slice(0, maxSenses)) best = Math.max(best, synsetSimilarity(sa, sb));
      }
      similarityCache.set(key, best);
      return best;
    },
  };
}

let loaded: Promise<HypernymSource> | null = null;

/**
 * Loads the bundled hypernym table on first use. It is fetched as a separate static asset, so runs
 * that do not need it (e.g. the paper approach) never download it.
 */
export function loadHypernymSource(): Promise<HypernymSource> {
  loaded ??= fetch(new URL('../../../../assets/wordnet/oewn-2025-hypernyms.json', import.meta.url))
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<HypernymTable>;
    })
    .then(createHypernymSource)
    .catch(error => {
      loaded = null;
      throw error;
    });
  return loaded;
}
