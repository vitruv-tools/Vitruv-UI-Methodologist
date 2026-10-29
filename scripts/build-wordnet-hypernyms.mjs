#!/usr/bin/env node
/**
 * Builds the compact WordNet hypernym table used by the improved semantic overlap approach
 * (Wu-Palmer similarity of nouns).
 *
 * Input: an extracted Open English WordNet JSON release, e.g. english-wordnet-2025-json.zip from
 * https://github.com/globalwordnet/english-wordnet/releases/tag/2025-edition
 *
 * Usage: node scripts/build-wordnet-hypernyms.mjs <extracted-json-dir> [output-file]
 *
 * Only noun synsets are used, and only single-word, purely alphabetic, lower-cased lemmas are kept.
 * `hypernym` relations become parent lists (instance hypernyms are left out); the senses of a word
 * keep the OEWN sense order of its entry. Synsets that no kept word reaches through its hypernym
 * chain are dropped. The output is deterministic: words are sorted and synsets are numbered in
 * the order of their sorted OEWN ids.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const WORD = /^[a-z]+$/;
const DEFAULT_OUTPUT = 'src/assets/wordnet/oewn-2025-hypernyms.json';

const [inputDir, outputFile = DEFAULT_OUTPUT] = process.argv.slice(2);
if (!inputDir) {
  console.error('usage: node scripts/build-wordnet-hypernyms.mjs <extracted-json-dir> [output-file]');
  process.exit(1);
}

const files = readdirSync(inputDir).filter(name => name.endsWith('.json')).sort();

// Noun synsets with their hypernyms.
const parentsById = new Map();
for (const file of files.filter(name => name.startsWith('noun.'))) {
  const synsets = JSON.parse(readFileSync(path.join(inputDir, file), 'utf8'));
  for (const [id, synset] of Object.entries(synsets)) {
    if (synset.partOfSpeech !== 'n') continue;
    parentsById.set(id, [...(synset.hypernym ?? [])]);
  }
}

// Noun senses per single-word lemma, in entry order.
const sensesByWord = new Map();
for (const file of files.filter(name => name.startsWith('entries-'))) {
  const entries = JSON.parse(readFileSync(path.join(inputDir, file), 'utf8'));
  for (const [lemma, byPos] of Object.entries(entries)) {
    const word = lemma.toLowerCase();
    if (!WORD.test(word) || !byPos.n) continue;
    const senses = sensesByWord.get(word) ?? [];
    for (const sense of byPos.n.sense ?? []) {
      if (parentsById.has(sense.synset) && !senses.includes(sense.synset)) senses.push(sense.synset);
    }
    if (senses.length > 0) sensesByWord.set(word, senses);
  }
}

// Keep only synsets on some kept word's hypernym chain.
const reachable = new Set();
const visit = id => {
  if (reachable.has(id) || !parentsById.has(id)) return;
  reachable.add(id);
  parentsById.get(id).forEach(visit);
};
for (const senses of sensesByWord.values()) senses.forEach(visit);

const synsetIds = [...reachable].sort();
const indexOf = new Map(synsetIds.map((id, index) => [id, index]));
const words = [...sensesByWord.keys()].sort();

const table = {
  source: 'Open English WordNet',
  version: '2025',
  license: 'CC-BY-4.0',
  url: 'https://github.com/globalwordnet/english-wordnet',
  words,
  senses: words.map(word => sensesByWord.get(word).map(id => indexOf.get(id))),
  parents: synsetIds.map(id => parentsById.get(id).filter(parent => indexOf.has(parent)).map(parent => indexOf.get(parent))),
};

writeFileSync(outputFile, JSON.stringify(table));
console.log(`${words.length} words, ${synsetIds.length} noun synsets -> ${outputFile}`);
