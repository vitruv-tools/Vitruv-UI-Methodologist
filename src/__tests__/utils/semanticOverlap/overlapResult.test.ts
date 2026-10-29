import { createWordNetSource } from '../../../utils/semanticOverlap/lexical/wordNetSource';
import { OverlapResultFormatError, overlapResultToCsv, parseOverlapResult, serializeOverlapResult } from '../../../utils/semanticOverlap/overlapResult';
import { runOverlapAnalysis } from '../../../utils/semanticOverlap/runOverlapAnalysis';
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
