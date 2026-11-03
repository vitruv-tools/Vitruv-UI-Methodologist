import type {
  DirectionResult,
  OverlapOverview,
  PairOverlap,
  ProjectMetamodel,
} from '../../../utils/semanticOverlap/overviewTypes';
import type { MetamodelGraph, OverlapResult } from '../../../utils/semanticOverlap/types';

/** A parsed project metamodel with a fake graph; `hash` stands for the content. */
export const metamodel = (name: string, hash = `hash-${name}`, error: string | null = null): ProjectMetamodel => ({
  key: `mm:${name}`,
  name,
  ref: { libraryId: 0, name, ecoreFileId: 0, contentHash: hash },
  graph: error ? null : ({ ref: { name }, classes: [{ name: 'A' }] } as unknown as MetamodelGraph),
  error,
});

/** A minimal result with the given overlap and correspondence count. */
export const fakeResult = (overlapPercent: number, correspondences = 1, warnings: string[] = []): OverlapResult => ({
  id: `result-${overlapPercent}`,
  summary: { overlapPercent },
  correspondences: Array.from({ length: correspondences }, (_, i) => ({ id: `c${i}` })),
  warnings,
} as unknown as OverlapResult);

export const done = (overlapPercent: number, correspondences = 1, warnings: string[] = []): DirectionResult => ({
  state: 'done', result: fakeResult(overlapPercent, correspondences, warnings), error: null, cacheKey: 'k',
});

export const direction = (state: DirectionResult['state'], error: string | null = null): DirectionResult => ({
  state, result: null, error, cacheKey: 'k',
});

export const pair = (a: string, b: string, forward: DirectionResult, backward: DirectionResult): PairOverlap => ({
  id: `mm:${a}|mm:${b}`, a: `mm:${a}`, b: `mm:${b}`, forward, backward,
});

export const namesOf = (...names: string[]) => new Map(names.map(name => [`mm:${name}`, name]));

export const overview = (patch: Partial<OverlapOverview> = {}): OverlapOverview => ({
  vsumId: 7,
  status: 'done',
  approach: { id: 'improved', version: '0.3' },
  settings: { seed: 1 } as OverlapOverview['settings'],
  settingsKey: 'improved@0.3:{"seed":1}',
  metamodels: [],
  pairs: [],
  progress: { done: 0, total: 0, current: [] },
  startedAt: null,
  finishedAt: null,
  outdated: false,
  selectedPairId: null,
  detailDirection: 'forward',
  listScrollTop: 0,
  ...patch,
});
