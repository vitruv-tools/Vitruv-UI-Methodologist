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
      '# seed: 3',
      `# created: ${result.createdAt}`,
    ]);
    expect(header).toBe('level,parent,sources,targets,score,structural,syntactic');
  });

  it('has one row per class correspondence and one per feature correspondence', () => {
    const childCount = result.correspondences.reduce((n, c) => n + (c.children?.length ?? 0), 0);
    expect(rows).toHaveLength(result.correspondences.length + childCount);
    const first = result.correspondences[0];
    expect(rows[0]).toBe([
      'class', '', first.sources.map(s => s.qualifiedName).join('; '), first.targets.map(t => t.qualifiedName).join('; '),
      first.score.toFixed(3), first.scores.structural.toFixed(3), first.scores.syntactic.toFixed(3),
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
