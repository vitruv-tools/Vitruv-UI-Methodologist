import { act, renderHook } from '@testing-library/react';
import { useProjectOverlapRun } from '../../hooks/useProjectOverlapRun';
import { useProjectSemanticOverlapStore } from '../../store/ProjectSemanticOverlap';
import { useSemanticOverlapStore } from '../../store/SemanticOverlap';
import { APPROACHES } from '../../utils/semanticOverlap/approaches/registry';
import { pairStatus } from '../../utils/semanticOverlap/overview';
import type { OverlapWorker } from '../../utils/semanticOverlap/runInWorker';
import type { FromWorker, ToWorker } from '../../workers/semanticOverlap.worker';
import { fakeResult, metamodel } from '../utils/semanticOverlap/overviewHelpers';

class FakeWorker implements OverlapWorker {
  posted: ToWorker[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage(message: ToWorker) { this.posted.push(message); }
  terminate() { this.terminated = true; }
  get current() { return this.onmessage ? this.posted.at(-1) : undefined; }
  emit(message: FromWorker) { this.onmessage?.({ data: message } as MessageEvent<FromWorker>); }
}

const VSUM = 7;
const overviewOf = () => useProjectSemanticOverlapStore.getState().overviews[VSUM];
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

function setup(poolSize = 2, project: number | null = VSUM) {
  const vsumId = project ?? undefined;
  const workers: FakeWorker[] = [];
  let run = 0;
  const hook = renderHook(({ id }) => useProjectOverlapRun(id, {
    poolSize,
    createWorker: () => { const worker = new FakeWorker(); workers.push(worker); return worker; },
    createRunId: () => `run-${++run}`,
    now: () => new Date('2026-11-03T10:00:00.000Z'),
  }), { initialProps: { id: vsumId } });
  const busy = () => workers.filter(worker => worker.current);
  /** Finishes every running analysis with an overlap derived from its run id. */
  const finishRunning = async (overlap = 50) => {
    for (const worker of busy()) {
      const { runId } = worker.current!;
      worker.emit({ type: 'done', runId, result: fakeResult(overlap) });
    }
    await flush();
  };
  return { hook, workers, busy, finishRunning };
}

const names = (posted: ToWorker) => `${posted.input.source.ref.name}→${posted.input.target.ref.name}`;
const three = () => [metamodel('A'), metamodel('B'), metamodel('C')];

describe('useProjectOverlapRun', () => {
  beforeEach(() => {
    useProjectSemanticOverlapStore.setState({ overviews: {} });
    useSemanticOverlapStore.getState().reset();
  });

  it('runs both directions of every pair, in name order, with at most poolSize workers', async () => {
    const { hook, workers, busy, finishRunning } = setup(2);
    act(() => { void hook.result.current.start(three()); });
    await flush();
    expect(workers).toHaveLength(2);
    expect(busy().map(w => names(w.current!))).toEqual(['A→B', 'B→A']);
    expect(overviewOf().progress).toEqual({ done: 0, total: 6, current: ['A ↔ B'] });

    await finishRunning();
    expect(workers).toHaveLength(2);
    expect(busy().map(w => names(w.current!))).toEqual(['A→C', 'C→A']);
    expect(overviewOf().progress).toMatchObject({ done: 2, total: 6, current: ['A ↔ C'] });

    await finishRunning();
    await finishRunning();
    expect(overviewOf().status).toBe('done');
    expect(overviewOf().progress).toEqual({ done: 6, total: 6, current: [] });
    expect(overviewOf().pairs.map(pairStatus)).toEqual(['done', 'done', 'done']);
    expect(workers.every(w => w.terminated)).toBe(true);
  });

  it('analyses with the approach and settings of the pair view and records them', async () => {
    useSemanticOverlapStore.getState().setApproach('paper');
    const { hook, workers } = setup(1);
    act(() => { void hook.result.current.start(three()); });
    await flush();
    const { settings } = useSemanticOverlapStore.getState();
    expect(workers[0].current).toMatchObject({ approach: 'paper', input: { settings } });
    expect(overviewOf()).toMatchObject({
      status: 'running',
      approach: { id: 'paper', version: APPROACHES.paper.version },
      settings,
      startedAt: '2026-11-03T10:00:00.000Z',
      metamodels: [{ key: 'mm:A', name: 'A', contentHash: 'hash-A' }, { key: 'mm:B', name: 'B', contentHash: 'hash-B' }, { key: 'mm:C', name: 'C', contentHash: 'hash-C' }],
    });
  });

  it('marks a failing direction and finishes the others', async () => {
    const { hook, busy, finishRunning } = setup(2);
    act(() => { void hook.result.current.start(three()); });
    await flush();
    const failing = busy()[1];
    failing.emit({ type: 'error', runId: failing.current!.runId, message: 'boom' });
    await flush();
    await finishRunning();
    await finishRunning();
    await finishRunning();
    const [ab] = overviewOf().pairs;
    expect(ab.backward).toMatchObject({ state: 'failed', error: 'boom' });
    expect(pairStatus(ab)).toBe('partial');
    expect(overviewOf().status).toBe('done');
    expect(overviewOf().progress.done).toBe(6);
  });

  it('cancels: stops all workers, keeps finished directions and marks the rest cancelled', async () => {
    const { hook, workers, finishRunning } = setup(2);
    act(() => { void hook.result.current.start(three()); });
    await flush();
    await finishRunning(40);
    act(() => hook.result.current.cancel());
    await flush();
    expect(workers.every(w => w.terminated)).toBe(true);
    const [ab, ac, bc] = overviewOf().pairs;
    expect(pairStatus(ab)).toBe('done');
    expect(pairStatus(ac)).toBe('not-analysed');
    expect(pairStatus(bc)).toBe('not-analysed');
    expect(overviewOf()).toMatchObject({ status: 'cancelled', finishedAt: '2026-11-03T10:00:00.000Z', progress: { current: [] } });
  });

  it('reuses finished directions when nothing changed and analyses only changed pairs again', async () => {
    const { hook, workers, finishRunning } = setup(2);
    act(() => { void hook.result.current.start(three()); });
    await flush();
    for (let i = 0; i < 3; i++) await finishRunning();
    const before = workers.length;

    act(() => { void hook.result.current.start(three()); });
    await flush();
    expect(workers).toHaveLength(before);
    expect(overviewOf()).toMatchObject({ status: 'done', progress: { done: 6, total: 6 } });

    act(() => { void hook.result.current.start([metamodel('A'), metamodel('B', 'edited'), metamodel('C')]); });
    await flush();
    const started = () => workers.slice(before).flatMap(w => w.posted.map(names)).sort((x, y) => x.localeCompare(y));
    expect(started()).toEqual(['A→B', 'B→A']);
    await finishRunning();
    expect(started()).toEqual(['A→B', 'B→A', 'B→C', 'C→B']);
  });

  it('schedules each of the 90 runs of ten metamodels exactly once with at most three workers', async () => {
    const ten = 'ABCDEFGHIJ'.split('').map(name => metamodel(name));
    const { hook, workers, busy, finishRunning } = setup(3);
    act(() => { void hook.result.current.start(ten); });
    await flush();
    while (busy().length > 0) {
      expect(busy().length).toBeLessThanOrEqual(3);
      await finishRunning();
    }
    expect(workers).toHaveLength(3);
    const runs = workers.flatMap(w => w.posted.map(names));
    expect(runs).toHaveLength(90);
    expect(new Set(runs).size).toBe(90);
    expect(overviewOf().progress).toEqual({ done: 90, total: 90, current: [] });
  });

  it('cancels when the project closes or another project opens', async () => {
    const { hook, workers } = setup(2);
    act(() => { void hook.result.current.start(three()); });
    await flush();
    hook.rerender({ id: 8 });
    expect(workers.every(w => w.terminated)).toBe(true);
    expect(overviewOf().status).toBe('cancelled');

    act(() => { void hook.result.current.start(three()); });
    await flush();
    hook.unmount();
    expect(useProjectSemanticOverlapStore.getState().overviews[8].status).toBe('cancelled');
  });

  it('does not start without a project, or with invalid settings', async () => {
    const { hook, workers } = setup(2, null);
    act(() => { void hook.result.current.start(three()); });
    await flush();
    expect(workers).toHaveLength(0);

    const other = setup(2);
    useSemanticOverlapStore.getState().updateSettings({ seed: -1 });
    act(() => { void other.hook.result.current.start(three()); });
    await flush();
    expect(other.workers).toHaveLength(0);
    expect(overviewOf()).toBeUndefined();
  });
});
