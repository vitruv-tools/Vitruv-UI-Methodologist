import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { OverlapPairList } from '../../../components/semanticOverlap/OverlapPairList';
import { direction, done, namesOf, pair } from '../../utils/semanticOverlap/overviewHelpers';

const names = namesOf('A', 'B', 'C', 'D');

describe('OverlapPairList', () => {
  it('lists the pairs in the given order with overlap and correspondences', () => {
    render(<OverlapPairList
      names={names}
      onOpen={vi.fn()}
      pairs={[pair('A', 'C', done(62.4, 7), done(40)), pair('A', 'B', done(10, 1), done(5))]}
    />);
    const rows = within(screen.getByRole('list', { name: 'Pairs by overlap' })).getAllByRole('button');
    expect(rows[0]).toHaveTextContent('1.A ↔ C62 %7 correspondences');
    expect(rows[1]).toHaveTextContent('2.A ↔ B10 %1 correspondence');
  });

  it('opens a pair with a result', () => {
    const onOpen = vi.fn();
    render(<OverlapPairList names={names} onOpen={onOpen} pairs={[pair('A', 'B', done(20), direction('cancelled'))]} />);
    const row = screen.getByRole('button', { name: 'A ↔ B: 20 % overlap, open details' });
    expect(row).toHaveTextContent('one direction only');
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith('mm:A|mm:B');
  });

  it('shows why a pair has no value and does not open it', () => {
    const onOpen = vi.fn();
    render(<OverlapPairList names={names} onOpen={onOpen} pairs={[
      pair('A', 'B', direction('failed', 'B: the file is not valid XML'), direction('failed', 'B: the file is not valid XML')),
      pair('C', 'D', direction('cancelled'), direction('cancelled')),
      pair('A', 'D', direction('running'), direction('pending')),
    ]} />);
    const failed = screen.getByRole('button', { name: 'A ↔ B: failed' });
    expect(failed).toHaveTextContent('B: the file is not valid XML');
    expect(failed).toBeDisabled();
    expect(screen.getByRole('button', { name: 'C ↔ D: not analysed' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'A ↔ D: analysing…' })).toBeDisabled();
    fireEvent.click(failed);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
