#!/usr/bin/env node
/**
 * Downloads the metamodels of the semantic overlap benchmark (Kessentini et al. 2014, model
 * exchange case) from the Web Archive copy of the ModelCVS matching framework.
 *
 * Usage: node scripts/fetch-overlap-benchmark.mjs [target-dir]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_DIR = 'src/__tests__/fixtures/semanticOverlap/benchmark/metamodels';
const FILES = [
  ['20160415160954', 'Ecore.ecore'],
  ['20160415160618', 'UML_2.0_CD.ecore'],
  ['20160415161022', 'UML_1.4.2_CD.ecore'],
  ['20160415161027', 'er_ODM.ecore'],
  ['20160414043239', 'webml.ecore'],
];

const targetDir = process.argv[2] ?? DEFAULT_DIR;
mkdirSync(targetDir, { recursive: true });

for (const [timestamp, name] of FILES) {
  const url = `https://web.archive.org/web/${timestamp}id_/http://www.modelcvs.org:80/matching/ecore/${name}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const text = await response.text();
  if (!text.includes('ecore:EPackage')) throw new Error(`${name}: not an ecore file`);
  writeFileSync(path.join(targetDir, name), text);
  console.log(`${name} (${text.length} bytes)`);
}
