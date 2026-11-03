import { useCallback, useEffect, useRef } from 'react';
import { config } from '../config/environment';
import { useProjectSemanticOverlapStore } from '../store/ProjectSemanticOverlap';
import { useSemanticOverlapStore } from '../store/SemanticOverlap';
import { APPROACHES, approachOf } from '../utils/semanticOverlap/approaches/registry';
import { buildPairs, pairLabel, settingsKey } from '../utils/semanticOverlap/overview';
import type { PairDirection, PairOverlap, ProjectMetamodel } from '../utils/semanticOverlap/overviewTypes';
import {
  ANALYSIS_TIMEOUT_MS,
  RunCancelledError,
  createOverlapWorker,
  runInWorker,
  type OverlapWorker,
} from '../utils/semanticOverlap/runInWorker';

/** At most this many analyses run at the same time, each in its own worker. */
const MAX_POOL_SIZE = 3;

export const defaultPoolSize = () =>
  Math.min(MAX_POOL_SIZE, Math.max(1, (globalThis.navigator?.hardwareConcurrency ?? 2) - 1));

export interface ProjectOverlapRunDeps {
  createWorker?: () => OverlapWorker;
  createRunId?: () => string;
  poolSize?: number;
  now?: () => Date;
}

interface Job {
  pair: PairOverlap;
  direction: PairDirection;
}

interface ActiveRun {
  vsumId: number;
  controller: AbortController;
  workers: OverlapWorker[];
}

const DIRECTIONS: readonly PairDirection[] = ['forward', 'backward'];

/** Marks every unfinished direction as cancelled and ends the overview. */
function cancelOverview(vsumId: number, finishedAt: string) {
  const store = useProjectSemanticOverlapStore.getState();
  const overview = store.overviews[vsumId];
  if (!overview) return;
  for (const pair of overview.pairs) {
    for (const direction of DIRECTIONS) {
      const { state } = pair[direction];
      if (state === 'pending' || state === 'running') store.updateDirection(vsumId, pair.id, direction, { state: 'cancelled' });
    }
  }
  store.setProgress(vsumId, { ...overview.progress, current: [] });
  store.finish(vsumId, 'cancelled', finishedAt);
}

/**
 * Analyses every pair of a project's metamodels in both directions, with the approach and settings
 * of the pair view, in a small pool of reusable workers. Directions whose metamodels and settings
 * did not change keep their earlier result. Cancelling, unmounting or switching the project stops
 * all workers; finished directions stay.
 */
export function useProjectOverlapRun(vsumId: number | undefined, deps: ProjectOverlapRunDeps = {}) {
  // Kept in a ref so that new dependency objects on re-render do not restart or cancel a run.
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const activeRef = useRef<ActiveRun | null>(null);
  const nowIso = () => (depsRef.current.now ?? (() => new Date()))().toISOString();

  const stop = useCallback((): ActiveRun | null => {
    const active = activeRef.current;
    activeRef.current = null;
    if (!active) return null;
    active.controller.abort();
    for (const worker of active.workers) worker.terminate();
    return active;
  }, []);

  const cancel = useCallback(() => {
    const active = stop();
    if (active) cancelOverview(active.vsumId, nowIso());
    // nowIso only reads the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop]);

  const start = useCallback(async (metamodels: ProjectMetamodel[]) => {
    if (vsumId === undefined) return;
    cancel();
    const {
      createWorker = createOverlapWorker,
      createRunId = () => globalThis.crypto.randomUUID(),
      poolSize = defaultPoolSize(),
    } = depsRef.current;
    const { approach, settings } = useSemanticOverlapStore.getState();
    if (approachOf(approach).validate(settings).length > 0) return;

    const versioned = { id: approach, version: APPROACHES[approach].version };
    const key = settingsKey(versioned, settings);
    const store = useProjectSemanticOverlapStore.getState();
    const pairs = buildPairs(metamodels, key, store.overviews[vsumId]);
    const byKey = new Map(metamodels.map(m => [m.key, m]));
    const names = new Map(metamodels.map(m => [m.key, m.name]));
    const jobs: Job[] = pairs.flatMap(pair => DIRECTIONS
      .filter(direction => pair[direction].state === 'pending')
      .map(direction => ({ pair, direction })));
    const total = pairs.length * DIRECTIONS.length;
    let finished = total - jobs.length;
    const runningPairs = new Map<string, number>();

    const active: ActiveRun = { vsumId, controller: new AbortController(), workers: [] };
    activeRef.current = active;
    const isCurrent = () => activeRef.current === active;
    const reportProgress = () => {
      const current = pairs.filter(pair => (runningPairs.get(pair.id) ?? 0) > 0).map(pair => pairLabel(pair, names));
      useProjectSemanticOverlapStore.getState().setProgress(vsumId, { done: finished, total, current });
    };

    store.begin(vsumId, {
      vsumId,
      status: 'running',
      approach: versioned,
      settings,
      settingsKey: key,
      metamodels: metamodels.map(m => ({ key: m.key, name: m.name, contentHash: m.ref.contentHash })),
      pairs,
      progress: { done: finished, total, current: [] },
      startedAt: nowIso(),
      finishedAt: null,
      outdated: false,
      selectedPairId: null,
      detailDirection: 'forward',
      listScrollTop: 0,
    });

    const runJob = async (worker: OverlapWorker, { pair, direction }: Job) => {
      const [from, to] = direction === 'forward' ? [pair.a, pair.b] : [pair.b, pair.a];
      const update = useProjectSemanticOverlapStore.getState().updateDirection;
      update(vsumId, pair.id, direction, { state: 'running' });
      runningPairs.set(pair.id, (runningPairs.get(pair.id) ?? 0) + 1);
      reportProgress();
      try {
        const result = await runInWorker({
          worker,
          runId: createRunId(),
          approach,
          input: { source: byKey.get(from)!.graph!, target: byKey.get(to)!.graph!, settings },
          assetBase: config.assetBaseUrl,
          timeoutMs: ANALYSIS_TIMEOUT_MS,
          signal: active.controller.signal,
        });
        if (!isCurrent()) return;
        update(vsumId, pair.id, direction, { state: 'done', result, error: null });
      } catch (error) {
        if (error instanceof RunCancelledError || !isCurrent()) return;
        update(vsumId, pair.id, direction, { state: 'failed', error: error instanceof Error ? error.message : String(error) });
      }
      runningPairs.set(pair.id, (runningPairs.get(pair.id) ?? 1) - 1);
      finished += 1;
      reportProgress();
    };

    const queue = [...jobs];
    const workerLoop = async () => {
      const worker = createWorker();
      active.workers.push(worker);
      for (let job = queue.shift(); job && isCurrent(); job = queue.shift()) {
        await runJob(worker, job);
      }
    };
    await Promise.all(Array.from({ length: Math.min(poolSize, jobs.length) }, workerLoop));

    if (!isCurrent()) return;
    activeRef.current = null;
    for (const worker of active.workers) worker.terminate();
    useProjectSemanticOverlapStore.getState().finish(vsumId, 'done', nowIso());
    // nowIso only reads the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancel, vsumId]);

  // Leaving the project (unmount or another project) cancels its run.
  useEffect(() => () => cancel(), [vsumId, cancel]);

  return { start, cancel };
}
