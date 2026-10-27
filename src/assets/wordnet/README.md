# WordNet synonym table

`oewn-2025-synonyms.json` is **generated** — do not edit it by hand.

| | |
|---|---|
| Source | [Open English WordNet](https://github.com/globalwordnet/english-wordnet), release `2025-edition`, asset `english-wordnet-2025-json.zip` |
| Licence | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) — attribution is shown in the Semantic overlap view |
| Content | 24,356 synsets / 42,916 words: all synsets (nouns, verbs, adjectives, adverbs) with at least two single-word, purely alphabetic, lower-cased members |
| Format | `{ source, version, license, url, words: string[], synsets: number[][] }` — each synset lists indices into `words` |

The Semantic overlap analysis loads this file with a dynamic `import()`, so it is a separate chunk
that the browser only fetches when an analysis runs.

## Regenerate

```bash
gh release download 2025-edition -R globalwordnet/english-wordnet -p 'english-wordnet-2025-json.zip'
unzip english-wordnet-2025-json.zip -d oewn-json
node scripts/build-wordnet-synonyms.mjs oewn-json
```

The script is deterministic: the same release always produces a byte-identical file.
