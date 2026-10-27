import { createWordNetSource, noLexicalSource } from '../../../utils/semanticOverlap/lexical/wordNetSource';
import { createDefaultMeasureRegistry } from '../../../utils/semanticOverlap/measures/registry';
import type { SimilarityMeasure } from '../../../utils/semanticOverlap/measures/types';
import { InvalidSettingsError, runOverlapAnalysis, solutionToCorrespondences } from '../../../utils/semanticOverlap/runOverlapAnalysis';
import { resolveSettings } from '../../../utils/semanticOverlap/settings';
import type { MetamodelGraph, OverlapResult } from '../../../utils/semanticOverlap/types';
import table from '../../../assets/wordnet/oewn-2025-synonyms.json';
import { ecoreExcerpt, refFor, umlExcerpt } from './fixtures';
import { diagonalProblem } from './helpers';

const wordNet = createWordNetSource(table);
const deps = { lexical: wordNet, now: () => 1_700_000_000_000, createId: () => 'result-1' };
const settings = resolveSettings({ seed: 42 });
const withoutVolatile = (r: OverlapResult) => ({ ...r, id: '', createdAt: '', durationMs: 0 });
const pairs = (r: OverlapResult) => r.correspondences.map(c => [c.sources.map(s => s.name), c.targets.map(t => t.name)]);

describe('runOverlapAnalysis', () => {
  it('is deterministic for a fixed seed (SC-007)', () => {
    const input = { source: ecoreExcerpt(), target: umlExcerpt(), settings };
    const first = runOverlapAnalysis(input, deps);
    const second = runOverlapAnalysis(input, { ...deps, createId: () => 'other', now: () => 5 });
    expect(withoutVolatile(second)).toEqual(withoutVolatile(first));
  });

  it('finds the class correspondences of the paper Fig. 1 excerpt', () => {
    const result = runOverlapAnalysis({ source: ecoreExcerpt(), target: umlExcerpt(), settings }, deps);
    expect(pairs(result)).toEqual(expect.arrayContaining([
      [['EClass'], ['Class']],
      [['EAttribute', 'EReference'], ['Property']],
    ]));
    expect(result.correspondences.map(c => c.id)).toEqual(result.correspondences.map((_, k) => `c-${k + 1}`));
    const scores = result.correspondences.map(c => c.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(result.unmatched.target.map(t => t.name)).toEqual(['Association']);
    expect(result.summary).toMatchObject({ sourceClassCount: 3, targetClassCount: 3, matchedSourceClasses: 3, matchedTargetClasses: 2 });
    expect(result.summary.overlapPercent).toBeCloseTo((5 / 6) * 100, 2);
    expect(result.classMatrix.rows).toEqual(['ecore.EClass', 'ecore.EReference', 'ecore.EAttribute']);
    expect(result.classMatrix.overall).toHaveLength(9);
    expect(result.engine).toMatchObject({ strategy: { id: 'hybrid-ga-sa' }, lexicalSource: { id: 'oewn', version: '2025' } });
    expect(result.createdAt).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it('lets an additional measure change scores without touching the other modules (SC-006)', () => {
    const measures = createDefaultMeasureRegistry();
    const alwaysOne: SimilarityMeasure = { id: 'always-one', version: '1', level: 'class', score: () => 1 };
    measures.register(alwaysOne);
    const input = { source: ecoreExcerpt(), target: umlExcerpt(), settings };
    const base = runOverlapAnalysis(input, deps);
    const extended = runOverlapAnalysis({ ...input, settings: { ...settings, measures: [{ id: 'always-one', weight: 1 }] } }, { ...deps, measures });
    expect(extended.correspondences[0].scores['always-one']).toBe(1);
    expect(extended.classMatrix.overall).not.toEqual(base.classMatrix.overall);
    expect(extended.engine.measures.map(m => m.id)).toContain('always-one');
  });

  it('warns about missing WordNet data and unresolved supertypes', () => {
    const source = { ...ecoreExcerpt(), unresolvedSupertypes: ['other.ecore#//Foreign'] };
    const result = runOverlapAnalysis({ source, target: umlExcerpt(), settings }, { ...deps, lexical: noLexicalSource });
    expect(result.engine.lexicalSource).toBeNull();
    expect(result.warnings).toEqual([
      'WordNet synonyms could not be loaded; names were compared without synonyms.',
      'Ecore excerpt: supertype other.ecore#//Foreign is defined in another file and was ignored.',
    ]);
  });

  it('reports that no overlap can be computed when one side has no classes', () => {
    const empty: MetamodelGraph = { ref: refFor('Empty'), rootPackage: 'e', nsUri: null, classes: [], enums: [], unresolvedSupertypes: [] };
    const result = runOverlapAnalysis({ source: empty, target: umlExcerpt(), settings }, deps);
    expect(result.correspondences).toEqual([]);
    expect(result.unmatched.target).toHaveLength(3);
    expect(result.summary.overlapPercent).toBe(0);
    expect(result.warnings).toContain('One of the metamodels has no classes, so no overlap can be computed.');
  });

  it('rejects invalid settings', () => {
    expect(() => runOverlapAnalysis({ source: ecoreExcerpt(), target: umlExcerpt(), settings: { ...settings, seed: -1 } }, deps))
      .toThrow(InvalidSettingsError);
  });

  it('reports monotonic progress ending at 1', () => {
    const progress: number[] = [];
    runOverlapAnalysis({ source: ecoreExcerpt(), target: umlExcerpt(), settings }, { ...deps, onProgress: p => progress.push(p.fraction) });
    progress.slice(1).forEach((f, k) => expect(f).toBeGreaterThanOrEqual(progress[k]));
    expect(progress[progress.length - 1]).toBe(1);
  });
});

describe('solutionToCorrespondences (grouping rule)', () => {
  const problem = diagonalProblem(4);
  const group = (assignments: number[][]) =>
    solutionToCorrespondences(problem, { assignments, fitness: 0 }, 'class');
  const names = (assignments: number[][]) => group(assignments).correspondences
    .map(c => `${c.sources.map(s => s.name).join(',')}->${c.targets.map(t => t.name).join(',')}`).sort();

  it('merges sources that share a target (many-to-one)', () => {
    expect(names([[0], [0], [], []])).toEqual(['ElementA,ElementB->ElementA']);
  });

  it('keeps one-to-many correspondences together', () => {
    expect(names([[0, 1], [], [], []])).toEqual(['ElementA->ElementA,ElementB']);
  });

  it('merges chains into one component', () => {
    expect(names([[0], [0, 1], [1], []])).toEqual(['ElementA,ElementB,ElementC->ElementA,ElementB']);
  });

  it('lists unassigned sources and untouched targets as unmatched', () => {
    const { unmatched } = group([[0], [], [], []]);
    expect(unmatched.source.map(s => s.name)).toEqual(['ElementB', 'ElementC', 'ElementD']);
    expect(unmatched.target.map(t => t.name)).toEqual(['ElementB', 'ElementC', 'ElementD']);
  });

  it('assigns deterministic ids in descending score order', () => {
    const { correspondences } = group([[0], [1], [3], [2]]);
    expect(correspondences.map(c => c.id)).toEqual(['c-1', 'c-2', 'c-3', 'c-4']);
    expect(correspondences[0].score).toBeGreaterThanOrEqual(correspondences[3].score);
    expect(group([[0], [1], [3], [2]]).correspondences).toEqual(correspondences);
  });
});
