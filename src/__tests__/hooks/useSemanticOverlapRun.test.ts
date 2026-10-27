import { act, renderHook } from '@testing-library/react';
import { ANALYSIS_TIMEOUT_MS, TIMEOUT_MESSAGE, useSemanticOverlapRun, type OverlapWorker } from '../../hooks/useSemanticOverlapRun';
import { useSemanticOverlapStore } from '../../store/SemanticOverlap';
import type { LibraryMetaModel } from '../../utils/metaModelList';
import type { FromWorker, ToWorker } from '../../workers/semanticOverlap.worker';
import { readFixture } from '../utils/semanticOverlap/fixtures';
import { sampleResult } from '../components/semanticOverlap/sampleResult';

vi.mock('../../services/api', () => ({ apiService: { getFile: vi.fn() } }));

class FakeWorker implements OverlapWorker {
  posted: ToWorker[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage(message: ToWorker) { this.posted.push(message); }
  terminate() { this.terminated = true; }
  emit(message: FromWorker) { this.onmessage?.({ data: message } as MessageEvent<FromWorker>); }
}

const ecore: LibraryMetaModel = { id: 1, name: 'Ecore excerpt', ecoreFileId: 10 };
const uml: LibraryMetaModel = { id: 2, name: 'UML excerpt', ecoreFileId: 20 };
const files: Record<number, string> = { 10: readFixture('ecore-excerpt.ecore'), 20: readFixture('uml-excerpt.ecore') };

function setup(getFile = vi.fn((id: number) => Promise.resolve(files[id]))) {
  const workers: FakeWorker[] = [];
  let run = 0;
  const hook = renderHook(() => useSemanticOverlapRun({
    getFile,
    createWorker: () => { const w = new FakeWorker(); workers.push(w); return w; },
    createRunId: () => `run-${++run}`,
  }));
  return { hook, workers, getFile };
}

const state = () => useSemanticOverlapStore.getState();

describe('useSemanticOverlapRun', () => {
  beforeEach(() => {
    state().reset();
    state().setSource(1);
    state().setTarget(2);
  });
  afterEach(() => vi.useRealTimers());

  it('fetches, parses and hashes both files, then starts the worker', async () => {
    const { hook, workers, getFile } = setup();
    await act(() => hook.result.current.start(ecore, uml));
    expect(getFile).toHaveBeenCalledWith(10);
    expect(getFile).toHaveBeenCalledWith(20);
    expect(workers).toHaveLength(1);
    const message = workers[0].posted[0];
    expect(message.runId).toBe('run-1');
    expect(message.input.source.classes.map(c => c.name)).toEqual(['EClass', 'EReference', 'EAttribute']);
    expect(message.input.source.ref).toMatchObject({ libraryId: 1, name: 'Ecore excerpt', ecoreFileId: 10 });
    expect(message.input.source.ref.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(state().status).toBe('running');
  });

  it('maps progress and the result into the store and terminates the worker', async () => {
    const { hook, workers } = setup();
    await act(() => hook.result.current.start(ecore, uml));
    act(() => workers[0].emit({ type: 'progress', runId: 'run-1', phase: 'ga', fraction: 0.3 }));
    expect(state().progress).toEqual({ phase: 'ga', fraction: 0.3 });
    const result = sampleResult();
    act(() => workers[0].emit({ type: 'done', runId: 'run-1', result }));
    expect(state()).toMatchObject({ status: 'done', result });
    expect(workers[0].terminated).toBe(true);
  });

  it('reports worker errors', async () => {
    const { hook, workers } = setup();
    await act(() => hook.result.current.start(ecore, uml));
    act(() => workers[0].emit({ type: 'error', runId: 'run-1', message: 'boom' }));
    expect(state()).toMatchObject({ status: 'failed', error: 'boom' });
  });

  it('cancels: terminates the worker and ignores late messages', async () => {
    const { hook, workers } = setup();
    await act(() => hook.result.current.start(ecore, uml));
    act(() => hook.result.current.cancel());
    expect(workers[0].terminated).toBe(true);
    expect(state().status).toBe('ready');
    act(() => workers[0].emit({ type: 'done', runId: 'run-1', result: sampleResult() }));
    expect(state().result).toBeNull();
  });

  it('terminates the previous worker when a new run starts', async () => {
    const { hook, workers } = setup();
    await act(() => hook.result.current.start(ecore, uml));
    await act(() => hook.result.current.start(ecore, uml));
    expect(workers[0].terminated).toBe(true);
    expect(workers[1].posted[0].runId).toBe('run-2');
  });

  it('cancels when the view unmounts', async () => {
    const { hook, workers } = setup();
    await act(() => hook.result.current.start(ecore, uml));
    hook.unmount();
    expect(workers[0].terminated).toBe(true);
    expect(state().status).toBe('ready');
  });

  it('names the metamodel whose ecore cannot be read', async () => {
    const { hook, workers } = setup(vi.fn((id: number) => Promise.resolve(id === 20 ? '<broken' : files[id])));
    await act(() => hook.result.current.start(ecore, uml));
    expect(workers).toHaveLength(0);
    expect(state()).toMatchObject({ status: 'failed', error: 'UML excerpt: the file is not valid XML' });
  });

  it('fails when a file cannot be fetched', async () => {
    const { hook } = setup(vi.fn(() => Promise.reject(new Error('404'))));
    await act(() => hook.result.current.start(ecore, uml));
    expect(state()).toMatchObject({ status: 'failed', error: 'Could not load the metamodels: 404' });
  });

  it('stops a run after the timeout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { hook, workers } = setup();
    await act(() => hook.result.current.start(ecore, uml));
    act(() => { vi.advanceTimersByTime(ANALYSIS_TIMEOUT_MS); });
    expect(workers[0].terminated).toBe(true);
    expect(state()).toMatchObject({ status: 'failed', error: TIMEOUT_MESSAGE });
  });
});
