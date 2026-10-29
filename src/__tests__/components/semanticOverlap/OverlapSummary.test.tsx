import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { OverlapSummary } from '../../../components/semanticOverlap/OverlapSummary';
import { sampleImprovedResult, sampleResult } from './sampleResult';

describe('OverlapSummary', () => {
  it('shows counts, overlap and unmatched classes', () => {
    render(<OverlapSummary result={sampleResult()} />);
    expect(screen.getByText('83 %')).toBeInTheDocument();
    expect(screen.getByText('3 / 3 matched')).toBeInTheDocument();
    expect(screen.getByText('2 / 3 matched')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Unmatched in UML excerpt' })).getByText('Association')).toBeInTheDocument();
  });

  it('shows warnings such as the empty-side message', () => {
    const result = { ...sampleResult(), warnings: ['One of the metamodels has no classes, so no overlap can be computed.'] };
    render(<OverlapSummary result={result} />);
    expect(screen.getByRole('list', { name: 'Warnings' })).toHaveTextContent('no overlap can be computed');
  });

  it('qualifies names that are ambiguous', () => {
    const result = sampleResult();
    const twin = { ...result.unmatched.target[0], qualifiedName: 'uml.sub.Association' };
    render(<OverlapSummary result={{ ...result, unmatched: { ...result.unmatched, target: [...result.unmatched.target, twin] } }} />);
    expect(screen.getByText('uml.Association')).toBeInTheDocument();
    expect(screen.getByText('uml.sub.Association')).toBeInTheDocument();
  });

  it('names the approach and version that produced the result', () => {
    const { unmount } = render(<OverlapSummary result={sampleResult()} />);
    expect(screen.getByText('Kessentini et al. 2014 (paper) 2014.1')).toBeInTheDocument();
    unmount();
    render(<OverlapSummary result={{ ...sampleResult(), approach: { id: 'improved', version: '0.1' } }} />);
    expect(screen.getByText('Improved 0.1')).toBeInTheDocument();
  });

  it('counts the correspondences per kind when the result has kinds', () => {
    const { unmount } = render(<OverlapSummary result={sampleResult()} />);
    expect(screen.queryByText(/Class ↔ instance:/)).not.toBeInTheDocument();
    unmount();
    const improved = sampleImprovedResult();
    render(<OverlapSummary result={improved} />);
    expect(screen.getByText(`Same concept: ${improved.summary.kindCounts!.same} · Class ↔ instance: 2`)).toBeInTheDocument();
  });
});

