import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Correspondence, ElementRef, OverlapResult } from '../../../../utils/semanticOverlap/types';
import { sampleResult } from '../../../components/semanticOverlap/sampleResult';
import {
  BENCHMARK_DIR, FAMILY_IDS, FIXTURES_DIR, evaluate, familyMeans, loadScenario, pairKeys, readReference, reverseScenario, scenarios,
  splitByLevel, type Reference,
} from './suite';

const ref = (qualifiedName: string, side: 'source' | 'target', kind: ElementRef['kind'] = 'class'): ElementRef =>
  ({ side, kind, qualifiedName, name: qualifiedName.split('.').pop()! });
const correspondence = (sources: string[], targets: string[], extra: Partial<Correspondence> = {}): Correspondence => ({
  id: 'c', level: 'class', score: 1, scores: { structural: 1, syntactic: 1 },
  sources: sources.map(s => ref(s, 'source')), targets: targets.map(t => ref(t, 'target')), ...extra,
});
const resultWith = (correspondences: Correspondence[]): OverlapResult => ({ ...sampleResult(), correspondences });

describe('benchmark suite', () => {
  it('reads v1 references with a list of uncertain notes', () => {
    const v1 = readReference(readFileSync(path.join(BENCHMARK_DIR, 'ecore-uml20.expected.json'), 'utf8'));
    expect(v1.correspondences.length).toBeGreaterThan(10);
    expect(v1.correspondences.every(e => e.uncertain === undefined)).toBe(true);
    const fig1 = readReference(readFileSync(path.join(FIXTURES_DIR, 'fig1-expected.json'), 'utf8'));
    expect(fig1.correspondences).toHaveLength(6);
  });

  it('reads v2 references with kinds, roles and uncertain flags', () => {
    const v2 = readReference(readFileSync(path.join(BENCHMARK_DIR, 'brake-bom/brake-bom.expected.json'), 'utf8'));
    expect(v2.correspondences).toHaveLength(7);
    expect(v2.correspondences.filter(e => e.kind === 'instance' && e.role === 'type')).toHaveLength(5);
    expect(v2.features?.filter(e => e.role === 'definition')).toHaveLength(24);
    expect(v2.features?.filter(e => e.role === 'value')).toHaveLength(24);
    expect(v2.features?.filter(e => e.uncertain)).toHaveLength(1);
  });

  it('reverses a scenario: swaps sides and flips the instantiated side', () => {
    const reference: Reference = {
      correspondences: [{ sources: ['a.X'], targets: ['b.T'], kind: 'instance', instanceSide: 'target', role: 'type' }],
      features: [{ sources: ['a.X.f'], targets: ['b.D'], kind: 'instance', instanceSide: 'target', role: 'definition' }],
    };
    expect(reverseScenario(reference)).toEqual({
      correspondences: [{ sources: ['b.T'], targets: ['a.X'], kind: 'instance', instanceSide: 'source', role: 'type' }],
      features: [{ sources: ['b.D'], targets: ['a.X.f'], kind: 'instance', instanceSide: 'source', role: 'definition' }],
    });
  });

  it('builds kind-aware keys and expands groups', () => {
    expect([...pairKeys([
      { sources: ['a.A', 'a.B'], targets: ['b.P'] },
      { sources: ['a.X'], targets: ['b.T'], kind: 'instance', role: 'type' },
    ])]).toEqual(['a.A -> b.P #same', 'a.B -> b.P #same', 'a.X -> b.T #instance/type']);
  });

  it('scores class and feature level and counts a wrong kind as wrong', () => {
    const reference: Reference = {
      correspondences: [{ sources: ['a.A'], targets: ['b.A'] }, { sources: ['a.X'], targets: ['b.T'], kind: 'instance', role: 'type' }],
      features: [{ sources: ['a.A.f'], targets: ['b.A.f'] }],
    };
    const result = resultWith([
      correspondence(['a.A'], ['b.A'], {
        children: [{ ...correspondence(['a.A.f'], ['b.A.f']), level: 'feature' }],
      }),
      correspondence(['a.X'], ['b.T']),
    ]);
    const scores = evaluate(result, reference);
    expect(scores.class).toEqual({ precision: 0.5, recall: 0.5, fMeasure: 0.5 });
    expect(scores.feature).toEqual({ precision: 1, recall: 1, fMeasure: 1 });
  });

  it('gives zeros instead of NaN for empty sets', () => {
    expect(evaluate(resultWith([]), { correspondences: [] }).class).toEqual({ precision: 0, recall: 0, fMeasure: 0 });
  });

  it('splits mixed references into class and feature level', () => {
    const split = splitByLevel({
      correspondences: [{ sources: ['a.A'], targets: ['b.A'] }, { sources: ['a.A.f'], targets: ['b.A.g'] }],
    }, new Set(['a.A', 'b.A']));
    expect(split.correspondences).toHaveLength(1);
    expect(split.features).toEqual([{ sources: ['a.A.f'], targets: ['b.A.g'] }]);
  });

  it('lists the 17 scenarios in 5 families with their origin', () => {
    expect(scenarios().map(s => [s.id, s.family, s.origin])).toEqual([
      ['fig1', 'fig1', 'committed'], ['ecore-uml20', 'model-exchange', 'downloaded'],
      ['brake-bom', 'brake-bom', 'local'], ['bom-brake', 'brake-bom', 'local'],
      ['uml14-uml20', 'model-exchange', 'downloaded'], ['ecore-uml14', 'model-exchange', 'downloaded'],
      ['er-uml20', 'model-exchange', 'downloaded'], ['webml-uml20', 'model-exchange', 'downloaded'],
      ['er-ecore', 'model-exchange', 'downloaded'], ['webml-ecore', 'model-exchange', 'downloaded'],
      ...[1, 2, 3, 4, 5, 6].map(k => [`wimmer-${k}`, 'wimmer', 'committed']),
      ['tree2graph', 'tree2graph', 'committed'],
    ]);
    expect(new Set(scenarios().map(s => s.family))).toEqual(new Set(FAMILY_IDS));
    const fig1 = loadScenario('fig1')!;
    expect(fig1.reference.correspondences).toHaveLength(2);
    expect(fig1.reference.features).toHaveLength(4);
  });

  it('averages within families, then over the available families', () => {
    const f = (fMeasure: number) => ({ precision: fMeasure, recall: fMeasure, fMeasure });
    const { perFamily, average } = familyMeans({ fig1: f(1), 'wimmer-1': f(0.2), 'wimmer-2': f(0.4), tree2graph: f(0) });
    expect(perFamily.wimmer?.fMeasure).toBeCloseTo(0.3);
    // model-exchange and brake-bom are missing (skipped) and do not count.
    expect(perFamily['model-exchange']).toBeUndefined();
    expect(average.fMeasure).toBeCloseTo((1 + 0.3 + 0) / 3);
  });

  it('builds keys for path, split, merge and conditional entries', () => {
    expect([...pairKeys([
      { sources: ['t.Tree.parent'], targets: ['g.Node.incoming.source'], kind: 'path' },
      { sources: ['a.A'], targets: ['b.X', 'b.Y'], kind: 'split' },
      { sources: ['a.A', 'a.B'], targets: ['b.Z'], kind: 'merge' },
      { sources: ['a.R'], targets: ['b.P'], kind: 'conditional', condition: { attribute: 'a.R.kind', value: 'Professor' } },
    ])]).toEqual([
      't.Tree.parent -> g.Node.incoming.source #path',
      'a.A -> b.X #split', 'a.A -> b.Y #split',
      'a.A -> b.Z #merge', 'a.B -> b.Z #merge',
      'a.R -> b.P #conditional/a.R.kind=Professor',
    ]);
    const conditional = correspondence(['a.R'], ['b.P'], { kind: 'conditional', condition: { attribute: 'a.R.kind', value: 'Professor' } });
    const reference: Reference = { correspondences: [{ sources: ['a.R'], targets: ['b.P'], kind: 'conditional', condition: { attribute: 'a.R.kind', value: 'Professor' } }] };
    expect(evaluate(resultWith([conditional]), reference).class.fMeasure).toBe(1);
    const otherValue = { ...conditional, condition: { attribute: 'a.R.kind', value: 'Assistant' } };
    expect(evaluate(resultWith([otherValue]), reference).class.fMeasure).toBe(0);
  });

  it('reads the Tree2Graph reference with its path entry', () => {
    const reference = readReference(readFileSync(path.join(BENCHMARK_DIR, 'tree2graph/tree2graph.expected.json'), 'utf8'));
    expect(reference.correspondences).toEqual([{ sources: ['tree.Tree'], targets: ['graph.Node'] }]);
    expect(reference.features?.find(e => e.kind === 'path')).toMatchObject({ sources: ['tree.Tree.parent'], targets: ['graph.Node.incoming.source'] });
  });
});
