import { effectiveMaxTargets, labelGroups, related } from '../../../../../utils/semanticOverlap/improved/grouping/splitMerge';
import { createMatchingProblem } from '../../../../../utils/semanticOverlap/improved/matchingProblem';
import { improvementsOf, resolveImprovedSettings } from '../../../../../utils/semanticOverlap/improved/settings';
import { cls, corr, graph } from '../graphBuilders';

const source = graph([cls('a', 'Person'), cls('a', 'Address'), cls('a', 'Named'), cls('a', 'Customer', { superTypes: ['a.Named'] }),
  cls('a', 'Supplier', { superTypes: ['a.Named'] })], 'a');
const target = graph([cls('b', 'Contact'), cls('b', 'Element'), cls('b', 'Attr', { superTypes: ['b.Element'] }),
  cls('b', 'Ref', { superTypes: ['b.Element'] }), cls('b', 'Street')], 'b', 2);

describe('class split and merge', () => {
  it('relates classes in one hierarchy: supertype or shared supertype', () => {
    expect(related(source, 'a.Customer', 'a.Named')).toBe(true);
    expect(related(source, 'a.Customer', 'a.Supplier')).toBe(true);
    expect(related(source, 'a.Person', 'a.Address')).toBe(false);
  });

  it('labels an unrelated 1:n group as split and an n:1 group as merge', () => {
    const warnings: string[] = [];
    const labelled = labelGroups([
      corr('c-1', ['a.Person'], ['b.Contact', 'b.Street'], 0.5),
      corr('c-2', ['a.Person', 'a.Address'], ['b.Contact'], 0.5),
    ], source, target, warnings);
    expect(labelled.map(c => c.kind)).toEqual(['split', 'merge']);
    expect(warnings).toEqual([]);
  });

  it('keeps related groups same-concept (EAttribute, EReference → Property)', () => {
    const labelled = labelGroups([corr('c-1', ['a.Customer', 'a.Supplier'], ['b.Contact'], 0.5), corr('c-2', ['a.Person'], ['b.Attr', 'b.Ref'], 0.5)],
      source, target, []);
    expect(labelled.map(c => c.kind)).toEqual([undefined, undefined]);
  });

  it('keeps an n:m group with unrelated classes on both sides same-concept, with a warning', () => {
    const warnings: string[] = [];
    const [group] = labelGroups([corr('c-1', ['a.Person', 'a.Address'], ['b.Contact', 'b.Street'], 0.5)], source, target, warnings);
    expect(group.kind).toBeUndefined();
    expect(warnings).toEqual([expect.stringContaining('unrelated classes on both sides')]);
  });

  it('raises the targets per class to splitMaxParts only while the improvement is on', () => {
    expect(effectiveMaxTargets(2, 3)).toBe(3);
    expect(effectiveMaxTargets(4, 3)).toBe(4);
    expect(effectiveMaxTargets(2, null)).toBe(2);
    const matrices = { n: 1, m: 5, perMeasure: {}, structural: new Float32Array(5), syntactic: new Float32Array(5), combined: new Float32Array(5) };
    const profiles = (count: number) => Array.from({ length: count }, () => ({ metrics: [] })) as never;
    const on = resolveImprovedSettings({ improvements: improvementsOf(['split-merge']) });
    const off = resolveImprovedSettings({ improvements: improvementsOf([]) });
    expect(createMatchingProblem('class', profiles(1), profiles(5), matrices, { get: () => { throw new Error(); }, has: () => false } as never, on).maxTargets).toBe(3);
    expect(createMatchingProblem('class', profiles(1), profiles(5), matrices, { has: () => false } as never, off).maxTargets).toBe(2);
    expect(createMatchingProblem('feature', profiles(1), profiles(5), matrices, { has: () => false } as never, on).maxTargets).toBe(2);
  });
});
