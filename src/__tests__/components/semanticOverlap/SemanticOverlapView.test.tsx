import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SemanticOverlapView } from '../../../components/semanticOverlap/SemanticOverlapView';
import { useSemanticOverlapStore } from '../../../store/SemanticOverlap';
import type { LibraryMetaModel } from '../../../utils/metaModelList';
import { sampleResult } from './sampleResult';

const mocks = vi.hoisted(() => ({ start: vi.fn(), cancel: vi.fn(), fetch: vi.fn() }));

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
    expect(store().sourceId).toBe(2);
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
});
