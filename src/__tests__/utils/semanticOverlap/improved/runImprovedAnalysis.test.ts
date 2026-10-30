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
import { correspondenceKeys, loadScenario, pairKeys } from '../benchmark/suite';

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

describe('improved analysis with the structure-based improvements of 0.3', () => {
  const withParams = (improvements: ImprovementId[], params: Record<string, unknown> = {}) => runImprovedAnalysis({
    source: ecoreExcerpt(), target: umlExcerpt(),
    settings: resolveImprovedSettings({ seed: 1, improvements: improvementsOf(improvements), params: params as never }, 'fast'),
  }, deps);

  it('adds the data-structure measure as a scored, listed class measure', () => {
    const result = withParams(['structure-types']);
    expect(result.engine.measures.map(m => m.id)).toContain('structure-types');
    expect(result.classMatrix.perMeasure?.['structure-types']).toHaveLength(9);
    expect(result.correspondences.some(c => c.scores['structure-types'] !== undefined)).toBe(true);
  });

  it('reports repairs and coverage with consistency repair on, and none without', () => {
    const result = withParams(['consistency']);
    expect(Array.isArray(result.repairs)).toBe(true);
    expect(result.summary.coverage?.source.classes).toBeGreaterThan(0);
    expect(withParams([]).repairs).toBeUndefined();
  });

  it('uses the calibrated null score and shows it with its derivation', () => {
    const result = withParams(['calibrated-null'], { calibratedNullScore: 0.9 });
    expect(result.acceptanceThreshold).toEqual({ value: 0.9, source: 'calibrated', note: 'calibrated on the benchmark suite (improved 0.3)' });
    // With τ = 0.9 hardly a pair is worth matching.
    expect(result.correspondences.length).toBeLessThan(withParams([]).correspondences.length);
    expect(result.settings.nullScore).toBe(0.25);
  });
});

describe('improved analysis with the new correspondence kinds of 0.3', () => {
  const runScenario = (id: 'tree2graph' | 'wimmer-6' | 'wimmer-2', improvements: ImprovementId[], seed = 1) => {
    const loaded = loadScenario(id)!;
    return runImprovedAnalysis({ source: loaded.source, target: loaded.target,
      settings: resolveImprovedSettings({ seed, improvements: improvementsOf(improvements) }) }, deps);
  };

  it('proposes path correspondences on Tree2Graph for features the search left unmatched', () => {
    const result = runScenario('tree2graph', ['paths']);
    const paths = result.correspondences.flatMap(c => c.children ?? []).filter(c => c.kind === 'path');
    expect(paths.length).toBeGreaterThan(0);
    const toTarget = paths.find(c => c.sources[0].qualifiedName === 'tree.Tree.parent')!;
    expect(toTarget.targets[0]).toMatchObject({ kind: 'reference', containingClass: 'graph.Node', path: [expect.any(String), expect.any(String)] });
    expect(toTarget.targets[0].qualifiedName).toBe(`graph.Node.${toTarget.targets[0].path!.join('.')}`);
    expect(result.summary.kindCounts?.path).toBe(paths.length);
    expect(runScenario('tree2graph', []).correspondences.flatMap(c => c.children ?? []).some(c => c.kind === 'path')).toBe(false);
  });

  it('finds the conditional correspondences of Wimmer 6 as in the reference', () => {
    const loaded = loadScenario('wimmer-6')!;
    const result = runScenario('wimmer-6', ['conditional']);
    const expected = [...pairKeys(loaded.reference.correspondences)].filter(key => key.includes('#conditional'));
    const found = [...correspondenceKeys(result.correspondences)].filter(key => key.includes('#conditional'));
    expect(found.sort()).toEqual(expected.sort());
    expect(result.correspondences.filter(c => c.kind === 'conditional').every(c => c.fixed && c.scores.conditional === 1)).toBe(true);
    expect(result.correspondences.some(c => c.kind !== 'conditional' && c.targets.some(t => t.name === 'ResearchStaff'))).toBe(true);
  });

  it('round-trips results with paths and conditional correspondences through the JSON export', () => {
    for (const result of [runScenario('tree2graph', ['paths']), runScenario('wimmer-6', ['conditional'])]) {
      expect(parseOverlapResult(serializeOverlapResult(result))).toEqual(JSON.parse(serializeOverlapResult(result)));
    }
  });

  it('is deterministic with every improvement on (same seed, same result)', () => {
    const all = [...IMPROVEMENT_IDS];
    const stable = (r: OverlapResult) => ({ ...r, durationMs: 0 });
    expect(stable(runScenario('tree2graph', all, 3))).toEqual(stable(runScenario('tree2graph', all, 3)));
  });
});

describe('improved analysis with alternative results', () => {
  const run3 = (seed: number) => runImprovedAnalysis({ source: ecoreExcerpt(), target: umlExcerpt(),
    settings: resolveImprovedSettings({ seed, improvements: improvementsOf(['alternatives']) }, 'fast') }, deps);

  it('returns 1–3 labelled alternatives, the balanced one as default and in the main fields', () => {
    const result = run3(4);
    const alternatives = result.alternatives!;
    expect(alternatives.length).toBeGreaterThanOrEqual(1);
    expect(alternatives.length).toBeLessThanOrEqual(3);
    const defaults = alternatives.filter(a => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].label).toContain('balanced');
    expect(result.correspondences).toBe(defaults[0].correspondences);
    expect(result.unmatched).toBe(defaults[0].unmatched);
    expect(parseOverlapResult(serializeOverlapResult(result)).alternatives).toHaveLength(alternatives.length);
  });

  it('is deterministic for a seed', () => {
    const stable = (r: OverlapResult) => ({ ...r, durationMs: 0 });
    expect(stable(run3(4))).toEqual(stable(run3(4)));
  });
});
