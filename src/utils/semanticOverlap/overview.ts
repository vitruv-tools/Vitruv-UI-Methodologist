import type {
  DirectionResult,
  MatrixCell,
  OverlapOverview,
  PairOverlap,
  PairStatus,
  ProjectMetamodel,
} from './overviewTypes';
import type { AnalysisSettings, VersionedId } from './types';

/** JSON with object keys sorted at every level, so equal settings give equal text. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort((a, b) => a.localeCompare(b))
      .filter(key => (value as Record<string, unknown>)[key] !== undefined)
      .map(key => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Identifies approach, version and settings; results computed under the same key can be reused. */
export const settingsKey = (approach: VersionedId, settings: AnalysisSettings) =>
  `${approach.id}@${approach.version}:${stableJson(settings)}`;

const cacheKeyOf = (from: ProjectMetamodel, to: ProjectMetamodel, key: string) =>
  `${from.ref.contentHash}|${to.ref.contentHash}|${key}`;

const pending = (cacheKey: string): DirectionResult => ({ state: 'pending', result: null, error: null, cacheKey });

const reuseOrPending = (cacheKey: string, previous: DirectionResult | undefined): DirectionResult =>
  (previous?.state === 'done' && previous.cacheKey === cacheKey ? previous : pending(cacheKey));

/**
 * One pair per two metamodels (`a` sorts first). Directions whose metamodels and settings did not
 * change since `previous` keep their result; pairs with an unreadable metamodel fail directly.
 */
export function buildPairs(metamodels: ProjectMetamodel[], key: string, previous?: OverlapOverview): PairOverlap[] {
  const previousPairs = new Map((previous?.pairs ?? []).map(pair => [pair.id, pair]));
  const pairs: PairOverlap[] = [];
  for (let i = 0; i < metamodels.length; i++) {
    for (let j = i + 1; j < metamodels.length; j++) {
      const [a, b] = [metamodels[i], metamodels[j]];
      const id = `${a.key}|${b.key}`;
      const forwardKey = cacheKeyOf(a, b, key);
      const backwardKey = cacheKeyOf(b, a, key);
      const error = a.error ?? b.error;
      if (error !== null) {
        const failed = (cacheKey: string): DirectionResult => ({ state: 'failed', result: null, error, cacheKey });
        pairs.push({ id, a: a.key, b: b.key, forward: failed(forwardKey), backward: failed(backwardKey) });
        continue;
      }
      const before = previousPairs.get(id);
      pairs.push({
        id,
        a: a.key,
        b: b.key,
        forward: reuseOrPending(forwardKey, before?.forward),
        backward: reuseOrPending(backwardKey, before?.backward),
      });
    }
  }
  return pairs;
}

/** Status of a pair derived from its two directions. */
export function pairStatus(pair: PairOverlap): PairStatus {
  const states = [pair.forward.state, pair.backward.state];
  if (states.includes('running')) return 'running';
  const done = states.filter(state => state === 'done').length;
  if (done === 2) return 'done';
  if (done === 1) return states.includes('pending') ? 'running' : 'partial';
  if (states.every(state => state === 'pending')) return 'pending';
  if (states.includes('failed')) return 'failed';
  if (states.includes('pending')) return 'pending';
  return 'not-analysed';
}

/** First error of a pair, if any. */
export const pairError = (pair: PairOverlap) => pair.forward.error ?? pair.backward.error;

const overlapOf = (direction: DirectionResult) =>
  (direction.state === 'done' && direction.result ? direction.result.summary.overlapPercent : null);

/** Overlap per direction, the higher one (ranking value) and the correspondences of that direction. */
export function pairValues(pair: PairOverlap): {
  forward: number | null;
  backward: number | null;
  value: number | null;
  correspondences: number | null;
} {
  const forward = overlapOf(pair.forward);
  const backward = overlapOf(pair.backward);
  if (forward === null && backward === null) return { forward, backward, value: null, correspondences: null };
  const useBackward = forward === null || (backward !== null && backward > forward);
  const best = useBackward ? pair.backward : pair.forward;
  return {
    forward,
    backward,
    value: useBackward ? backward : forward,
    correspondences: best.result?.correspondences.length ?? null,
  };
}

/** `A ↔ B` with display names. */
export const pairLabel = (pair: PairOverlap, names: ReadonlyMap<string, string>) =>
  `${names.get(pair.a) ?? pair.a} ↔ ${names.get(pair.b) ?? pair.b}`;

/** Highest overlap first; ties and pairs without a value in name order. */
export function rankPairs(pairs: PairOverlap[], names: ReadonlyMap<string, string>): PairOverlap[] {
  const byName = (x: PairOverlap, y: PairOverlap) =>
    (names.get(x.a) ?? x.a).localeCompare(names.get(y.a) ?? y.a)
    || (names.get(x.b) ?? x.b).localeCompare(names.get(y.b) ?? y.b)
    || x.id.localeCompare(y.id);
  return [...pairs].sort((x, y) => {
    const [vx, vy] = [pairValues(x).value, pairValues(y).value];
    if (vx === null && vy === null) return byName(x, y);
    if (vx === null) return 1;
    if (vy === null) return -1;
    return vy - vx || byName(x, y);
  });
}

/** Symmetric metamodel × metamodel matrix of the ranking values; the diagonal is empty. */
export function overviewMatrix(metamodels: { key: string }[], pairs: PairOverlap[]): MatrixCell[][] {
  const byKeys = new Map<string, PairOverlap>();
  for (const pair of pairs) {
    byKeys.set(`${pair.a}|${pair.b}`, pair);
    byKeys.set(`${pair.b}|${pair.a}`, pair);
  }
  return metamodels.map(row => metamodels.map(column => {
    const pair = row.key === column.key ? undefined : byKeys.get(`${row.key}|${column.key}`);
    if (!pair) return { pairId: null, value: null, forward: null, backward: null };
    const { forward, backward, value } = pairValues(pair);
    return { pairId: pair.id, value, forward, backward };
  }));
}

/** True when metamodels were added, removed or changed, or other settings are chosen now. */
export function isOutdated(overview: OverlapOverview, current: ProjectMetamodel[], currentSettingsKey: string): boolean {
  if (overview.settingsKey !== currentSettingsKey) return true;
  if (overview.metamodels.length !== current.length) return true;
  const hashes = new Map(overview.metamodels.map(m => [m.key, m.contentHash]));
  return current.some(m => hashes.get(m.key) !== m.ref.contentHash);
}

/** Warnings of all finished results, each distinct message once. */
export function overviewWarnings(pairs: PairOverlap[]): string[] {
  const warnings = new Set<string>();
  for (const pair of pairs) {
    for (const direction of [pair.forward, pair.backward]) {
      for (const warning of direction.result?.warnings ?? []) warnings.add(warning);
    }
  }
  return [...warnings];
}

/** Quotes a CSV field when it contains a comma, quote or line break (RFC 4180). */
const csvField = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const numberField = (value: number | null) => (value === null ? '' : String(value));

const CSV_COLUMNS = [
  'metamodel_a', 'metamodel_b', 'overlap_a_to_b', 'overlap_b_to_a', 'overlap_max',
  'correspondences', 'status', 'message', 'approach', 'settings',
];

const exportStatus = (pair: PairOverlap): PairStatus => {
  const status = pairStatus(pair);
  // An export of an unfinished run reports open pairs as not analysed.
  return status === 'pending' || status === 'running' ? 'not-analysed' : status;
};

const namesOfOverview = (overview: OverlapOverview) => new Map(overview.metamodels.map(m => [m.key, m.name]));

/** One row per pair, highest overlap first, with approach and settings on every row. */
export function overviewToCsv(overview: OverlapOverview): string {
  const names = namesOfOverview(overview);
  const approach = `${overview.approach.id} ${overview.approach.version}`;
  const settings = stableJson(overview.settings);
  const rows = rankPairs(overview.pairs, names).map(pair => {
    const values = pairValues(pair);
    return [
      names.get(pair.a) ?? pair.a,
      names.get(pair.b) ?? pair.b,
      numberField(values.forward),
      numberField(values.backward),
      numberField(values.value),
      numberField(values.correspondences),
      exportStatus(pair),
      pairError(pair) ?? '',
      approach,
      settings,
    ].map(csvField).join(',');
  });
  return `${[CSV_COLUMNS.join(','), ...rows].join('\n')}\n`;
}

/** The overview as versioned JSON, without the full per-pair results. */
export function serializeOverview(overview: OverlapOverview, projectName: string): string {
  const names = namesOfOverview(overview);
  return JSON.stringify({
    schemaVersion: 1,
    kind: 'semantic-overlap-overview',
    project: projectName,
    createdAt: overview.finishedAt ?? overview.startedAt,
    approach: { id: overview.approach.id, version: overview.approach.version },
    settings: overview.settings,
    metamodels: overview.metamodels.map(({ name, contentHash }) => ({ name, contentHash })),
    pairs: rankPairs(overview.pairs, names).map(pair => {
      const values = pairValues(pair);
      return {
        a: names.get(pair.a) ?? pair.a,
        b: names.get(pair.b) ?? pair.b,
        overlapAToB: values.forward,
        overlapBToA: values.backward,
        overlapMax: values.value,
        correspondences: values.correspondences,
        status: exportStatus(pair),
        message: pairError(pair),
      };
    }),
  }, null, 2);
}

/** `<project>-overlap-overview.<extension>`, restricted to safe file-name characters. */
export const overviewFileName = (projectName: string, extension: 'csv' | 'json') =>
  `${projectName || 'project'}-overlap-overview.${extension}`.replace(/[^A-Za-z0-9._-]/g, '_');
