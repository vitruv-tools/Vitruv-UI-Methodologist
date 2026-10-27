import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CorrespondenceList } from '../../../components/semanticOverlap/CorrespondenceList';
import { formatPercent } from '../../../components/semanticOverlap/ScoreEdge';
import { correspondenceFor, sampleResult } from './sampleResult';

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
});
