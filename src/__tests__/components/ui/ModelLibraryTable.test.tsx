import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ModelDetailModal, ModelLibraryTable } from '../../../components/ui/ModelLibraryTable';

jest.mock('../../../services/api', () => ({
  apiService: {
    findMetaModels: jest.fn(),
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
  apiService: { findMetaModels: jest.Mock };
};

const existingModel = { id: 1, name: 'Existing Model', createdAt: new Date().toISOString(), ecoreFileId: 1, genModelFileId: 1 };
const newModel = { id: 2, name: 'New Model', createdAt: new Date().toISOString(), ecoreFileId: 5, genModelFileId: 6 };

describe('ModelLibraryTable', () => {
  beforeEach(() => {
    apiService.findMetaModels.mockReset();
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
});
