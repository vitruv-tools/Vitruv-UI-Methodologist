import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CorrespondenceList } from '../../../components/semanticOverlap/CorrespondenceList';
import { formatPercent } from '../../../components/semanticOverlap/ScoreEdge';
import { correspondenceFor, sampleImprovedResult, sampleResult } from './sampleResult';

const result = sampleResult();
const bodyRows = () => within(screen.getByRole('table', { name: 'Correspondences' })).getAllByRole('row').slice(1);

describe('CorrespondenceList', () => {
  it('lists correspondences by descending score, with many-to-one entries in one row', () => {
    render(<CorrespondenceList result={result} minScore={0} selectedId={null} onSelect={vi.fn()} expandedIds={[]} onToggleExpand={vi.fn()} />);
    const rows = bodyRows();
    expect(rows).toHaveLength(result.correspondences.length);
    expect(rows[0]).toHaveTextContent(formatPercent(result.correspondences[0].score));
    expect(screen.getByText('EAttribute, EReference')).toBeInTheDocument();
  });

  it('re-sorts by the structural score', () => {
    render(<CorrespondenceList result={result} minScore={0} selectedId={null} onSelect={vi.fn()} expandedIds={[]} onToggleExpand={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Structural' }));
    const best = [...result.correspondences].sort((a, b) => b.scores.structural - a.scores.structural)[0];
    expect(bodyRows()[0]).toHaveTextContent(best.sources.map(s => s.name).join(', '));
  });

  it('selects a row and marks the selected one', () => {
    const onSelect = vi.fn();
    const eclass = correspondenceFor(result, 'EClass');
    render(<CorrespondenceList result={result} minScore={0} selectedId={eclass.id} onSelect={onSelect} expandedIds={[]} onToggleExpand={vi.fn()} />);
    const selectedRow = bodyRows().find(row => row.getAttribute('aria-selected') === 'true')!;
    expect(selectedRow).toHaveTextContent('EClass');
    fireEvent.click(screen.getByText('EAttribute, EReference'));
    expect(onSelect).toHaveBeenCalledWith(correspondenceFor(result, 'EAttribute').id);
  });

  it('hides rows below the threshold', () => {
    render(<CorrespondenceList result={result} minScore={1} selectedId={null} onSelect={vi.fn()} expandedIds={[]} onToggleExpand={vi.fn()} />);
    expect(screen.getByText(/No correspondences at or above/)).toBeInTheDocument();
  });

  it('expands a row to show its attribute and reference correspondences', () => {
    const onToggleExpand = vi.fn();
    const eclass = correspondenceFor(result, 'EClass');
    const { rerender } = render(<CorrespondenceList result={result} minScore={0} selectedId={null} onSelect={vi.fn()} expandedIds={[]} onToggleExpand={onToggleExpand} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show attribute and reference matches of EClass' }));
    expect(onToggleExpand).toHaveBeenCalledWith(eclass.id);
    rerender(<CorrespondenceList result={result} minScore={0} selectedId={null} onSelect={vi.fn()} expandedIds={[eclass.id]} onToggleExpand={onToggleExpand} />);
    const abstract = eclass.children!.find(c => c.sources.some(s => s.name === 'abstract'))!;
    const row = screen.getByText('abstract').closest('tr')!;
    expect(row).toHaveTextContent('isAbstract');
    expect(row).toHaveTextContent(formatPercent(abstract.score));
    expect(screen.getByText('eAttributes, eReferences')).toBeInTheDocument();
  });

  describe('correspondence kinds', () => {
    const improved = sampleImprovedResult();
    const list = (props: Partial<React.ComponentProps<typeof CorrespondenceList>> = {}) => render(
      <CorrespondenceList result={improved} minScore={0} selectedId={null} onSelect={vi.fn()} expandedIds={[]} onToggleExpand={vi.fn()} {...props} />);

    it('shows no kind column for results without instance correspondences', () => {
      render(<CorrespondenceList result={result} minScore={0} selectedId={null} onSelect={vi.fn()} expandedIds={[]} onToggleExpand={vi.fn()} />);
      expect(screen.queryByRole('columnheader', { name: 'Kind' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Correspondence kind')).not.toBeInTheDocument();
    });

    it('marks every row with its kind', () => {
      list();
      expect(screen.getByRole('columnheader', { name: 'Kind' })).toBeInTheDocument();
      expect(screen.getAllByText('instance of ProductKind')).toHaveLength(2);
      expect(screen.getAllByText('same concept').length).toBeGreaterThan(0);
      expect(screen.getAllByText('instance of ProductKind')[0]).toHaveAttribute('title', 'Role: type');
    });

    it('filters by kind', () => {
      list();
      fireEvent.change(screen.getByLabelText('Correspondence kind'), { target: { value: 'instance' } });
      expect(screen.queryAllByText('same concept')).toHaveLength(0);
      expect(screen.getAllByText('instance of ProductKind')).toHaveLength(2);
      fireEvent.change(screen.getByLabelText('Correspondence kind'), { target: { value: 'same' } });
      expect(screen.queryAllByText('instance of ProductKind')).toHaveLength(0);
    });

    it('shows the kind of expanded attribute rows', () => {
      const bolt = correspondenceFor(improved, 'Bolt');
      list({ expandedIds: [bolt.id] });
      expect(screen.getByText('instance of NumberFeature (definition)')).toBeInTheDocument();
      expect(screen.getByText('instance of NumberFeatureValue (value)')).toBeInTheDocument();
    });
  });
});

