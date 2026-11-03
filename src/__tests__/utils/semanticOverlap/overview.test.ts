import {
  buildPairs,
  isOutdated,
  overviewFileName,
  overviewMatrix,
  overviewToCsv,
  overviewWarnings,
  pairLabel,
  pairStatus,
  pairValues,
  rankPairs,
  serializeOverview,
  settingsKey,
  stableJson,
} from '../../../utils/semanticOverlap/overview';
import type { AnalysisSettings } from '../../../utils/semanticOverlap/types';
import { direction, done, metamodel, namesOf, overview, pair } from './overviewHelpers';

const KEY = 'improved@0.3:{}';

describe('settingsKey', () => {
  it('does not depend on the order of the settings keys', () => {
    const a = { seed: 1, weights: { structural: 0.5, syntactic: 0.5 } } as unknown as AnalysisSettings;
    const b = { weights: { syntactic: 0.5, structural: 0.5 }, seed: 1 } as unknown as AnalysisSettings;
    expect(settingsKey({ id: 'paper', version: '1' }, a)).toBe(settingsKey({ id: 'paper', version: '1' }, b));
    expect(settingsKey({ id: 'paper', version: '1' }, a)).not.toBe(settingsKey({ id: 'paper', version: '2' }, a));
  });

  it('writes stable JSON with sorted keys and skips undefined values', () => {
    expect(stableJson({ b: [2, { d: 1, c: null }], a: 'x', u: undefined })).toBe('{"a":"x","b":[2,{"c":null,"d":1}]}');
  });
});

describe('buildPairs', () => {
  it('builds one pair per two metamodels, the first by name as a', () => {
    const pairs = buildPairs([metamodel('A'), metamodel('B'), metamodel('C')], KEY);
    expect(pairs.map(p => p.id)).toEqual(['mm:A|mm:B', 'mm:A|mm:C', 'mm:B|mm:C']);
    expect(pairs[0].forward).toEqual({ state: 'pending', result: null, error: null, cacheKey: `hash-A|hash-B|${KEY}` });
    expect(pairs[0].backward.cacheKey).toBe(`hash-B|hash-A|${KEY}`);
  });

  it('keeps finished directions whose metamodels and settings did not change', () => {
    const first = buildPairs([metamodel('A'), metamodel('B'), metamodel('C')], KEY)
      .map(p => ({ ...p, forward: { ...done(50), cacheKey: p.forward.cacheKey }, backward: { ...done(40), cacheKey: p.backward.cacheKey } }));
    const again = buildPairs([metamodel('A'), metamodel('B', 'changed'), metamodel('C')], KEY, overview({ pairs: first }));
    const [ab, ac, bc] = again;
    expect(ab.forward.state).toBe('pending');
    expect(ac.forward).toBe(first[1].forward);
    expect(ac.backward).toBe(first[1].backward);
    expect(bc.backward.state).toBe('pending');
    expect(buildPairs([metamodel('A'), metamodel('C')], 'other', overview({ pairs: first }))[0].forward.state).toBe('pending');
  });

  it('fails pairs with an unreadable metamodel without scheduling them', () => {
    const [pairWithBroken] = buildPairs([metamodel('A'), metamodel('B', 'h', 'B: the file is not valid XML')], KEY);
    expect(pairWithBroken.forward).toMatchObject({ state: 'failed', error: 'B: the file is not valid XML' });
    expect(pairWithBroken.backward.state).toBe('failed');
  });
});

describe('pairStatus', () => {
  it.each([
    ['pending', 'pending', 'pending'],
    ['running', 'pending', 'running'],
    ['done', 'done', 'done'],
    ['done', 'cancelled', 'partial'],
    ['failed', 'done', 'partial'],
    ['failed', 'cancelled', 'failed'],
    ['cancelled', 'cancelled', 'not-analysed'],
  ] as const)('%s + %s → %s', (forward, backward, expected) => {
    const make = (state: typeof forward) => (state === 'done' ? done(10) : direction(state));
    expect(pairStatus(pair('A', 'B', make(forward), make(backward)))).toBe(expected);
  });
});

describe('pairValues and rankPairs', () => {
  it('ranks by the higher direction and takes the correspondences from it', () => {
    expect(pairValues(pair('A', 'B', done(30, 4), done(55, 7)))).toEqual({ forward: 30, backward: 55, value: 55, correspondences: 7 });
    expect(pairValues(pair('A', 'B', done(30, 4), direction('failed')))).toEqual({ forward: 30, backward: null, value: 30, correspondences: 4 });
  });

  it('puts the highest overlap first, ties by name and pairs without a value last', () => {
    const names = namesOf('A', 'B', 'C', 'D');
    const pairs = [
      pair('C', 'D', direction('failed'), direction('failed')),
      pair('B', 'C', done(40), done(10)),
      pair('A', 'D', done(60), done(10)),
      pair('A', 'C', done(10), done(40)),
      pair('A', 'B', direction('cancelled'), direction('cancelled')),
    ];
    expect(rankPairs(pairs, names).map(p => pairLabel(p, names))).toEqual(['A ↔ D', 'A ↔ C', 'B ↔ C', 'A ↔ B', 'C ↔ D']);
  });
});

describe('overviewMatrix', () => {
  it('is symmetric with an empty diagonal', () => {
    const metamodels = [{ key: 'mm:A' }, { key: 'mm:B' }, { key: 'mm:C' }];
    const pairs = [pair('A', 'B', done(20), done(30)), pair('A', 'C', direction('failed'), direction('failed'))];
    const matrix = overviewMatrix(metamodels, pairs);
    expect(matrix[0][0]).toEqual({ pairId: null, value: null, forward: null, backward: null });
    expect(matrix[0][1]).toEqual({ pairId: 'mm:A|mm:B', value: 30, forward: 20, backward: 30 });
    expect(matrix[1][0]).toEqual(matrix[0][1]);
    expect(matrix[2][0]).toMatchObject({ pairId: 'mm:A|mm:C', value: null });
    expect(matrix[1][2].pairId).toBeNull();
  });
});

describe('isOutdated', () => {
  const current = [metamodel('A'), metamodel('B')];
  const computed = overview({
    settingsKey: KEY,
    metamodels: current.map(m => ({ key: m.key, name: m.name, contentHash: m.ref.contentHash })),
  });

  it('is current when nothing changed', () => {
    expect(isOutdated(computed, current, KEY)).toBe(false);
  });

  it('is outdated when a metamodel was added, removed or changed, or the settings differ', () => {
    expect(isOutdated(computed, [...current, metamodel('C')], KEY)).toBe(true);
    expect(isOutdated(computed, [current[0]], KEY)).toBe(true);
    expect(isOutdated(computed, [current[0], metamodel('B', 'edited')], KEY)).toBe(true);
    expect(isOutdated(computed, [current[0], metamodel('X')], KEY)).toBe(true);
    expect(isOutdated(computed, current, 'paper@1:{}')).toBe(true);
  });
});

describe('overviewWarnings', () => {
  it('lists each warning once', () => {
    const pairs = [
      pair('A', 'B', done(10, 1, ['No embedding model']), done(10, 1, ['No embedding model', 'Other'])),
      pair('A', 'C', done(10, 1, ['No embedding model']), direction('failed')),
    ];
    expect(overviewWarnings(pairs)).toEqual(['No embedding model', 'Other']);
  });
});

describe('overview export', () => {
  const exported = overview({
    approach: { id: 'improved', version: '0.3' },
    settings: { seed: 1, mode: 'fast' } as unknown as AnalysisSettings,
    startedAt: '2026-11-03T09:00:00.000Z',
    finishedAt: '2026-11-03T10:00:00.000Z',
    metamodels: [
      { key: 'mm:A', name: 'Brake, "v2"', contentHash: 'ha' },
      { key: 'mm:B', name: 'BOM', contentHash: 'hb' },
      { key: 'mm:C', name: 'C', contentHash: 'hc' },
    ],
    pairs: [
      pair('A', 'B', done(58.3, 9), done(62.5, 14)),
      pair('A', 'C', done(20, 2), direction('cancelled')),
      pair('B', 'C', direction('failed', 'C: the file is not valid XML'), direction('failed', 'C: the file is not valid XML')),
    ],
  });
  const SETTINGS_CELL = '"{""mode"":""fast"",""seed"":1}"';

  it('writes one CSV row per ranked pair with quoting and empty cells for missing values', () => {
    const lines = overviewToCsv(exported).trimEnd().split('\n');
    expect(lines[0]).toBe('metamodel_a,metamodel_b,overlap_a_to_b,overlap_b_to_a,overlap_max,correspondences,status,message,approach,settings');
    expect(lines[1]).toBe(`"Brake, ""v2""",BOM,58.3,62.5,62.5,14,done,,improved 0.3,${SETTINGS_CELL}`);
    expect(lines[2]).toBe(`"Brake, ""v2""",C,20,,20,2,partial,,improved 0.3,${SETTINGS_CELL}`);
    expect(lines[3]).toBe(`BOM,C,,,,,failed,C: the file is not valid XML,improved 0.3,${SETTINGS_CELL}`);
  });

  it('writes versioned JSON without the full results', () => {
    const json = JSON.parse(serializeOverview(exported, 'Brake case study'));
    expect(json).toMatchObject({
      schemaVersion: 1,
      kind: 'semantic-overlap-overview',
      project: 'Brake case study',
      createdAt: '2026-11-03T10:00:00.000Z',
      approach: { id: 'improved', version: '0.3' },
      settings: { seed: 1, mode: 'fast' },
      metamodels: [{ name: 'Brake, "v2"', contentHash: 'ha' }, { name: 'BOM', contentHash: 'hb' }, { name: 'C', contentHash: 'hc' }],
    });
    expect(json.pairs[0]).toEqual({
      a: 'Brake, "v2"', b: 'BOM', overlapAToB: 58.3, overlapBToA: 62.5, overlapMax: 62.5, correspondences: 14, status: 'done', message: null,
    });
    expect(json.pairs[2]).toMatchObject({ overlapMax: null, status: 'failed', message: 'C: the file is not valid XML' });
  });

  it('reports open pairs of an unfinished run as not analysed', () => {
    const running = overview({ metamodels: exported.metamodels, pairs: [pair('A', 'B', direction('running'), direction('pending'))] });
    expect(JSON.parse(serializeOverview(running, 'p')).pairs[0].status).toBe('not-analysed');
  });

  it('names the files after the project with safe characters', () => {
    expect(overviewFileName('Brake case/study', 'csv')).toBe('Brake_case_study-overlap-overview.csv');
    expect(overviewFileName('', 'json')).toBe('project-overlap-overview.json');
  });
});
