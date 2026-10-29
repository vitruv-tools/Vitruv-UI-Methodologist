#!/usr/bin/env node
/**
 * Provides the metamodels of the semantic overlap benchmark that are not stored in the repository.
 *
 * - Without options: downloads the model exchange metamodels (Kessentini et al. 2014) from the Web
 *   Archive copy of the ModelCVS matching framework.
 * - With `--brake <path>`: copies the Brake Specification Model (`brakesystem.ecore`, from a local
 *   checkout of the brake case study) into `brake-bom/`, git-ignored and never committed. The
 *   ModelCVS download is skipped.
 *
 * Usage: node scripts/fetch-overlap-benchmark.mjs [target-dir]
 *        node scripts/fetch-overlap-benchmark.mjs --brake <path-to-brakesystem.ecore>
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_DIR = 'src/__tests__/fixtures/semanticOverlap/benchmark/metamodels';
const BRAKE_TARGET = 'src/__tests__/fixtures/semanticOverlap/benchmark/brake-bom/brakesystem.ecore';
const FILES = [
  ['20160415160954', 'Ecore.ecore'],
  ['20160415160618', 'UML_2.0_CD.ecore'],
  ['20160415161022', 'UML_1.4.2_CD.ecore'],
  ['20160415161027', 'er_ODM.ecore'],
  ['20160414043239', 'webml.ecore'],
];

const args = process.argv.slice(2);
const brakeIndex = args.indexOf('--brake');

if (brakeIndex >= 0) {
  const source = args[brakeIndex + 1];
  if (!source) throw new Error('--brake needs the path to brakesystem.ecore');
  const text = readFileSync(source, 'utf8');
  if (!text.includes('ecore:EPackage') || !/<ecore:EPackage[^>]*\sname="brakesystem"/.test(text)) {
    throw new Error(`${source}: not the brakesystem ecore (root package "brakesystem" expected)`);
  }
  mkdirSync(path.dirname(BRAKE_TARGET), { recursive: true });
  copyFileSync(source, BRAKE_TARGET);
  console.log(`brakesystem.ecore (${text.length} bytes) -> ${BRAKE_TARGET}`);
} else {
  const targetDir = args[0] ?? DEFAULT_DIR;
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
}
