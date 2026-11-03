import {
  RunCancelledError,
  RunTimeoutError,
  TIMEOUT_MESSAGE,
  runInWorker,
  startInWorker,
  type OverlapWorker,
} from '../../../utils/semanticOverlap/runInWorker';
import type { OverlapInput } from '../../../utils/semanticOverlap/types';
import type { FromWorker, ToWorker } from '../../../workers/semanticOverlap.worker';
import { sampleResult } from '../../components/semanticOverlap/sampleResult';

class FakeWorker implements OverlapWorker {
  posted: ToWorker[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage(message: ToWorker) { this.posted.push(message); }
  terminate() { this.terminated = true; }
  emit(message: FromWorker) { this.onmessage?.({ data: message } as MessageEvent<FromWorker>); }
}

const input = { settings: { seed: 1 } } as unknown as OverlapInput;
const TIMEOUT = 1000;

function run(worker: FakeWorker, extra: { signal?: AbortSignal; onProgress?: () => void } = {}) {
  return runInWorker({ worker, runId: 'r1', approach: 'improved', input, assetBase: '/', timeoutMs: TIMEOUT, ...extra });
}

describe('runInWorker', () => {
  afterEach(() => vi.useRealTimers());

  it('posts exactly one start message', () => {
    const worker = new FakeWorker();
    void run(worker).catch(() => undefined);
    expect(worker.posted).toEqual([{ type: 'start', runId: 'r1', approach: 'improved', input, assetBase: '/' }]);
  });

  it('resolves with the result and never terminates the worker', async () => {
    const worker = new FakeWorker();
    const promise = run(worker);
    const result = sampleResult();
    worker.emit({ type: 'done', runId: 'r1', result });
    await expect(promise).resolves.toBe(result);
    expect(worker.terminated).toBe(false);
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
  });

  it('forwards progress and ignores messages of other runs', async () => {
    const worker = new FakeWorker();
    const onProgress = vi.fn();
    const promise = run(worker, { onProgress });
    worker.emit({ type: 'progress', runId: 'other', phase: 'ga', fraction: 0.9 });
    worker.emit({ type: 'done', runId: 'other', result: sampleResult() });
    worker.emit({ type: 'progress', runId: 'r1', phase: 'ga', fraction: 0.4 });
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith({ phase: 'ga', fraction: 0.4 });
    const result = sampleResult();
    worker.emit({ type: 'done', runId: 'r1', result });
    await expect(promise).resolves.toBe(result);
  });

  it('rejects with the worker message on error', async () => {
    const worker = new FakeWorker();
    const promise = run(worker);
    worker.emit({ type: 'error', runId: 'r1', message: 'boom' });
    await expect(promise).rejects.toThrow('boom');
  });

  it('rejects when the worker itself fails', async () => {
    const worker = new FakeWorker();
    const promise = run(worker);
    worker.onerror?.({ message: '' } as ErrorEvent);
    await expect(promise).rejects.toThrow('The analysis failed.');
  });

  it('rejects with a timeout error after the time limit', async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const promise = run(worker);
    vi.advanceTimersByTime(TIMEOUT);
    await expect(promise).rejects.toBeInstanceOf(RunTimeoutError);
    await expect(promise).rejects.toThrow(TIMEOUT_MESSAGE);
  });

  it('clears its timer once the run is done', async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const promise = run(worker);
    worker.emit({ type: 'done', runId: 'r1', result: sampleResult() });
    await promise;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects with a cancel error when aborted, without terminating the worker', async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    const promise = run(worker, { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toBeInstanceOf(RunCancelledError);
    expect(worker.terminated).toBe(false);
    expect(worker.onmessage).toBeNull();
  });

  it('does not start when the signal is already aborted', async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    controller.abort();
    await expect(run(worker, { signal: controller.signal })).rejects.toBeInstanceOf(RunCancelledError);
    expect(worker.posted).toHaveLength(0);
  });
});

describe('startInWorker', () => {
  it('reports synchronously and only once', () => {
    const worker = new FakeWorker();
    const onDone = vi.fn();
    const onError = vi.fn();
    startInWorker({ worker, runId: 'r1', approach: 'paper', input, timeoutMs: TIMEOUT }, { onDone, onError });
    const result = sampleResult();
    worker.emit({ type: 'done', runId: 'r1', result });
    expect(onDone).toHaveBeenCalledWith(result);
    worker.emit({ type: 'error', runId: 'r1', message: 'late' });
    expect(onError).not.toHaveBeenCalled();
  });

  it('detaches without reporting', () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const onDone = vi.fn();
    const onError = vi.fn();
    const detach = startInWorker({ worker, runId: 'r1', approach: 'paper', input, timeoutMs: TIMEOUT }, { onDone, onError });
    detach();
    vi.advanceTimersByTime(TIMEOUT);
    expect(onError).not.toHaveBeenCalled();
    expect(worker.onmessage).toBeNull();
    vi.useRealTimers();
  });
});
