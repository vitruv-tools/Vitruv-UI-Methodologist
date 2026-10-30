import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CorrespondenceList } from '../../../components/semanticOverlap/CorrespondenceList';
import { formatPercent } from '../../../components/semanticOverlap/ScoreEdge';
import { correspondenceFor, sampleEmbeddingResult, sampleImprovedResult, sampleKindsResult, sampleResult } from './sampleResult';

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

  it('shows the embedding similarity next to the other measures when the result used it', () => {
    render(<CorrespondenceList result={result} minScore={0} selectedId={null} onSelect={vi.fn()} expandedIds={[]} onToggleExpand={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Meaning (embedding)' })).not.toBeInTheDocument();
  });

  it('lists the embedding score per correspondence and sorts by it', () => {
    const withEmbeddings = sampleEmbeddingResult();
    render(<CorrespondenceList result={withEmbeddings} minScore={0} selectedId={null} onSelect={vi.fn()} expandedIds={[]} onToggleExpand={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Meaning (embedding)' }));
    const best = [...withEmbeddings.correspondences].sort((a, b) => (b.scores.embedding ?? 0) - (a.scores.embedding ?? 0))[0];
    expect(best.scores.embedding).toBeDefined();
    expect(bodyRows()[0]).toHaveTextContent(formatPercent(best.scores.embedding!));
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

  describe('path, split, merge and conditional correspondences', () => {
    const kinds = sampleKindsResult();
    const list = (props: Partial<React.ComponentProps<typeof CorrespondenceList>> = {}) => render(
      <CorrespondenceList result={kinds} minScore={0} selectedId={null} onSelect={vi.fn()} expandedIds={[]} onToggleExpand={vi.fn()} {...props} />);

    it('marks each kind with its own badge', () => {
      list({ expandedIds: ['c-1'] });
      expect(screen.getByText('split into 2')).toBeInTheDocument();
      expect(screen.getByText('merge of 2')).toBeInTheDocument();
      expect(screen.getByText('containment = true')).toBeInTheDocument();
      expect(screen.getByText('path ownedAttributes.isDerived')).toBeInTheDocument();
    });

    it('offers the kinds present in the result as filters, including those of attribute rows', () => {
      list();
      const options = within(screen.getByLabelText('Correspondence kind')).getAllByRole('option').map(o => o.textContent);
      expect(options).toEqual(['All', 'Path', 'Split', 'Merge', 'Conditional']);
      fireEvent.change(screen.getByLabelText('Correspondence kind'), { target: { value: 'conditional' } });
      expect(bodyRows()).toHaveLength(1);
      fireEvent.change(screen.getByLabelText('Correspondence kind'), { target: { value: 'path' } });
      expect(bodyRows()[0]).toHaveTextContent('EClass');
    });

    it('expands a conditional correspondence to its deciding attribute and value', () => {
      const onToggleExpand = vi.fn();
      const { rerender } = list({ onToggleExpand });
      fireEvent.click(screen.getByRole('button', { name: 'Show attribute and reference matches of EReference' }));
      expect(onToggleExpand).toHaveBeenCalledWith('c-3');
      rerender(<CorrespondenceList result={kinds} minScore={0} selectedId={null} onSelect={vi.fn()} expandedIds={['c-3']} onToggleExpand={onToggleExpand} />);
      expect(screen.getByText(/Condition:/).closest('td')).toHaveTextContent('Condition: ecore.EReference.containment = true selects Association');
    });
  });
});
