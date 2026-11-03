import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  OverlapResultPanel,
  type OverlapResultViewActions,
  type OverlapResultViewState,
} from '../../../components/semanticOverlap/OverlapResultPanel';
import { correspondenceFor, sampleAlternativesResult, sampleResult } from './sampleResult';

vi.mock('../../../components/semanticOverlap/CorrespondenceLinkDiagram', () => ({
  CorrespondenceLinkDiagram: () => <div data-testid="link-diagram" />,
}));
vi.mock('../../../components/semanticOverlap/SimilarityHeatmap', () => ({
  SimilarityHeatmap: () => <div data-testid="heatmap" />,
}));

const view: OverlapResultViewState = {
  activeTab: 'diagram',
  minScore: 0,
  selectedCorrespondenceId: null,
  collapsedUnmatched: false,
  expandedCorrespondenceIds: [],
  selectedAlternative: null,
};

const makeActions = (): OverlapResultViewActions => ({
  setActiveTab: vi.fn(),
  selectCorrespondence: vi.fn(),
  setHoveredCell: vi.fn(),
  setCollapsedUnmatched: vi.fn(),
  toggleExpanded: vi.fn(),
  selectAlternative: vi.fn(),
});

describe('OverlapResultPanel', () => {
  it('shows the summary, the link diagram and the correspondence list', () => {
    render(<OverlapResultPanel result={sampleResult()} view={view} actions={makeActions()} />);
    expect(screen.getByRole('region', { name: 'Overlap summary' })).toBeInTheDocument();
    expect(screen.getByTestId('link-diagram')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Correspondences' })).toBeInTheDocument();
  });

  it('shows the heatmap when that tab is active and reports tab changes', () => {
    const actions = makeActions();
    const { rerender } = render(<OverlapResultPanel result={sampleResult()} view={view} actions={actions} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Heatmap' }));
    expect(actions.setActiveTab).toHaveBeenCalledWith('heatmap');
    rerender(<OverlapResultPanel result={sampleResult()} view={{ ...view, activeTab: 'heatmap' }} actions={actions} />);
    expect(screen.getByTestId('heatmap')).toBeInTheDocument();
  });

  it('reports a selected correspondence', () => {
    const actions = makeActions();
    const result = sampleResult();
    render(<OverlapResultPanel result={result} view={view} actions={actions} />);
    const table = screen.getByRole('table', { name: 'Correspondences' });
    fireEvent.click(within(table).getAllByText('EClass')[0]);
    expect(actions.selectCorrespondence).toHaveBeenCalledWith(correspondenceFor(result, 'EClass').id);
  });

  it('offers the alternatives only when there is more than one', () => {
    const { rerender } = render(<OverlapResultPanel result={sampleResult()} view={view} actions={makeActions()} />);
    expect(screen.queryByRole('group', { name: 'Alternative results' })).not.toBeInTheDocument();
    rerender(<OverlapResultPanel result={sampleAlternativesResult()} view={view} actions={makeActions()} />);
    expect(screen.getByRole('group', { name: 'Alternative results' })).toBeInTheDocument();
  });
});
