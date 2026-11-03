import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { OverlapPairMatrix } from '../../../components/semanticOverlap/OverlapPairMatrix';
import { overviewMatrix } from '../../../utils/semanticOverlap/overview';
import { direction, done, pair } from '../../utils/semanticOverlap/overviewHelpers';

const metamodels = ['A', 'B', 'C'].map(name => ({ key: `mm:${name}`, name }));
const pairs = [
  pair('A', 'B', done(20), done(35)),
  pair('A', 'C', direction('cancelled'), direction('cancelled')),
  pair('B', 'C', done(70), done(10)),
];

const renderMatrix = (onOpen = vi.fn()) => {
  render(<OverlapPairMatrix metamodels={metamodels} cells={overviewMatrix(metamodels, pairs)} onOpen={onOpen} />);
  return onOpen;
};

describe('OverlapPairMatrix', () => {
  it('shows each pair twice, symmetric, with an accessible name', () => {
    renderMatrix();
    expect(screen.getByRole('button', { name: 'A ↔ B: 35 % overlap' })).toHaveTextContent('35 %');
    expect(screen.getByRole('button', { name: 'B ↔ A: 35 % overlap' })).toHaveTextContent('35 %');
    expect(screen.getByRole('button', { name: 'C ↔ B: 70 % overlap' })).toBeInTheDocument();
    expect(screen.getAllByRole('gridcell', { name: /same metamodel/ })).toHaveLength(3);
  });

  it('shows both directions in the tooltip', () => {
    renderMatrix();
    expect(screen.getByRole('button', { name: 'A ↔ B: 35 % overlap' })).toHaveAttribute('title', 'A → B: 20 %\nB → A: 35 %');
    expect(screen.getByRole('button', { name: 'B ↔ A: 35 % overlap' })).toHaveAttribute('title', 'B → A: 35 %\nA → B: 20 %');
  });

  it('opens a pair and disables pairs without a value', () => {
    const onOpen = renderMatrix();
    fireEvent.click(screen.getByRole('button', { name: 'C ↔ B: 70 % overlap' }));
    expect(onOpen).toHaveBeenCalledWith('mm:B|mm:C');
    expect(screen.getByRole('button', { name: 'A ↔ C: not analysed' })).toBeDisabled();
  });

  it('colours higher overlap stronger', () => {
    renderMatrix();
    const low = screen.getByRole('button', { name: 'A ↔ B: 35 % overlap' }).style.background;
    const high = screen.getByRole('button', { name: 'B ↔ C: 70 % overlap' }).style.background;
    expect(low).not.toBe(high);
  });
});
