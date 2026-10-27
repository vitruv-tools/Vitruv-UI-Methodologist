import { DEFAULT_MIN_SCORE, useSemanticOverlapStore } from '../../store/SemanticOverlap';
import { sampleResult } from '../components/semanticOverlap/sampleResult';

const store = () => useSemanticOverlapStore.getState();

describe('semantic overlap store', () => {
  beforeEach(() => store().reset());

  it('goes idle → ready → loading → running → done', () => {
    expect(store().status).toBe('idle');
    store().setSource(1);
    expect(store().status).toBe('idle');
    store().setTarget(2);
    expect(store().status).toBe('ready');
    store().beginLoading('run-1');
    expect(store().status).toBe('loading');
    expect(store().progress).toEqual({ phase: 'loading', fraction: 0 });
    store().beginRunning('run-1');
    store().updateProgress('run-1', { phase: 'ga', fraction: 0.4 });
    expect(store()).toMatchObject({ status: 'running', progress: { phase: 'ga', fraction: 0.4 } });
    const result = sampleResult();
    store().finishRun('run-1', result);
    expect(store()).toMatchObject({ status: 'done', result, runId: null, progress: null });
  });

  it('records failures', () => {
    store().setSource(1);
    store().setTarget(2);
    store().beginLoading('run-1');
    store().failRun('run-1', 'broken');
    expect(store()).toMatchObject({ status: 'failed', error: 'broken' });
  });

  it('ignores messages of stale runs', () => {
    store().setSource(1);
    store().setTarget(2);
    store().beginLoading('old');
    store().beginLoading('new');
    store().updateProgress('old', { phase: 'sa', fraction: 0.9 });
    store().finishRun('old', sampleResult());
    store().failRun('old', 'late');
    expect(store()).toMatchObject({ status: 'loading', runId: 'new', result: null, error: null });
  });

  it('returns to ready and drops the result when the selection changes', () => {
    store().setSource(1);
    store().setTarget(2);
    store().beginLoading('r');
    store().finishRun('r', sampleResult());
    store().setTarget(3);
    expect(store()).toMatchObject({ status: 'ready', result: null, targetId: 3 });
    store().swap();
    expect(store()).toMatchObject({ sourceId: 3, targetId: 1 });
  });

  it('keeps the result but needs a new run when settings change', () => {
    store().setSource(1);
    store().setTarget(2);
    store().beginLoading('r');
    const result = sampleResult();
    store().finishRun('r', result);
    store().updateSettings({ nullScore: 0.2 });
    expect(store()).toMatchObject({ status: 'ready', result });
    expect(store().settings.nullScore).toBe(0.2);
  });

  it('cancels a run back to the previous state', () => {
    store().setSource(1);
    store().setTarget(2);
    store().beginLoading('r');
    store().cancelRun();
    expect(store()).toMatchObject({ status: 'ready', runId: null, progress: null });
  });

  it('keeps selection and threshold across tab switches without touching the result', () => {
    store().setSource(1);
    store().setTarget(2);
    store().beginLoading('r');
    const result = sampleResult();
    store().finishRun('r', result);
    store().selectCorrespondence('c-1');
    store().setActiveTab('heatmap');
    store().setMinScore(0.9);
    expect(store()).toMatchObject({ activeTab: 'heatmap', selectedCorrespondenceId: 'c-1', minScore: 0.9, result });
    store().setMinScore(3);
    expect(store().minScore).toBe(1);
    expect(DEFAULT_MIN_SCORE).toBe(0);
  });
});
