import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readMetamodelGraph } from '../../../utils/semanticOverlap/ecore/readMetamodelGraph';
import { createWordNetSource } from '../../../utils/semanticOverlap/lexical/wordNetSource';
import { serializeOverlapResult } from '../../../utils/semanticOverlap/overlapResult';
import { runOverlapAnalysis } from '../../../utils/semanticOverlap/runOverlapAnalysis';
import { resolveSettings } from '../../../utils/semanticOverlap/settings';
import type { MetamodelGraph, OverlapResult } from '../../../utils/semanticOverlap/types';
import table from '../../../assets/wordnet/oewn-2025-synonyms.json';
import { ecoreExcerpt, refFor, umlExcerpt } from './fixtures';

/**
 * Golden results of the paper approach (Kessentini et al. 2014 plus the documented extensions),
 * recorded once before the improved approach was added. They guarantee that the paper approach
 * never changes. Record (only ever once): UPDATE_PAPER_GOLDEN=1 npx vitest run <this file>.
 * Scenarios whose metamodels may not be published are stored as SHA-256 hashes only.
 */
const FIXTURES = path.resolve(__dirname, '../../fixtures/semanticOverlap');
const GOLDEN_DIR = path.join(FIXTURES, 'paper-golden');
const BRAKE_FILE = path.join(FIXTURES, 'benchmark/brake-bom/brakesystem.ecore');
const BOM_FILE = path.join(FIXTURES, 'benchmark/brake-bom/bom.ecore');
const METAMODEL_DIR = path.join(FIXTURES, 'benchmark/metamodels');
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const RECORD = process.env.UPDATE_PAPER_GOLDEN === '1';

const deps = { lexical: createWordNetSource(table), now: () => 1_700_000_000_000, createId: () => 'golden' };
const run = (source: MetamodelGraph, target: MetamodelGraph, seed: number): OverlapResult =>
  ({ ...runOverlapAnalysis({ source, target, settings: resolveSettings({ seed }) }, deps), durationMs: 0 });
const sha256 = (result: OverlapResult) => createHash('sha256').update(serializeOverlapResult(result)).digest('hex');
const load = (file: string, id: number) => readMetamodelGraph(readFileSync(file, 'utf8'), refFor(path.basename(file), id));

function writeJson(file: string, value: unknown) {
  mkdirSync(GOLDEN_DIR, { recursive: true });
  writeFileSync(path.join(GOLDEN_DIR, file), `${JSON.stringify(value, null, 2)}\n`);
}
const readJson = (file: string) => JSON.parse(readFileSync(path.join(GOLDEN_DIR, file), 'utf8'));

function checkHashes(file: string, source: () => MetamodelGraph, target: () => MetamodelGraph) {
  const [s, t] = [source(), target()];
  const hashes = Object.fromEntries(SEEDS.map(seed => [String(seed), sha256(run(s, t, seed))]));
  if (RECORD) writeJson(file, hashes);
  else expect(hashes).toEqual(readJson(file));
}

describe('paper approach golden results', () => {
  it.each(SEEDS)('Fig. 1 excerpt, seed %i', seed => {
    const result = run(ecoreExcerpt(), umlExcerpt(), seed);
    const file = `fig1.seed-${seed}.json`;
    if (RECORD) writeJson(file, result);
    else expect(JSON.parse(JSON.stringify(result))).toEqual(readJson(file));
  });

  describe.skipIf(!existsSync(BRAKE_FILE))('Brake ↔ BOM (local brake model)', () => {
    it('Brake -> BOM', () => checkHashes('brake-bom.sha256.json', () => load(BRAKE_FILE, 1), () => load(BOM_FILE, 2)));
    it('BOM -> Brake', () => checkHashes('bom-brake.sha256.json', () => load(BOM_FILE, 1), () => load(BRAKE_FILE, 2)));
  });

  describe.skipIf(!existsSync(METAMODEL_DIR))('Ecore -> UML 2.0 (downloaded metamodels)', () => {
    it('Ecore -> UML 2.0', () => checkHashes('ecore-uml20.sha256.json',
      () => load(path.join(METAMODEL_DIR, 'Ecore.ecore'), 1),
      () => load(path.join(METAMODEL_DIR, 'UML_2.0_CD.ecore'), 2)), 300_000);
  });
});
