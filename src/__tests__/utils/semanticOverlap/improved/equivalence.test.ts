import { existsSync } from 'node:fs';
import path from 'node:path';
import { runImprovedAnalysis } from '../../../../utils/semanticOverlap/improved/runImprovedAnalysis';
import { improvementsOf, resolveImprovedSettings } from '../../../../utils/semanticOverlap/improved/settings';
import { createWordNetSource } from '../../../../utils/semanticOverlap/lexical/wordNetSource';
import { runOverlapAnalysis } from '../../../../utils/semanticOverlap/runOverlapAnalysis';
import { resolveSettings } from '../../../../utils/semanticOverlap/settings';
import type { MetamodelGraph, OverlapResult } from '../../../../utils/semanticOverlap/types';
import table from '../../../../assets/wordnet/oewn-2025-synonyms.json';
import { BOM_FILE, BRAKE_FILE, METAMODEL_DIR, ecoreExcerpt, loadEcore, umlExcerpt } from '../fixtures';

/** The improved approach with every improvement off must equal the paper approach. */
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const deps = { lexical: createWordNetSource(table), now: () => 0, createId: () => 'r' };

/** Drops what legitimately differs: the improved settings' extra fields. */
const comparable = (result: OverlapResult) => {
  const { improvements: _i, params: _p, ...settings } = result.settings as OverlapResult['settings'] & Record<string, unknown>;
  return { ...result, settings, durationMs: 0 };
};

function expectEquivalent(source: MetamodelGraph, target: MetamodelGraph, seed: number) {
  const paper = runOverlapAnalysis({ source, target, settings: resolveSettings({ seed }) }, deps);
  const improved = runImprovedAnalysis(
    { source, target, settings: resolveImprovedSettings({ seed, improvements: improvementsOf([]) }) }, deps);
  expect(comparable(improved)).toEqual(comparable(paper));
}

describe('improved approach with all improvements off', () => {
  it.each(SEEDS)('equals the paper approach on Fig. 1, seed %i', seed => expectEquivalent(ecoreExcerpt(), umlExcerpt(), seed));

  describe.skipIf(!existsSync(BRAKE_FILE))('Brake ↔ BOM (local brake model)', () => {
    it.each(SEEDS)('Brake -> BOM and BOM -> Brake, seed %i', seed => {
      const brake = loadEcore(BRAKE_FILE, 1);
      const bom = loadEcore(BOM_FILE, 2);
      expectEquivalent(brake, bom, seed);
      expectEquivalent(bom, brake, seed);
    });
  });

  describe.skipIf(!existsSync(METAMODEL_DIR))('Ecore -> UML 2.0 (downloaded metamodels)', () => {
    it('seeds 1–10', () => {
      const ecore = loadEcore(path.join(METAMODEL_DIR, 'Ecore.ecore'), 1);
      const uml = loadEcore(path.join(METAMODEL_DIR, 'UML_2.0_CD.ecore'), 2);
      SEEDS.forEach(seed => expectEquivalent(ecore, uml, seed));
    }, 300_000);
  });
});
