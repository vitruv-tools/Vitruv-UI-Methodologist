# WordNet tables

`oewn-2025-synonyms.json` and `oewn-2025-hypernyms.json` are **generated** — do not edit them by hand.

## Synonym table (both approaches)

| | |
|---|---|
| Source | [Open English WordNet](https://github.com/globalwordnet/english-wordnet), release `2025-edition`, asset `english-wordnet-2025-json.zip` |
| Licence | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) — attribution is shown in the Semantic overlap view |
| Content | 24,356 synsets / 42,916 words: all synsets (nouns, verbs, adjectives, adverbs) with at least two single-word, purely alphabetic, lower-cased members |
| Format | `{ source, version, license, url, words: string[], synsets: number[][] }` — each synset lists indices into `words` |

The Semantic overlap analysis loads this file with a dynamic `import()`, so it is a separate chunk
that the browser only fetches when an analysis runs.

## Hypernym table (improved approach)

| | |
|---|---|
| Source | Same Open English WordNet 2025 release |
| Licence | CC-BY 4.0, as above |
| Content | 46,318 single-word, purely alphabetic, lower-cased noun lemmas and the 50,375 noun synsets on their hypernym chains (1.4 MB, 0.44 MB gzip) |
| Format | `{ source, version, license, url, words: string[], senses: number[][], parents: number[][] }` — `senses[w]` lists the synsets of word `w` in OEWN sense order, `parents[s]` the hypernyms of synset `s` (instance hypernyms are left out) |

Only the improved approach uses it (Wu-Palmer similarity of name words). It is fetched as a
separate static asset, so analyses with the paper approach never download it.

## Regenerate

```bash
gh release download 2025-edition -R globalwordnet/english-wordnet -p 'english-wordnet-2025-json.zip'
unzip english-wordnet-2025-json.zip -d oewn-json
node scripts/build-wordnet-synonyms.mjs oewn-json
node scripts/build-wordnet-hypernyms.mjs oewn-json
```

Both scripts are deterministic: the same release always produces byte-identical files.
