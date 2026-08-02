import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ModelDetailModal, ModelLibraryTable } from '../../../components/ui/ModelLibraryTable';

jest.mock('../../../services/api', () => ({
  apiService: {
    findMetaModels: jest.fn(),
    deleteMetaModel: jest.fn(),
  },
}));

// Stand-in for the real import modal — exposes a single button that fires
// onSuccess with a create payload, so tests can drive ModelLibraryTable's
// post-create refresh logic without going through the whole upload form.
jest.mock('../../../components/ui/CreateModelModal', () => ({
  CreateModelModal: ({ isOpen, onSuccess }: any) =>
    isOpen ? (
      <button
        type="button"
        onClick={() => onSuccess?.({ name: 'New Model', ecoreFileId: 5, genModelFileId: 6 })}
      >
        Simulate import success
      </button>
    ) : null,
}));

const { apiService } = require('../../../services/api') as {
  apiService: { findMetaModels: jest.Mock; deleteMetaModel: jest.Mock };
};

const existingModel = { id: 1, name: 'Existing Model', createdAt: new Date().toISOString(), ecoreFileId: 1, genModelFileId: 1 };
const newModel = { id: 2, name: 'New Model', createdAt: new Date().toISOString(), ecoreFileId: 5, genModelFileId: 6 };

/** Mocks the 3 parallel find-all buckets fetchLibraryMetaModels issues: unscoped, owned, shared. */
const mockLibraryFetch = (options: { owned?: any[]; notOwned?: any[] }) => {
  const owned = options.owned ?? [];
  const notOwned = options.notOwned ?? [];
  apiService.findMetaModels
    .mockResolvedValueOnce({ data: [...owned, ...notOwned] })
    .mockResolvedValueOnce({ data: owned })
    .mockResolvedValueOnce({ data: notOwned });
};

describe('ModelLibraryTable', () => {
  beforeEach(() => {
    apiService.findMetaModels.mockReset();
    apiService.deleteMetaModel.mockReset();
    apiService.findMetaModels.mockResolvedValue({ data: [existingModel] });
  });

  it('loads the list once on mount', async () => {
    render(<ModelLibraryTable />);
    await waitFor(() => expect(screen.getByText('Existing Model')).toBeInTheDocument());
    // fetchLibraryMetaModels issues 3 parallel requests (unscoped/owned/shared)
    expect(apiService.findMetaModels).toHaveBeenCalledTimes(3);
  });

  it('does not re-fetch a second time when filters reset right after a successful import', async () => {
    render(<ModelLibraryTable />);
    await waitFor(() => expect(screen.getByText('Existing Model')).toBeInTheDocument());

    // Apply a non-default filter so the post-create clearAllFilters() below
    // actually changes state — otherwise the mount/filter-change effect
    // wouldn't re-fire at all, and the race condition couldn't be observed.
    fireEvent.click(screen.getByText('Advanced Search'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'week' } });
    await waitFor(() => expect(apiService.findMetaModels).toHaveBeenCalledTimes(6));

    apiService.findMetaModels.mockClear();
    apiService.findMetaModels.mockResolvedValue({ data: [existingModel, newModel] });

    fireEvent.click(screen.getByText('Upload model'));
    await act(async () => {
      fireEvent.click(screen.getByText('Simulate import success'));
    });

    await waitFor(() => expect(screen.getByText('New Model')).toBeInTheDocument());

    // fetchLibraryMetaModelsAfterCreate makes exactly 3 calls. If the
    // mount/filter-change effect were not skipped after clearAllFilters()
    // resets the date filter back to 'all', it would fire 3 more (stale) calls.
    expect(apiService.findMetaModels).toHaveBeenCalledTimes(3);
  });

  it('still re-fetches normally for a filter change unrelated to a create', async () => {
    render(<ModelLibraryTable />);
    await waitFor(() => expect(screen.getByText('Existing Model')).toBeInTheDocument());
    apiService.findMetaModels.mockClear();

    fireEvent.click(screen.getByText('Advanced Search'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'month' } });

    await waitFor(() => expect(apiService.findMetaModels).toHaveBeenCalledTimes(3));
  });

  it('keeps shared metadata fields in the same order when editing', () => {
    render(
      <ModelDetailModal
        model={{
          id: 1,
          name: 'Existing Model',
          description: 'A description',
          domain: 'Testing',
          keyword: ['uml'],
        }}
        onClose={jest.fn()}
        onUpdated={jest.fn()}
      />,
    );

    const name = screen.getByText('Name');
    const keywords = screen.getByText('Keywords');
    const description = screen.getByText('Description');
    expect(name.compareDocumentPosition(keywords) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(keywords.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const formLabels = Array.from(document.querySelector('form')!.querySelectorAll('label'))
      .map((label) => label.textContent);
    expect(formLabels).toEqual(['Name', 'Keywords', 'Description', 'Domain']);
  });

  describe('delete model', () => {
    it('lets the owner delete a model that is not referenced by any project', async () => {
      apiService.findMetaModels.mockReset();
      mockLibraryFetch({ owned: [existingModel] });
      apiService.deleteMetaModel.mockResolvedValue({ data: null, message: '' });

      render(<ModelLibraryTable />);
      await waitFor(() => expect(screen.getByText('Existing Model')).toBeInTheDocument());

      fireEvent.click(screen.getByLabelText('Row actions'));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
      expect(screen.getByText('Delete model')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      });

      expect(apiService.deleteMetaModel).toHaveBeenCalledWith('1');
      await waitFor(() => expect(screen.queryByText('Existing Model')).not.toBeInTheDocument());
    });

    it('does not offer a delete action for models the current user does not own', async () => {
      apiService.findMetaModels.mockReset();
      mockLibraryFetch({ notOwned: [existingModel] });

      render(<ModelLibraryTable />);
      await waitFor(() => expect(screen.getByText('Existing Model')).toBeInTheDocument());

      fireEvent.click(screen.getByLabelText('Row actions'));
      expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'View details' })).toBeInTheDocument();
    });

    it('blocks deletion up front for a model referenced by a project — only the reason and Cancel are shown', async () => {
      const referencedModel = { ...existingModel, vsums: [{ id: 99 }] };
      apiService.findMetaModels.mockReset();
      mockLibraryFetch({ owned: [referencedModel] });

      render(<ModelLibraryTable />);
      await waitFor(() => expect(screen.getByText('Existing Model')).toBeInTheDocument());

      fireEvent.click(screen.getByLabelText('Row actions'));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

      // No API call and no way to confirm — the dialog opens already blocked.
      expect(screen.getByText('This model is used by one or more projects and cannot be deleted.')).toBeInTheDocument();
      expect(apiService.deleteMetaModel).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByText('Delete model')).not.toBeInTheDocument();
      expect(screen.getByText('Existing Model')).toBeInTheDocument();
    });

    it('falls back to the same reason-only + Cancel state when the backend rejects the deletion', async () => {
      apiService.findMetaModels.mockReset();
      mockLibraryFetch({ owned: [existingModel] });
      apiService.deleteMetaModel.mockRejectedValue(new Error('Model is still referenced by a project.'));

      render(<ModelLibraryTable />);
      await waitFor(() => expect(screen.getByText('Existing Model')).toBeInTheDocument());

      fireEvent.click(screen.getByLabelText('Row actions'));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      });

      expect(screen.getByText('Model is still referenced by a project.')).toBeInTheDocument();
      expect(screen.getByText('Existing Model')).toBeInTheDocument();
      // The dialog no longer offers a "Delete" retry — only acknowledge and close.
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });
});
