import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DrawerModel } from '../../../components/canvas/ModelDrawer';
import { ModelDrawerModal } from '../../../components/canvas/ModelDrawerModal';

interface MockModelDrawerProps {
  models: DrawerModel[];
  addedModelIds: Set<number>;
  loading: boolean;
  myLibraryModels: DrawerModel[];
  publicLibraryModels: DrawerModel[];
  onClose: () => void;
  onAddModel: (model: DrawerModel) => void;
  onDeleteModel?: (model: DrawerModel) => Promise<void>;
  onFetchFile: (fileId: number) => Promise<string>;
}

jest.mock('../../../components/canvas/ModelDrawer', () => {
  const { createElement } = require('react');
  return {
    ModelDrawer: ({
      models,
      addedModelIds,
      loading,
      myLibraryModels,
      publicLibraryModels,
      onClose,
      onAddModel,
      onDeleteModel,
      onFetchFile,
    }: MockModelDrawerProps) =>
      createElement(
        'div',
        null,
        createElement('span', null, 'Model drawer content'),
        createElement('span', null, models[0]?.name),
        createElement('span', null, myLibraryModels[0]?.name),
        createElement('span', null, publicLibraryModels[0]?.name),
        createElement('span', null, loading ? 'Loading' : 'Ready'),
        createElement('span', null, addedModelIds.has(models[0]?.id) ? 'Added' : 'Available'),
        createElement('button', { type: 'button', onClick: onClose }, 'Close drawer'),
        createElement(
          'button',
          { type: 'button', onClick: () => onAddModel(models[0]) },
          'Add model',
        ),
        createElement(
          'button',
          { type: 'button', onClick: () => onDeleteModel?.(models[0]) },
          'Delete model',
        ),
        createElement(
          'button',
          { type: 'button', onClick: () => onFetchFile(7) },
          'Fetch file',
        ),
      ),
  };
});

const model: DrawerModel = { id: 1, name: 'Car Model' };
const myLibraryModel: DrawerModel = { id: 2, name: 'My Library Model' };
const publicLibraryModel: DrawerModel = { id: 3, name: 'Public Library Model' };

const createProps = () => ({
  models: [model],
  addedModelIds: new Set<number>(),
  loading: false,
  myLibraryModels: [myLibraryModel],
  publicLibraryModels: [publicLibraryModel],
  onClose: jest.fn(),
  onAddModel: jest.fn(),
  onDeleteModel: jest.fn().mockResolvedValue(undefined),
  onFetchFile: jest.fn().mockResolvedValue('<ecore />'),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ModelDrawerModal', () => {
  it('mounts ModelDrawer content through a portal into the document body', () => {
    render(<ModelDrawerModal {...createProps()} />);

    expect(screen.getByText('Model drawer content')).toBeInTheDocument();
    expect(screen.getByText('Car Model')).toBeInTheDocument();
    expect(screen.getByText('My Library Model')).toBeInTheDocument();
    expect(screen.getByText('Public Library Model')).toBeInTheDocument();
  });

  it('invokes onClose when the backdrop is clicked', () => {
    const props = createProps();
    render(<ModelDrawerModal {...props} />);

    fireEvent.click(screen.getByRole('button', { hidden: true, name: '' }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('forwards drawer data and callbacks', () => {
    const props = createProps();
    render(<ModelDrawerModal {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add model' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete model' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fetch file' }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onAddModel).toHaveBeenCalledWith(model);
    expect(props.onDeleteModel).toHaveBeenCalledWith(model);
    expect(props.onFetchFile).toHaveBeenCalledWith(7);
  });
});
