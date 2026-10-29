import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Correspondence, ElementRef, OverlapResult } from '../../../../utils/semanticOverlap/types';
import { sampleResult } from '../../../components/semanticOverlap/sampleResult';
import {
  BENCHMARK_DIR, FIXTURES_DIR, evaluate, loadScenario, pairKeys, readReference, reverseScenario, scenarios, splitByLevel,
  type Reference,
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

  it('lists the four scenarios with their origin', () => {
    expect(scenarios().map(s => [s.id, s.origin])).toEqual([
      ['fig1', 'committed'], ['ecore-uml20', 'downloaded'], ['brake-bom', 'local'], ['bom-brake', 'local'],
    ]);
    const fig1 = loadScenario('fig1')!;
    expect(fig1.reference.correspondences).toHaveLength(2);
    expect(fig1.reference.features).toHaveLength(4);
  });
});
