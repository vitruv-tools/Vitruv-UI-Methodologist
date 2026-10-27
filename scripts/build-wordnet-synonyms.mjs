#!/usr/bin/env node
/**
 * Builds the compact WordNet synonym table used by the Semantic overlap view.
 *
 * Input: an extracted Open English WordNet JSON release, e.g. english-wordnet-2025-json.zip from
 * https://github.com/globalwordnet/english-wordnet/releases/tag/2025-edition
 *
 * Usage: node scripts/build-wordnet-synonyms.mjs <extracted-json-dir> [output-file]
 *
 * Only synsets with at least two single-word, purely alphabetic members are kept. The output is
 * deterministic: words are sorted, every synset lists sorted word indices, and synsets are sorted
 * and de-duplicated.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PARTS_OF_SPEECH = new Set(['n', 'v', 'a', 's', 'r']);
const WORD = /^[a-z]+$/;
const DEFAULT_OUTPUT = 'src/assets/wordnet/oewn-2025-synonyms.json';

const [inputDir, outputFile = DEFAULT_OUTPUT] = process.argv.slice(2);
if (!inputDir) {
  console.error('usage: node scripts/build-wordnet-synonyms.mjs <extracted-json-dir> [output-file]');
  process.exit(1);
}

const synsetFiles = readdirSync(inputDir)
  .filter(name => name.endsWith('.json') && !name.startsWith('entries') && !name.startsWith('frames'))
  .sort();

const memberSets = [];
for (const file of synsetFiles) {
  const synsets = JSON.parse(readFileSync(path.join(inputDir, file), 'utf8'));
  for (const synset of Object.values(synsets)) {
    if (!PARTS_OF_SPEECH.has(synset.partOfSpeech)) continue;
    const members = [...new Set((synset.members ?? []).map(m => m.toLowerCase()).filter(m => WORD.test(m)))];
    if (members.length >= 2) memberSets.push(members);
  }
}

const words = [...new Set(memberSets.flat())].sort();
const indexOf = new Map(words.map((word, index) => [word, index]));
const synsetKeys = new Set();
for (const members of memberSets) {
  synsetKeys.add(members.map(m => indexOf.get(m)).sort((a, b) => a - b).join(','));
}
const synsets = [...synsetKeys]
  .map(key => key.split(',').map(Number))
  .sort((a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return a.length - b.length;
  });

const table = {
  source: 'Open English WordNet',
  version: '2025',
  license: 'CC-BY-4.0',
  url: 'https://github.com/globalwordnet/english-wordnet',
  words,
  synsets,
};
writeFileSync(outputFile, JSON.stringify(table) + '\n');
console.log(`${synsets.length} synsets, ${words.length} words -> ${outputFile}`);
