import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SemanticOverlapView } from '../../../components/semanticOverlap/SemanticOverlapView';
import { useSemanticOverlapStore } from '../../../store/SemanticOverlap';
import type { LibraryMetaModel } from '../../../utils/metaModelList';
import { correspondenceFor, sampleImprovedResult, sampleResult } from './sampleResult';
import { overlapResultToCsv, parseOverlapResult } from '../../../utils/semanticOverlap/overlapResult';
import { runOverlapAnalysis } from '../../../utils/semanticOverlap/runOverlapAnalysis';
import { createWordNetSource } from '../../../utils/semanticOverlap/lexical/wordNetSource';
import table from '../../../assets/wordnet/oewn-2025-synonyms.json';
import { ecoreExcerpt, umlExcerpt } from '../../utils/semanticOverlap/fixtures';

const mocks = vi.hoisted(() => ({ start: vi.fn(), cancel: vi.fn(), fetch: vi.fn(), download: vi.fn() }));

vi.mock('../../../utils/downloadFile', () => ({ downloadTextAsFile: mocks.download }));

vi.mock('../../../hooks/useSemanticOverlapRun', () => ({
  useSemanticOverlapRun: () => ({ start: mocks.start, cancel: mocks.cancel }),
}));
vi.mock('../../../utils/metaModelList', () => ({ fetchLibraryMetaModels: mocks.fetch }));
vi.mock('../../../components/semanticOverlap/CorrespondenceLinkDiagram', () => ({
  CorrespondenceLinkDiagram: ({ selectedId }: { selectedId: string | null }) => <div data-testid="link-diagram">diagram {selectedId}</div>,
}));
vi.mock('../../../components/semanticOverlap/SimilarityHeatmap', () => ({
  SimilarityHeatmap: ({ selectedId }: { selectedId: string | null }) => <div data-testid="heatmap">heatmap {selectedId}</div>,
}));

const models: LibraryMetaModel[] = [
  { id: 1, name: 'Ecore excerpt', ecoreFileId: 10, isOwnedByCurrentUser: true },
  { id: 2, name: 'UML excerpt', ecoreFileId: 20, isOwnedByCurrentUser: true },
];
const store = () => useSemanticOverlapStore.getState();

const renderView = async (path = '/semantic-overlap') => {
  render(<MemoryRouter initialEntries={[path]}><SemanticOverlapView /></MemoryRouter>);
  await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
  await waitFor(() => expect(screen.getAllByRole('option', { name: 'UML excerpt' })).toHaveLength(2));
  // The URL pre-selection runs after the library has loaded; a later selection change would clear results.
  if (path.includes('target=2')) await waitFor(() => expect(store().targetId).toBe(2));
};

const finishWith = (result = sampleResult()) => act(() => {
  store().beginLoading('r');
  store().finishRun('r', result);
});

describe('SemanticOverlapView', () => {
  beforeEach(() => {
    store().reset();
    mocks.start.mockReset();
    mocks.cancel.mockReset();
    mocks.fetch.mockReset().mockResolvedValue(models);
  });

  it('enables the analysis only when two metamodels are chosen and starts it with both', async () => {
    await renderView();
    const startButton = screen.getByRole('button', { name: 'Start analysis' });
    expect(startButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Source metamodel'), { target: { value: '1' } });
    expect(startButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Target metamodel'), { target: { value: '2' } });
    expect(startButton).toBeEnabled();
    fireEvent.click(startButton);
    expect(mocks.start).toHaveBeenCalledWith(models[0], models[1]);
  });

  it('pre-selects metamodels from the URL and ignores unknown ids with a notice', async () => {
    await renderView('/semantic-overlap?source=2&target=99');
    await waitFor(() => expect(store().sourceId).toBe(2));
    expect(store().targetId).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('not available');
  });

  it('shows progress with a cancel button while running', async () => {
    await renderView('/semantic-overlap?source=1&target=2');
    act(() => {
      store().beginLoading('r');
      store().beginRunning('r');
      store().updateProgress('r', { phase: 'ga', fraction: 0.5 });
    });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText(/genetic algorithm/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocks.cancel).toHaveBeenCalled();
  });

  it('shows the result with summary, diagram and list, and keeps the selection across tabs', async () => {
    await renderView('/semantic-overlap?source=1&target=2');
    finishWith();
    expect(screen.getByRole('region', { name: 'Overlap summary' })).toBeInTheDocument();
    expect(screen.getByTestId('link-diagram')).toBeInTheDocument();
    fireEvent.click(screen.getByText('EAttribute, EReference'));
    const selected = store().selectedCorrespondenceId;
    expect(selected).not.toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Heatmap' }));
    expect(screen.getByTestId('heatmap')).toHaveTextContent(`heatmap ${selected}`);
    fireEvent.click(screen.getByRole('tab', { name: 'Link diagram' }));
    expect(screen.getByTestId('link-diagram')).toHaveTextContent(`diagram ${selected}`);
  });

  it('switches the approach: keeps the result, allows a new run and disables the switch while running', async () => {
    await renderView('/semantic-overlap?source=1&target=2');
    finishWith();
    fireEvent.click(screen.getByRole('button', { name: 'Improved' }));
    expect(store().approach).toBe('improved');
    expect(screen.getByRole('region', { name: 'Overlap summary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run again' })).toBeEnabled();
    act(() => store().beginLoading('r2'));
    expect(screen.getByRole('button', { name: 'Kessentini et al. 2014 (paper)' })).toBeDisabled();
  });

  it('shows the type-object pattern panel only for results with a pattern', async () => {
    await renderView('/semantic-overlap?source=1&target=2');
    finishWith();
    expect(screen.queryByRole('region', { name: 'Type-object pattern' })).not.toBeInTheDocument();
    const improved = sampleImprovedResult();
    finishWith(improved);
    expect(screen.getByRole('region', { name: 'Type-object pattern' })).toBeInTheDocument();
    // Selecting an instance correspondence in the list selects it in the diagram as well.
    const bolt = correspondenceFor(improved, 'Bolt');
    fireEvent.click(screen.getAllByText('instance of ProductKind')[0].closest('tr')!);
    expect([bolt.id, correspondenceFor(improved, 'Nut').id]).toContain(store().selectedCorrespondenceId);
    expect(screen.getByTestId('link-diagram')).toHaveTextContent(`diagram ${store().selectedCorrespondenceId}`);
  });

  it('shows errors with a retry', async () => {
    await renderView('/semantic-overlap?source=1&target=2');
    act(() => {
      store().beginLoading('r');
      store().failRun('r', 'UML excerpt: the file is not valid XML');
    });
    expect(screen.getByRole('alert')).toHaveTextContent('UML excerpt: the file is not valid XML');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.start).toHaveBeenCalled();
  });

  it('shows an empty state before the first run and the WordNet attribution', async () => {
    await renderView();
    expect(screen.getByText(/Choose a source and a target metamodel/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open English WordNet 2025' })).toBeInTheDocument();
  });

  describe('tuning (US3)', () => {
    const lexical = createWordNetSource(table);
    const runSynchronously = () => {
      const settings = store().settings;
      act(() => {
        store().beginLoading('r');
        store().finishRun('r', runOverlapAnalysis({ source: ecoreExcerpt(), target: umlExcerpt(), settings }, { lexical, now: () => 0 }));
      });
    };
    const correspondences = () => store().result!.correspondences.map(c => ({ ids: c.sources.map(r => r.name), score: c.score }));

    beforeEach(() => { mocks.start.mockImplementation(runSynchronously); });

    it('reproduces the result with the same seed and changes it with another weighting', async () => {
      await renderView('/semantic-overlap?source=1&target=2');
      fireEvent.click(screen.getByRole('button', { name: /Analysis settings/ }));
      fireEvent.change(screen.getByLabelText('Seed'), { target: { value: '42' } });
      fireEvent.click(screen.getByRole('button', { name: 'Start analysis' }));
      const first = correspondences();
      fireEvent.click(screen.getByRole('button', { name: 'Run again' }));
      expect(correspondences()).toEqual(first);

      fireEvent.change(screen.getByRole('slider', { name: /Structural weight/ }), { target: { value: 0.9 } });
      fireEvent.click(screen.getByRole('button', { name: 'Run again' }));
      expect(correspondences().map(c => c.score)).not.toEqual(first.map(c => c.score));
      expect(screen.getByRole('region', { name: 'Settings used' })).toHaveTextContent(/Seed 42.*structural 90 %/);
    });

    it('disables the analysis while a setting is invalid', async () => {
      await renderView('/semantic-overlap?source=1&target=2');
      fireEvent.click(screen.getByRole('button', { name: /Analysis settings/ }));
      fireEvent.change(screen.getByLabelText('Seed'), { target: { value: 'abc' } });
      expect(screen.getByRole('button', { name: 'Start analysis' })).toBeDisabled();
    });

    it('applies the threshold without a new run', async () => {
      await renderView('/semantic-overlap?source=1&target=2');
      finishWith();
      mocks.start.mockClear();
      fireEvent.change(screen.getByRole('slider', { name: /Minimum score shown/ }), { target: { value: 0.95 } });
      expect(store().minScore).toBe(0.95);
      expect(screen.getByText(/No correspondences at or above/)).toBeInTheDocument();
      expect(mocks.start).not.toHaveBeenCalled();
    });
  });
  describe('export (US4)', () => {
    it('is disabled without a result', async () => {
      await renderView('/semantic-overlap?source=1&target=2');
      expect(screen.getByRole('button', { name: 'Export JSON' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
    });

    it('downloads the result as JSON and CSV with sanitised file names', async () => {
      await renderView('/semantic-overlap?source=1&target=2');
      const result = sampleResult();
      finishWith(result);
      fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
      const [json, jsonName, jsonType] = mocks.download.mock.calls[0];
      expect(jsonName).toBe('Ecore_excerpt-UML_excerpt-overlap.json');
      expect(jsonType).toBe('application/json;charset=utf-8');
      expect(parseOverlapResult(json)).toEqual(result);
      fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
      expect(mocks.download).toHaveBeenLastCalledWith(overlapResultToCsv(result), 'Ecore_excerpt-UML_excerpt-overlap.csv', 'text/csv;charset=utf-8');
    });
  });
});
