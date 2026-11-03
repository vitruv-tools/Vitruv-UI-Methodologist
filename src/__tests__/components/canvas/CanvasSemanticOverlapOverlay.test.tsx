import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Node } from 'reactflow';
import { CanvasSemanticOverlapOverlay } from '../../../components/canvas/CanvasSemanticOverlapOverlay';
import { apiService } from '../../../services/api';
import { useProjectSemanticOverlapStore } from '../../../store/ProjectSemanticOverlap';
import { useSemanticOverlapStore } from '../../../store/SemanticOverlap';
import type { OverlapWorker } from '../../../utils/semanticOverlap/runInWorker';
import type { FromWorker, ToWorker } from '../../../workers/semanticOverlap.worker';
import { readFixture } from '../../utils/semanticOverlap/fixtures';
import { sampleResult } from '../semanticOverlap/sampleResult';

vi.mock('../../../components/semanticOverlap/CorrespondenceLinkDiagram', () => ({
  CorrespondenceLinkDiagram: () => <div data-testid="link-diagram" />,
}));
vi.mock('../../../components/semanticOverlap/SimilarityHeatmap', () => ({
  SimilarityHeatmap: () => <div data-testid="heatmap" />,
}));

class FakeWorker implements OverlapWorker {
  posted: ToWorker[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage(message: ToWorker) { this.posted.push(message); }
  terminate() { this.terminated = true; }
  emit(message: FromWorker) { this.onmessage?.({ data: message } as MessageEvent<FromWorker>); }
}

const VSUM = 7;
const fileNode = (id: string, fileName: string, fixture: string): Node => ({
  id, type: 'ecoreFile', position: { x: 0, y: 0 }, data: { fileName, fileContent: readFixture(fixture), metaModelId: Number(id) },
});
const canvasNodes = () => [fileNode('1', 'Ecore.ecore', 'ecore-excerpt.ecore'), fileNode('2', 'UML.ecore', 'uml-excerpt.ecore')];
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

function renderOverlay(nodes = canvasNodes(), visible = true) {
  const workers: FakeWorker[] = [];
  const runDeps = { poolSize: 2, createWorker: () => { const w = new FakeWorker(); workers.push(w); return w; } };
  const view = render(<CanvasSemanticOverlapOverlay projectId={VSUM} projectName="Demo" visible={visible} canvasNodes={nodes} runDeps={runDeps} />);
  /** Starts the overview and finishes both directions of the only pair. */
  const runToEnd = async () => {
    await screen.findByText('2 metamodels · 1 pair');
    fireEvent.click(screen.getByRole('button', { name: 'Start analysis' }));
    await flush();
    for (const worker of workers) worker.emit({ type: 'done', runId: worker.posted[0].runId, result: sampleResult() });
    await flush();
  };
  return { ...view, workers, runToEnd };
}

describe('CanvasSemanticOverlapOverlay', () => {
  beforeEach(() => {
    useProjectSemanticOverlapStore.setState({ overviews: {} });
    useSemanticOverlapStore.getState().reset();
  });

  it('is hidden outside the mode but stays mounted', () => {
    renderOverlay(canvasNodes(), false);
    expect(screen.getByTestId('canvas-semantic-overlap-overlay')).toHaveStyle({ display: 'none' });
  });

  it('frames the mode like Metrics: bordered panel, white header and a close button', () => {
    const onClose = vi.fn();
    render(<CanvasSemanticOverlapOverlay projectId={VSUM} visible canvasNodes={canvasNodes()} onClose={onClose} />);
    const frame = screen.getByRole('region', { name: 'Semantic overlap' });
    expect(frame).toHaveStyle({ border: '1px solid var(--v-border)', borderRadius: '12px' });
    const header = screen.getByRole('heading', { name: 'Semantic overlap' }).closest('header')!;
    expect(header).toHaveStyle({ background: 'var(--v-surface)' });
    fireEvent.click(screen.getByRole('button', { name: 'Close semantic overlap' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the frame and the close button while a pair is open', async () => {
    const { runToEnd } = renderOverlay();
    await runToEnd();
    fireEvent.click(screen.getByRole('button', { name: /^Ecore ↔ UML: \d+ % overlap, open details$/ }));
    expect(screen.getByRole('heading', { name: 'Semantic overlap' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ecore ↔ UML' })).toBeInTheDocument();
  });

  it('shows nothing to run without a project', () => {
    render(<CanvasSemanticOverlapOverlay visible canvasNodes={canvasNodes()} />);
    expect(screen.queryByRole('button', { name: 'Start analysis' })).not.toBeInTheDocument();
  });

  it('only reads the canvas: nodes stay unchanged and nothing is saved', async () => {
    const nodes = canvasNodes();
    const before = structuredClone(nodes);
    const apiCalls = Object.keys(apiService)
      .filter(key => typeof (apiService as unknown as Record<string, unknown>)[key] === 'function')
      .map(key => vi.spyOn(apiService as unknown as Record<string, () => unknown>, key));
    const dispatch = vi.spyOn(globalThis, 'dispatchEvent');

    const { runToEnd } = renderOverlay(nodes);
    await runToEnd();

    expect(useProjectSemanticOverlapStore.getState().overviews[VSUM].status).toBe('done');
    expect(nodes).toEqual(before);
    for (const spy of apiCalls) expect(spy).not.toHaveBeenCalled();
    const vitruvEvents = dispatch.mock.calls.filter(([event]) => event.type.startsWith('vitruv.'));
    expect(vitruvEvents).toHaveLength(0);
    dispatch.mockRestore();
    for (const spy of apiCalls) spy.mockRestore();
  });

  it('opens a pair from the list, goes back, and keeps the results across mode switches', async () => {
    const { runToEnd, rerender, workers } = renderOverlay();
    await runToEnd();
    fireEvent.click(screen.getByRole('button', { name: /^Ecore ↔ UML: \d+ % overlap, open details$/ }));
    expect(screen.getByRole('heading', { name: 'Ecore ↔ UML' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Overlap summary' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'UML → Ecore' }));
    expect(useProjectSemanticOverlapStore.getState().overviews[VSUM].detailDirection).toBe('backward');

    fireEvent.click(screen.getByRole('button', { name: '← Back to overview' }));
    expect(screen.getByRole('list', { name: 'Pairs by overlap' })).toBeInTheDocument();

    const runs = workers.length;
    rerender(<CanvasSemanticOverlapOverlay projectId={VSUM} projectName="Demo" visible={false} canvasNodes={canvasNodes()} />);
    rerender(<CanvasSemanticOverlapOverlay projectId={VSUM} projectName="Demo" visible canvasNodes={canvasNodes()} />);
    await waitFor(() => expect(screen.getByRole('list', { name: 'Pairs by overlap' })).toBeInTheDocument());
    expect(workers).toHaveLength(runs);
    expect(screen.queryByText(/changed since this overview/)).not.toBeInTheDocument();
  });

  it('keeps a running analysis going while a pair is open', async () => {
    const nodes = [...canvasNodes(), fileNode('3', 'Zoo.ecore', 'ecore-excerpt.ecore')];
    const { workers } = renderOverlay(nodes);
    await screen.findByText('3 metamodels · 3 pairs');
    fireEvent.click(screen.getByRole('button', { name: 'Start analysis' }));
    await flush();
    for (const worker of workers) worker.emit({ type: 'done', runId: worker.posted.at(-1)!.runId, result: sampleResult() });
    await flush();
    fireEvent.click(screen.getByRole('button', { name: /^Ecore ↔ UML: \d+ % overlap, open details$/ }));
    expect(workers.some(w => w.terminated)).toBe(false);
    expect(useProjectSemanticOverlapStore.getState().overviews[VSUM].status).toBe('running');
  });
});
