import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LinkMetaModelsPanel } from '../../../components/ui/LinkMetaModelsPanel';
import { VsumMetaModelRef, VsumMetaModelRelation } from '../../../types';

jest.mock('../../../services/api', () => ({
  apiService: {
    findMetaModels: jest.fn(),
    uploadFile: jest.fn(),
    syncVsumChanges: jest.fn(),
  },
}));

const { apiService } = require('../../../services/api') as {
  apiService: {
    findMetaModels: jest.Mock;
    uploadFile: jest.Mock;
    syncVsumChanges: jest.Mock;
  };
};

const existingMetaModels: VsumMetaModelRef[] = [
  {
    id: 101,
    sourceId: 2,
    name: 'System Infrastructure Demo',
    description: '',
    domain: 'Infrastructure',
    keyword: [],
    createdAt: '',
    updatedAt: '',
    ecoreFileId: 1,
    genModelFileId: 2,
  },
  {
    id: 102,
    sourceId: 5,
    name: 'Vitruv CLI Model2',
    description: '',
    domain: 'Entities',
    keyword: [],
    createdAt: '',
    updatedAt: '',
    ecoreFileId: 3,
    genModelFileId: 4,
  },
];

const existingRelations: VsumMetaModelRelation[] = [
  { id: 1, sourceId: 2, targetId: 5, reactionFileStorageId: 35 },
];

const catalogMetaModels = [
  { id: 2, name: 'System Infrastructure Demo' },
  { id: 5, name: 'Vitruv CLI Model2' },
  { id: 4, name: 'Vitruv CLI Model' },
];

const reactionsFile = new File(['reactions: x in reaction to changes in a execute actions in b'], 'x.reactions');

const waitForOptionsLoaded = async () => {
  await waitFor(() => {
    const [sourceSelect] = screen.getAllByRole('combobox');
    expect(sourceSelect.querySelectorAll('option').length).toBeGreaterThan(1);
  });
};

describe('LinkMetaModelsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiService.findMetaModels.mockResolvedValue({ data: catalogMetaModels, message: null });
  });

  it('renders existing relations resolved through sourceId, not the vsum-scoped clone id', () => {
    render(
      <LinkMetaModelsPanel
        vsumId={1}
        existingMetaModels={existingMetaModels}
        existingRelations={existingRelations}
        onLinked={jest.fn()}
      />,
    );

    expect(screen.getByText('System Infrastructure Demo')).toBeInTheDocument();
    expect(screen.getByText('Vitruv CLI Model2')).toBeInTheDocument();
    expect(screen.getByText('reactions linked')).toBeInTheDocument();
  });

  it('renders nothing extra when there are no existing relations', () => {
    render(
      <LinkMetaModelsPanel
        vsumId={1}
        existingMetaModels={[]}
        existingRelations={[]}
        onLinked={jest.fn()}
      />,
    );

    expect(screen.queryByText('Meta Model Relations')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Link Meta Models' })).toBeInTheDocument();
  });

  it('opens the form and loads catalog meta models on demand', async () => {
    render(
      <LinkMetaModelsPanel
        vsumId={1}
        existingMetaModels={existingMetaModels}
        existingRelations={existingRelations}
        onLinked={jest.fn()}
      />,
    );

    expect(apiService.findMetaModels).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '+ Link Meta Models' }));

    await waitFor(() => expect(apiService.findMetaModels).toHaveBeenCalled());
    await waitForOptionsLoaded();
  });

  it('shows a validation error when submitting without selecting both meta models', async () => {
    render(
      <LinkMetaModelsPanel
        vsumId={1}
        existingMetaModels={existingMetaModels}
        existingRelations={existingRelations}
        onLinked={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '+ Link Meta Models' }));
    await waitForOptionsLoaded();

    fireEvent.click(screen.getByRole('button', { name: 'Link' }));

    expect(
      await screen.findByText('Please select both a source and a target meta model.'),
    ).toBeInTheDocument();
    expect(apiService.uploadFile).not.toHaveBeenCalled();
  });

  it('shows a validation error when source and target are the same meta model', async () => {
    render(
      <LinkMetaModelsPanel
        vsumId={1}
        existingMetaModels={existingMetaModels}
        existingRelations={existingRelations}
        onLinked={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '+ Link Meta Models' }));
    await waitForOptionsLoaded();

    const [sourceSelect, targetSelect] = screen.getAllByRole('combobox');
    fireEvent.change(sourceSelect, { target: { value: '4' } });
    fireEvent.change(targetSelect, { target: { value: '4' } });

    fireEvent.click(screen.getByRole('button', { name: 'Link' }));

    expect(
      await screen.findByText('Source and target meta models must be different.'),
    ).toBeInTheDocument();
    expect(apiService.uploadFile).not.toHaveBeenCalled();
  });

  it('uploads the reactions file and merges the new relation with the existing ones on submit', async () => {
    apiService.uploadFile.mockResolvedValue({ data: { id: 99 }, message: 'ok' });
    apiService.syncVsumChanges.mockResolvedValue({ data: null, message: 'ok' });
    const onLinked = jest.fn();

    render(
      <LinkMetaModelsPanel
        vsumId={1}
        existingMetaModels={existingMetaModels}
        existingRelations={existingRelations}
        onLinked={onLinked}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '+ Link Meta Models' }));
    await waitForOptionsLoaded();

    const [sourceSelect, targetSelect] = screen.getAllByRole('combobox');
    fireEvent.change(sourceSelect, { target: { value: '2' } });
    fireEvent.change(targetSelect, { target: { value: '4' } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [reactionsFile] } });

    fireEvent.click(screen.getByRole('button', { name: 'Link' }));

    await waitFor(() => expect(onLinked).toHaveBeenCalled());

    expect(apiService.uploadFile).toHaveBeenCalledWith(reactionsFile, 'REACTION');
    expect(apiService.syncVsumChanges).toHaveBeenCalledWith(1, {
      metaModelIds: [2, 5, 4],
      metaModelRelationRequests: [
        { sourceId: 2, targetId: 5, reactionFileId: 35 },
        { sourceId: 2, targetId: 4, reactionFileId: 99 },
      ],
    });
  });

  it('surfaces an error and does not call onLinked when the sync request fails', async () => {
    apiService.uploadFile.mockResolvedValue({ data: { id: 99 }, message: 'ok' });
    apiService.syncVsumChanges.mockRejectedValue(new Error('MetaModel Ids not found in this VSUM'));
    const onLinked = jest.fn();

    render(
      <LinkMetaModelsPanel
        vsumId={1}
        existingMetaModels={existingMetaModels}
        existingRelations={existingRelations}
        onLinked={onLinked}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '+ Link Meta Models' }));
    await waitForOptionsLoaded();

    const [sourceSelect, targetSelect] = screen.getAllByRole('combobox');
    fireEvent.change(sourceSelect, { target: { value: '2' } });
    fireEvent.change(targetSelect, { target: { value: '4' } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [reactionsFile] } });

    fireEvent.click(screen.getByRole('button', { name: 'Link' }));

    expect(
      await screen.findByText('MetaModel Ids not found in this VSUM'),
    ).toBeInTheDocument();
    expect(onLinked).not.toHaveBeenCalled();
  });

  it('cancel hides the form and resets its state', async () => {
    render(
      <LinkMetaModelsPanel
        vsumId={1}
        existingMetaModels={existingMetaModels}
        existingRelations={existingRelations}
        onLinked={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '+ Link Meta Models' }));
    await waitForOptionsLoaded();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('button', { name: 'Link' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Link Meta Models' })).toBeInTheDocument();
  });
});
