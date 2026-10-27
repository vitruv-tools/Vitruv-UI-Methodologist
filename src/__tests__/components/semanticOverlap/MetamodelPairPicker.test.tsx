import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MetamodelPairPicker } from '../../../components/semanticOverlap/MetamodelPairPicker';
import type { LibraryMetaModel } from '../../../utils/metaModelList';

const models: LibraryMetaModel[] = [
  { id: 1, name: 'Families', version: '1.0', ecoreFileId: 10, isOwnedByCurrentUser: true },
  { id: 2, name: 'Persons', ecoreFileId: 20, isOwnedByCurrentUser: false },
];

const renderPicker = (props: Partial<React.ComponentProps<typeof MetamodelPairPicker>> = {}) => {
  const handlers = { onSourceChange: vi.fn(), onTargetChange: vi.fn(), onSwap: vi.fn() };
  render(<MetamodelPairPicker models={models} sourceId={null} targetId={null} {...handlers} {...props} />);
  return handlers;
};

describe('MetamodelPairPicker', () => {
  it('lists own and public models in groups', () => {
    renderPicker();
    const source = screen.getByLabelText('Source metamodel');
    expect(within(source).getByRole('group', { name: 'My models' })).toHaveTextContent('Families (1.0)');
    expect(within(source).getByRole('group', { name: 'Public models' })).toHaveTextContent('Persons');
  });

  it('reports the chosen source and target', () => {
    const handlers = renderPicker();
    fireEvent.change(screen.getByLabelText('Source metamodel'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Target metamodel'), { target: { value: '2' } });
    expect(handlers.onSourceChange).toHaveBeenCalledWith(1);
    expect(handlers.onTargetChange).toHaveBeenCalledWith(2);
  });

  it('swaps source and target', () => {
    const handlers = renderPicker({ sourceId: 1, targetId: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Swap source and target' }));
    expect(handlers.onSwap).toHaveBeenCalled();
  });

  it('hints when the same metamodel is chosen twice', () => {
    renderPicker({ sourceId: 1, targetId: 1 });
    expect(screen.getByRole('note')).toHaveTextContent('same metamodel');
  });
});
