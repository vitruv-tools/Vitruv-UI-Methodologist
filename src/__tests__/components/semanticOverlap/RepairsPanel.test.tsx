import React from 'react';
import { render, screen } from '@testing-library/react';
import { RepairsPanel } from '../../../components/semanticOverlap/RepairsPanel';
import type { RepairRecord } from '../../../utils/semanticOverlap/types';

const repair: RepairRecord = {
  rule: 'opposite', reason: 'X.owner and X.parts are opposites, but their counterparts are not',
  removed: { level: 'feature', sources: ['a.X.owner'], targets: ['b.Y.items'], score: 0.27 },
  kept: { level: 'feature', sources: ['a.X.parts'], targets: ['b.Y.items'], score: 0.55 },
};

describe('RepairsPanel', () => {
  it('lists each repair with its rule, the removed and kept correspondence and the reason', () => {
    render(<RepairsPanel repairs={[repair]} />);
    const panel = screen.getByRole('region', { name: 'Consistency repairs' });
    expect(panel).toHaveTextContent('Removed by consistency repair (1)');
    expect(panel).toHaveTextContent('Opposite references mapped inconsistently: removed owner ↔ items (27 %), kept parts ↔ items (55 %)');
    expect(panel).toHaveTextContent(repair.reason);
  });

  it('renders nothing without repairs', () => {
    const { container } = render(<RepairsPanel repairs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
