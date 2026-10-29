import { existsSync } from 'node:fs';
import { runImprovedAnalysis } from '../../../../utils/semanticOverlap/improved/runImprovedAnalysis';
import {
  IMPROVEMENT_IDS, improvementsOf, resolveImprovedSettings, type ImprovementId,
} from '../../../../utils/semanticOverlap/improved/settings';
import { createWordNetSource } from '../../../../utils/semanticOverlap/lexical/wordNetSource';
import { parseOverlapResult, serializeOverlapResult } from '../../../../utils/semanticOverlap/overlapResult';
import type { MetamodelGraph, OverlapResult } from '../../../../utils/semanticOverlap/types';
import table from '../../../../assets/wordnet/oewn-2025-synonyms.json';
import { BOM_FILE, BRAKE_FILE, ecoreExcerpt, fig1Expected, loadEcore, umlExcerpt } from '../fixtures';
import { createHypernymSource, type HypernymTable } from '../../../../utils/semanticOverlap/improved/lexical/hypernymSource';
import hypernymTable from '../../../../assets/wordnet/oewn-2025-hypernyms.json';
import { assembly, shop } from './typeObject/typeObjectFixtures';

const deps = { lexical: createWordNetSource(table), now: () => 0, createId: () => 'r' };
const run = (source: MetamodelGraph, target: MetamodelGraph, improvements: ImprovementId[], seed = 1) =>
  runImprovedAnalysis({ source, target, settings: resolveImprovedSettings({ seed, improvements: improvementsOf(improvements) }, 'fast') }, deps);
const pairs = (result: OverlapResult) => result.correspondences.map(c =>
  `${c.sources.map(s => s.name).join()} -> ${c.targets.map(t => t.name).join()} #${c.kind ?? 'same'}${c.instance ? `/${c.instance.role}` : ''}`);

describe('improved analysis with the type-object pattern', () => {
  it('reports class ↔ instance correspondences with fixed attribute children', () => {
    const result = run(assembly(), shop(), ['type-object']);
    expect(pairs(result)).toEqual(expect.arrayContaining([
      'Assembly -> Shop #same', 'Part -> Product #same', 'Bolt -> ProductKind #instance/type', 'Nut -> ProductKind #instance/type',
    ]));
    const bolt = result.correspondences.find(c => c.sources[0].name === 'Bolt')!;
    expect(bolt).toMatchObject({ fixed: true, instance: { side: 'target', role: 'type' } });
    expect(bolt.children!.map(c => `${c.sources[0].name} -> ${c.targets[0].name} #${c.instance?.role}`)).toEqual([
      'length -> NumberFeature #definition', 'length -> NumberFeatureValue #value',
      'label -> TextFeature #definition', 'label -> TextFeatureValue #value',
    ]);
    expect(result.typeObjectPatterns?.[0]).toMatchObject({ side: 'target', item: 'shop.Product' });
    expect(result.summary.kindCounts).toEqual({ same: result.correspondences.length - 2, instance: 2 });
    // Classes in instance correspondences count as matched.
    expect(result.unmatched.source).toEqual([]);
    expect(result.correspondences.map(c => c.id)).toEqual(result.correspondences.map((_, k) => `c-${k + 1}`));
  });

  it('feature-matches the same-concept correspondences of the rule', () => {
    const result = run(assembly(), shop(), ['type-object']);
    const part = result.correspondences.find(c => c.sources[0].name === 'Part')!;
    expect(part.children?.some(c => c.sources[0].name === 'id' && c.targets[0].name === 'id')).toBe(true);
  });

  it('round-trips through the result format', () => {
    const result = run(assembly(), shop(), ['type-object']);
    expect(parseOverlapResult(serializeOverlapResult(result))).toEqual(JSON.parse(serializeOverlapResult(result)));
  });

  it('adds neither patterns nor kind counts with the improvement off', () => {
    const result = run(assembly(), shop(), []);
    expect(result.typeObjectPatterns).toBeUndefined();
    expect(result.summary.kindCounts).toBeUndefined();
    expect(result.correspondences.every(c => c.kind === undefined)).toBe(true);
  });

  describe.skipIf(!existsSync(BRAKE_FILE))('Brake -> BOM (local brake model)', () => {
    it('finds the item types and the parameter definitions', () => {
      const result = run(loadEcore(BRAKE_FILE, 1), loadEcore(BOM_FILE, 2), ['type-object']);
      expect(pairs(result)).toEqual(expect.arrayContaining([
        'Brakesystem -> BOM #same', 'BrakeComponent -> Item #same', 'BrakeDisk -> ItemType #instance/type',
      ]));
      const disk = result.correspondences.find(c => c.sources[0].name === 'BrakeDisk')!;
      expect(disk.children?.map(c => `${c.sources[0].qualifiedName} -> ${c.targets[0].qualifiedName} #${c.instance?.role}`))
        .toContain('brakesystem.BrakeDisk.diameterInMM -> bom.NumberParameterDefinition #definition');
    });
  });
});

describe('improved analysis defaults', () => {
  const withHypernyms = { ...deps, hypernyms: createHypernymSource(hypernymTable as HypernymTable) };
  const withoutVolatile = (r: OverlapResult) => ({ ...r, durationMs: 0 });

  it('is deterministic per seed with the defaults and with every improvement on', () => {
    for (const settings of [resolveImprovedSettings({ seed: 9 }, 'fast'),
      resolveImprovedSettings({ seed: 9, improvements: improvementsOf([...IMPROVEMENT_IDS]) }, 'fast')]) {
      const input = { source: ecoreExcerpt(), target: umlExcerpt(), settings };
      expect(withoutVolatile(runImprovedAnalysis(input, withHypernyms))).toEqual(withoutVolatile(runImprovedAnalysis(input, withHypernyms)));
    }
  });

  it.skipIf(!existsSync(BRAKE_FILE))('is deterministic on Brake -> BOM with every improvement on', () => {
    const input = { source: loadEcore(BRAKE_FILE, 1), target: loadEcore(BOM_FILE, 2),
      settings: resolveImprovedSettings({ seed: 9, improvements: improvementsOf([...IMPROVEMENT_IDS]) }, 'fast') };
    expect(withoutVolatile(runImprovedAnalysis(input, withHypernyms))).toEqual(withoutVolatile(runImprovedAnalysis(input, withHypernyms)));
  });

  it('finds at least 5 of the 6 Fig. 1 correspondences with the defaults', () => {
    const result = runImprovedAnalysis({ source: ecoreExcerpt(), target: umlExcerpt(), settings: resolveImprovedSettings({ seed: 42 }) }, withHypernyms);
    const key = (sources: string[], targets: string[]) => `${[...sources].sort().join(',')}->${[...targets].sort().join(',')}`;
    const all = [...result.correspondences, ...result.correspondences.flatMap(c => c.children ?? [])];
    const keys = new Set(all.map(c => key(c.sources.map(s => s.qualifiedName), c.targets.map(t => t.qualifiedName))));
    // Group entries count when one proposed correspondence covers each of their pairs.
    const pairKeys = new Set(all.flatMap(c => c.sources.flatMap(s => c.targets.map(t => key([s.qualifiedName], [t.qualifiedName])))));
    const found = fig1Expected().filter(e => keys.has(key(e.sources, e.targets))
      || e.sources.every(s => e.targets.every(t => pairKeys.has(key([s], [t])))));
    expect(found.length).toBeGreaterThanOrEqual(5);
  });
});
