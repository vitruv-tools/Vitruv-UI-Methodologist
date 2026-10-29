import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { TypeObjectPatternPanel } from '../../../components/semanticOverlap/TypeObjectPatternPanel';
import { sampleImprovedResult } from './sampleResult';

describe('TypeObjectPatternPanel', () => {
  it('shows the roles, data-type classes, counterpart and confidence of each pattern', () => {
    render(<TypeObjectPatternPanel patterns={sampleImprovedResult().typeObjectPatterns!} />);
    const panel = screen.getByRole('region', { name: 'Type-object pattern' });
    expect(within(panel).getByText('Type-object pattern in the target metamodel (100 % confidence)')).toBeInTheDocument();
    expect(within(panel).getByText('Product')).toBeInTheDocument();
    expect(within(panel).getByText('ProductKind')).toBeInTheDocument();
    expect(within(panel).getByText('number: NumberFeature, text: TextFeature')).toBeInTheDocument();
    expect(within(panel).getByText('Bolt, Nut')).toBeInTheDocument();
    expect(within(panel).getByText('Assembly')).toBeInTheDocument();
  });

  it('renders nothing without patterns', () => {
    const { container } = render(<TypeObjectPatternPanel patterns={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
