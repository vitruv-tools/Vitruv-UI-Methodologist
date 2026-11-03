import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ProjectOverlapOverview } from '../../../components/semanticOverlap/ProjectOverlapOverview';
import { useProjectSemanticOverlapStore } from '../../../store/ProjectSemanticOverlap';
import { useSemanticOverlapStore } from '../../../store/SemanticOverlap';
import { APPROACHES } from '../../../utils/semanticOverlap/approaches/registry';
import { settingsKey } from '../../../utils/semanticOverlap/overview';
import type { OverlapOverview, ProjectMetamodel } from '../../../utils/semanticOverlap/overviewTypes';
import { direction, done, metamodel, overview, pair } from '../../utils/semanticOverlap/overviewHelpers';

const mocks = vi.hoisted(() => ({ metamodels: vi.fn(), download: vi.fn() }));
vi.mock('../../../utils/semanticOverlap/projectMetamodels', () => ({ projectMetamodels: mocks.metamodels }));
vi.mock('../../../utils/downloadFile', () => ({ downloadTextAsFile: mocks.download }));

const VSUM = 7;
const three = () => [metamodel('A'), metamodel('B'), metamodel('C')];

const currentKey = () => {
  const { approach, settings } = useSemanticOverlapStore.getState();
  return settingsKey({ id: approach, version: APPROACHES[approach].version }, settings);
};

/** A finished overview of `metamodels`, computed with the current pair-view settings. */
const finished = (metamodels: ProjectMetamodel[], patch: Partial<OverlapOverview> = {}): OverlapOverview => {
  const { approach, settings } = useSemanticOverlapStore.getState();
  return overview({
    vsumId: VSUM,
    approach: { id: approach, version: APPROACHES[approach].version },
    settings,
    settingsKey: currentKey(),
    metamodels: metamodels.map(m => ({ key: m.key, name: m.name, contentHash: m.ref.contentHash })),
    pairs: [
      pair('A', 'B', done(20, 3), done(30, 4)),
      pair('A', 'C', done(70, 9, ['No embedding model']), done(10, 1, ['No embedding model'])),
      pair('B', 'C', direction('failed', 'boom'), direction('failed', 'boom')),
    ],
    ...patch,
  });
};

async function renderOverview(metamodels: ProjectMetamodel[] = three()) {
  mocks.metamodels.mockResolvedValue(metamodels);
  const onStart = vi.fn(() => Promise.resolve());
  const onCancel = vi.fn();
  render(<ProjectOverlapOverview vsumId={VSUM} projectName="Brake case" nodes={[]} onStart={onStart} onCancel={onCancel} />);
  await waitFor(() => expect(mocks.metamodels).toHaveBeenCalled());
  await act(async () => { await Promise.resolve(); });
  return { onStart, onCancel };
}

describe('ProjectOverlapOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectSemanticOverlapStore.setState({ overviews: {} });
    useSemanticOverlapStore.getState().reset();
  });

  it('asks for at least two metamodels and offers no start', async () => {
    await renderOverview([metamodel('A')]);
    expect(screen.getByText('This project needs at least two metamodels to compare.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start analysis' })).not.toBeInTheDocument();
  });

  it('starts the analysis of the project metamodels', async () => {
    const metamodels = three();
    const { onStart } = await renderOverview(metamodels);
    expect(screen.getByText('3 metamodels · 3 pairs')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start analysis' }));
    expect(onStart).toHaveBeenCalledWith(metamodels);
  });

  it('shows the progress of a running overview and cancels it', async () => {
    useProjectSemanticOverlapStore.getState().begin(VSUM, finished(three(), {
      status: 'running',
      progress: { done: 2, total: 6, current: ['A ↔ C'] },
    }));
    const { onCancel } = await renderOverview();
    expect(screen.getByText('2 of 6 analyses done · analysing A ↔ C')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Overview progress' })).toHaveAttribute('aria-valuenow', '2');
    expect(screen.getByRole('button', { name: 'Run again' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows the ranked list and the matrix with the same values', async () => {
    useProjectSemanticOverlapStore.getState().begin(VSUM, finished(three()));
    await renderOverview();
    const list = within(screen.getByRole('list', { name: 'Pairs by overlap' })).getAllByRole('button');
    expect(list.map(row => row.getAttribute('aria-label'))).toEqual([
      'A ↔ C: 70 % overlap, open details',
      'A ↔ B: 30 % overlap, open details',
      'B ↔ C: failed',
    ]);
    const grid = screen.getByRole('grid', { name: 'Overlap matrix' });
    expect(within(grid).getByRole('button', { name: 'A ↔ C: 70 % overlap' })).toBeInTheDocument();
    expect(within(grid).getByRole('button', { name: 'B ↔ A: 30 % overlap' })).toBeInTheDocument();
    expect(screen.getByText(/Approach: /)).toHaveTextContent(`Approach: ${APPROACHES.improved.label} ${APPROACHES.improved.version}`);
  });

  it('shows a warning of several pairs only once', async () => {
    useProjectSemanticOverlapStore.getState().begin(VSUM, finished(three()));
    await renderOverview();
    const notices = within(screen.getByRole('list', { name: 'Notices' })).getAllByRole('listitem');
    expect(notices.map(n => n.textContent)).toEqual(['No embedding model']);
  });

  it('opens a pair and remembers the scroll position', async () => {
    useProjectSemanticOverlapStore.getState().begin(VSUM, finished(three()));
    await renderOverview();
    fireEvent.click(screen.getByRole('button', { name: 'A ↔ C: 70 % overlap, open details' }));
    expect(useProjectSemanticOverlapStore.getState().overviews[VSUM]).toMatchObject({ selectedPairId: 'mm:A|mm:C', listScrollTop: 0 });
  });

  it('marks the overview as outdated when a metamodel changed and runs again', async () => {
    useProjectSemanticOverlapStore.getState().begin(VSUM, finished(three()));
    const edited = [metamodel('A'), metamodel('B', 'edited'), metamodel('C')];
    const { onStart } = await renderOverview(edited);
    const banner = await screen.findByText('The metamodels or the settings changed since this overview was computed.');
    expect(useProjectSemanticOverlapStore.getState().overviews[VSUM].outdated).toBe(true);
    fireEvent.click(within(banner.parentElement!).getByRole('button', { name: 'Run again' }));
    expect(onStart).toHaveBeenCalledWith(edited);
  });

  it('marks the overview as outdated when another approach is chosen', async () => {
    useProjectSemanticOverlapStore.getState().begin(VSUM, finished(three()));
    await renderOverview();
    expect(screen.queryByText(/changed since this overview/)).not.toBeInTheDocument();
    act(() => useSemanticOverlapStore.getState().setApproach('paper'));
    expect(await screen.findByText(/changed since this overview/)).toBeInTheDocument();
  });

  it('exports the overview as CSV and JSON', async () => {
    useProjectSemanticOverlapStore.getState().begin(VSUM, finished(three()));
    await renderOverview();
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
    expect(mocks.download).toHaveBeenNthCalledWith(1, expect.stringContaining('metamodel_a,metamodel_b'), 'Brake_case-overlap-overview.csv', 'text/csv;charset=utf-8');
    const [json, fileName] = mocks.download.mock.calls[1];
    expect(fileName).toBe('Brake_case-overlap-overview.json');
    expect(JSON.parse(json)).toMatchObject({ kind: 'semantic-overlap-overview', project: 'Brake case' });
  });

  it('offers no export before any pair has a result', async () => {
    await renderOverview();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeDisabled();
  });
});
