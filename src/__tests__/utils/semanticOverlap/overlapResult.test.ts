import { createWordNetSource } from '../../../utils/semanticOverlap/lexical/wordNetSource';
import { OverlapResultFormatError, overlapResultToCsv, parseOverlapResult, serializeOverlapResult } from '../../../utils/semanticOverlap/overlapResult';
import { runOverlapAnalysis } from '../../../utils/semanticOverlap/runOverlapAnalysis';
import { improvedApproach } from '../../../utils/semanticOverlap/approaches/improvedApproach';
import { resolveSettings } from '../../../utils/semanticOverlap/settings';
import table from '../../../assets/wordnet/oewn-2025-synonyms.json';
import { ecoreExcerpt, umlExcerpt } from './fixtures';

const result = runOverlapAnalysis(
  { source: ecoreExcerpt(), target: umlExcerpt(), settings: resolveSettings({ seed: 3 }, 'fast') },
  { lexical: createWordNetSource(table), now: () => 0, createId: () => 'r' },
);

describe('overlap result format', () => {
  it('round-trips through JSON unchanged (SC-008)', () => {
    expect(parseOverlapResult(serializeOverlapResult(result))).toEqual(result);
  });

  it.each([
    ['not JSON', () => '{'],
    ['another schema version', () => JSON.stringify({ ...result, schemaVersion: 2 })],
    ['a missing source', () => JSON.stringify({ ...result, source: undefined })],
    ['a non-uint32 seed', () => JSON.stringify({ ...result, settings: { ...result.settings, seed: -3 } })],
    ['a score out of range', () => JSON.stringify({ ...result, correspondences: [{ ...result.correspondences[0], score: 1.5 }] })],
    ['a correspondence without targets', () => JSON.stringify({ ...result, correspondences: [{ ...result.correspondences[0], targets: [] }] })],
  ])('rejects %s', (_label, make) => {
    expect(() => parseOverlapResult(make())).toThrow(OverlapResultFormatError);
  });
});

describe('overlapResultToCsv', () => {
  const lines = overlapResultToCsv(result).split('\n').filter(Boolean);
  const comments = lines.filter(l => l.startsWith('#'));
  const header = lines.find(l => !l.startsWith('#'))!;
  const rows = lines.slice(lines.indexOf(header) + 1);

  it('starts with metadata comments and the column header', () => {
    expect(comments).toEqual([
      '# Semantic overlap: Ecore excerpt (1.0) -> UML excerpt (1.0)',
      '# approach: Kessentini et al. 2014 (paper)',
      '# seed: 3',
      `# created: ${result.createdAt}`,
    ]);
    // CSV gains kind/role columns for class ↔ instance correspondences.
    expect(header).toBe('level,parent,sources,targets,score,structural,syntactic,kind,role');
  });

  it('has one row per class correspondence and one per feature correspondence', () => {
    const childCount = result.correspondences.reduce((n, c) => n + (c.children?.length ?? 0), 0);
    expect(rows).toHaveLength(result.correspondences.length + childCount);
    const first = result.correspondences[0];
    expect(rows[0]).toBe([
      'class', '', first.sources.map(s => s.qualifiedName).join('; '), first.targets.map(t => t.qualifiedName).join('; '),
      first.score.toFixed(3), first.scores.structural.toFixed(3), first.scores.syntactic.toFixed(3), 'same', '',
    ].join(','));
    expect(rows.filter(r => r.startsWith('feature,')).every(r => r.split(',')[1].startsWith('c-'))).toBe(true);
  });

  it('joins grouped elements with "; " and quotes fields with separators', () => {
    expect(rows.some(r => r.includes('ecore.EAttribute; ecore.EReference'))).toBe(true);
    const first = result.correspondences[0];
    const tricky = {
      ...result,
      correspondences: [{ ...first, children: [], sources: [{ ...first.sources[0], qualifiedName: 'p.A,"B"' }] }],
    };
    expect(overlapResultToCsv(tricky)).toContain('class,,"p.A,""B""",');
  });
});

describe('approach and correspondence kinds', () => {
  const first = result.correspondences[0];
  const feature = { ...first, id: 'c-1-f-1', level: 'feature' as const, children: undefined };
  const instanceTarget = { ...first.targets[0], kind: 'class' as const };
  const withCorrespondences = (correspondences: unknown[], extra: object = {}) =>
    JSON.stringify({ ...result, ...extra, correspondences });
  const pattern = {
    side: 'target', item: 'bom.Item', type: 'bom.ItemType', definition: 'bom.ParameterDefinition',
    value: 'bom.ParameterValue', container: 'bom.BOM', definitionsByCategory: { number: 'bom.NumberParameterDefinition' },
    valuesByCategory: { number: 'bom.NumberParameterValue' }, counterpart: null, confidence: 1,
  };

  it('reads results without the new optional fields', () => {
    expect(parseOverlapResult(serializeOverlapResult(result)).approach).toBeUndefined();
  });

  it('accepts an approach label, including unknown approach ids', () => {
    expect(parseOverlapResult(JSON.stringify({ ...result, approach: { id: 'improved', version: '0.1' } })).approach)
      .toEqual({ id: 'improved', version: '0.1' });
    expect(() => parseOverlapResult(JSON.stringify({ ...result, approach: { id: 'future', version: '9' } }))).not.toThrow();
  });

  it('accepts instance correspondences with a matching role and level', () => {
    const typed = { ...first, kind: 'instance', instance: { side: 'target', role: 'type' }, fixed: true,
      children: [{ ...feature, targets: [instanceTarget], kind: 'instance', instance: { side: 'target', role: 'definition' } }] };
    const parsed = parseOverlapResult(withCorrespondences([typed], {
      summary: { ...result.summary, kindCounts: { same: 0, instance: 1 } }, typeObjectPatterns: [pattern],
    }));
    expect(parsed.correspondences[0].kind).toBe('instance');
    expect(parsed.typeObjectPatterns).toHaveLength(1);
  });

  it.each([
    ['an approach without version', () => JSON.stringify({ ...result, approach: { id: 'improved' } })],
    ['an unknown kind', () => withCorrespondences([{ ...first, kind: 'similar' }])],
    ['an instance kind without instance data', () => withCorrespondences([{ ...first, kind: 'instance' }])],
    ['an unknown instance side', () => withCorrespondences([{ ...first, kind: 'instance', instance: { side: 'left', role: 'type' } }])],
    ['an unknown instance role', () => withCorrespondences([{ ...first, kind: 'instance', instance: { side: 'target', role: 'kind' } }])],
    ['a definition role on class level', () => withCorrespondences([{ ...first, kind: 'instance', instance: { side: 'target', role: 'definition' } }])],
    ['a type role on feature level', () => withCorrespondences([{ ...first, children: [{ ...feature, kind: 'instance', instance: { side: 'target', role: 'type' } }] }])],
    ['negative kind counts', () => JSON.stringify({ ...result, summary: { ...result.summary, kindCounts: { same: -1, instance: 0 } } })],
    ['fractional kind counts', () => JSON.stringify({ ...result, summary: { ...result.summary, kindCounts: { same: 0.5, instance: 0 } } })],
    ['a pattern without qualified names', () => JSON.stringify({ ...result, typeObjectPatterns: [{ ...pattern, item: 3 }] })],
    ['patterns that are not a list', () => JSON.stringify({ ...result, typeObjectPatterns: pattern })],
  ])('rejects %s', (_label, make) => {
    expect(() => parseOverlapResult(make())).toThrow(OverlapResultFormatError);
  });

  it('writes kind, role and the approach label to the CSV', () => {
    const typed = { ...first, kind: 'instance' as const, instance: { side: 'target' as const, role: 'type' as const }, children: [] };
    const csv = overlapResultToCsv({ ...result, approach: { id: 'improved', version: '0.2' }, correspondences: [typed] });
    expect(csv).toContain('# approach: Improved 0.2\n');
    expect(csv.split('\n').find(line => line.startsWith('class,'))).toMatch(/,instance,type$/);
  });
});

describe('kinds and fields of the improved approach 0.3', () => {
  const first = result.correspondences[0];
  const ref = (side: 'source' | 'target', qualifiedName: string, extra: object = {}) =>
    ({ side, kind: 'class' as const, qualifiedName, name: qualifiedName.split('.').pop()!, ...extra });
  const pathChild = {
    ...first, id: 'c-1-f-1', level: 'feature', kind: 'path', children: undefined,
    sources: [ref('source', 'tree.Tree.parent', { kind: 'reference', containingClass: 'tree.Tree' })],
    targets: [ref('target', 'graph.Node.incoming.source', { kind: 'reference', containingClass: 'graph.Node', name: 'incoming.source', path: ['incoming', 'source'] })],
  };
  const split = { ...first, kind: 'split', sources: [ref('source', 'a.A')], targets: [ref('target', 'b.X'), ref('target', 'b.Y')], children: [pathChild] };
  const merge = { ...first, id: 'c-2', kind: 'merge', sources: [ref('source', 'a.A'), ref('source', 'a.B')], targets: [ref('target', 'b.X')], children: [] };
  const conditional = {
    ...first, id: 'c-3', kind: 'conditional', fixed: true, sources: [ref('source', 'a.Brake')], targets: [ref('target', 'b.DiscBrake')],
    condition: { attribute: 'a.Brake.kind', value: 'DISC' }, children: [],
  };
  const repair = {
    rule: 'opposite', reason: 'X.owner and X.parts are opposites, but their counterparts are not',
    removed: { level: 'feature', sources: ['a.X.owner'], targets: ['b.Y.items'], score: 0.27 },
    kept: { level: 'feature', sources: ['a.X.parts'], targets: ['b.Y.items'], score: 0.55 },
  };
  const coverage = { source: { classes: 1, features: 0.5 }, target: { classes: 0.25, features: 0 } };
  const extended = {
    ...result,
    approach: { id: 'improved', version: '0.3' },
    correspondences: [split, merge, conditional],
    summary: { ...result.summary, kindCounts: { split: 1, merge: 1, conditional: 1, path: 1 }, coverage },
    repairs: [repair],
    embeddingModel: { id: 'minilm', revision: 'r1', sha256: 'abc' },
    embeddingBaseline: { class: 0.18, feature: 0.16 },
    acceptanceThreshold: { value: 0.31, source: 'calibrated', note: 'calibrated on the benchmark suite (improved 0.3)' },
  };
  const alternative = (label: string, isDefault: boolean, correspondences: unknown[]) => ({
    label, isDefault, objectives: { lexical: 0.5, structural: 0.4 }, correspondences,
    unmatched: result.unmatched, summary: { matchedSourceClasses: 1, matchedTargetClasses: 1, overlapPercent: 50 },
  });
  const withAlternatives = {
    ...extended,
    alternatives: [alternative('lexical', false, [merge]), alternative('balanced', true, extended.correspondences), alternative('structural', false, [])],
  };

  it('round-trips path, split, merge and conditional correspondences with repairs, coverage and threshold', () => {
    const json = JSON.stringify(extended);
    expect(parseOverlapResult(json)).toEqual(JSON.parse(json));
  });

  it('round-trips alternatives whose default equals the main fields', () => {
    const json = JSON.stringify(withAlternatives);
    expect(parseOverlapResult(json).alternatives).toHaveLength(3);
  });

  it('names the current improved version on new results', () => {
    expect(improvedApproach.version).toBe('0.3');
  });

  it('still reads a 0.2-era export with only same and instance kinds', () => {
    const old = { ...result, approach: { id: 'improved', version: '0.2' }, summary: { ...result.summary, kindCounts: { same: 2, instance: 1 } } };
    const parsed = parseOverlapResult(JSON.stringify(old));
    expect(parsed.approach).toEqual({ id: 'improved', version: '0.2' });
    expect(parsed.repairs).toBeUndefined();
    expect(parsed.alternatives).toBeUndefined();
  });

  const replace = (patch: object) => () => JSON.stringify({ ...extended, ...patch });
  const withFirst = (patch: object) => replace({ correspondences: [{ ...split, ...patch }] });
  it.each([
    ['a path on class level', withFirst({ kind: 'path' })],
    ['a path child without a path element', withFirst({ children: [{ ...pathChild, targets: [ref('target', 'graph.Node.name')] }] })],
    ['a path of length one', withFirst({ children: [{ ...pathChild, targets: [{ ...pathChild.targets[0], path: ['incoming'] }] }] })],
    ['a path whose name does not end with it', withFirst({ children: [{ ...pathChild, targets: [{ ...pathChild.targets[0], qualifiedName: 'graph.Node.x' }] }] })],
    ['a split with one target', withFirst({ targets: [ref('target', 'b.X')] })],
    ['a merge with one source', replace({ correspondences: [{ ...merge, sources: [ref('source', 'a.A')] }] })],
    ['a conditional without condition', replace({ correspondences: [{ ...conditional, condition: undefined }] })],
    ['a conditional with an empty value', replace({ correspondences: [{ ...conditional, condition: { attribute: 'a.Brake.kind', value: '' } }] })],
    ['a conditional with two targets', replace({ correspondences: [{ ...conditional, targets: [ref('target', 'b.X'), ref('target', 'b.Y')] }] })],
    ['an unknown kind count', replace({ summary: { ...extended.summary, kindCounts: { similar: 1 } } })],
    ['a coverage above 1', replace({ summary: { ...extended.summary, coverage: { ...coverage, source: { classes: 1.5, features: 0 } } } })],
    ['a repair with an unknown rule', replace({ repairs: [{ ...repair, rule: 'naming' }] })],
    ['a repair without kept side', replace({ repairs: [{ ...repair, kept: undefined }] })],
    ['an embedding model without revision', replace({ embeddingModel: { id: 'minilm', sha256: 'abc' } })],
    ['a threshold with an unknown source', replace({ acceptanceThreshold: { value: 0.3, source: 'guess' } })],
    ['no default alternative', () => JSON.stringify({ ...withAlternatives, alternatives: withAlternatives.alternatives.map(a => ({ ...a, isDefault: false })) })],
    ['four alternatives', () => JSON.stringify({ ...withAlternatives, alternatives: [...withAlternatives.alternatives, withAlternatives.alternatives[0]] })],
  ])('rejects %s', (_label, make) => {
    expect(() => parseOverlapResult(make())).toThrow(OverlapResultFormatError);
  });

  it('rejects alternatives whose default differs from the main fields', () => {
    const inconsistent = { ...withAlternatives, correspondences: [merge] };
    expect(() => parseOverlapResult(JSON.stringify(inconsistent))).toThrow('alternatives are inconsistent');
  });

  it('writes the condition as role, and repairs, threshold and alternative as comments', () => {
    const typed = extended as unknown as Parameters<typeof overlapResultToCsv>[0];
    const csv = overlapResultToCsv(typed);
    expect(csv).toContain('# acceptance threshold: 0.31 (calibrated)\n');
    expect(csv).toContain('# repair: opposite: removed a.X.owner -> b.Y.items (0.270)\n');
    expect(csv).toContain('level,parent,sources,targets,score,structural,syntactic,kind,role\n');
    expect(csv.split('\n').find(line => line.includes(',conditional,'))).toMatch(/,conditional,a\.Brake\.kind=DISC$/);
    expect(csv).toMatch(/feature,c-1,tree\.Tree\.parent,graph\.Node\.incoming\.source,.*,path,$/m);
    const shown = overlapResultToCsv(withAlternatives as unknown as Parameters<typeof overlapResultToCsv>[0], { alternative: 0 });
    expect(shown).toContain('# alternative: lexical (selected)\n');
    expect(shown.split('\n').filter(line => line.startsWith('class,'))).toHaveLength(1);
    expect(overlapResultToCsv(withAlternatives as unknown as Parameters<typeof overlapResultToCsv>[0], { alternative: 1 }))
      .toContain('# alternative: balanced (default)\n');
  });
});
