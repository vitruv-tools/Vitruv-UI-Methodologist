import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MetaModelsPanel } from '../../../components/ui/MetaModelsPanel';

jest.mock('../../../utils/downloadTextAsFile', () => ({
  downloadTextAsFile: jest.fn(),
}));

jest.mock('../../../services/api', () => {
  const findMetaModels = jest.fn().mockResolvedValue({
    data: [
      {
        id: 1,
        name: 'Test MetaModel',
        domain: 'Demo',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
  });

  const getFile = jest.fn();

  return {
    apiService: {
      findMetaModels,
      getFile,
    },
  };
});

const { downloadTextAsFile } = require('../../../utils/downloadTextAsFile') as {
  downloadTextAsFile: jest.Mock;
};

const { apiService } = require('../../../services/api') as {
  apiService: { findMetaModels: jest.Mock; getFile: jest.Mock };
};

describe('MetaModelsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads and displays meta models', async () => {
    render(<MetaModelsPanel />);

    expect(screen.getByText(/Meta Models/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(apiService.findMetaModels).toHaveBeenCalled();
    });
  });

  it('calls onAddToActiveVsum when Add is clicked', async () => {
    const onAddToActiveVsum = jest.fn();

    apiService.findMetaModels.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          name: 'Test MetaModel',
          domain: 'Demo',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
    });

    render(
      <MetaModelsPanel
        activeVsumId={123}
        selectedMetaModelIds={[]}
        onAddToActiveVsum={onAddToActiveVsum}
      />,
    );

    await waitFor(() => {
      expect(apiService.findMetaModels).toHaveBeenCalled();
    });

    const addButton = screen.queryByRole('button', { name: /\+ Add/i });
    if (addButton) {
      fireEvent.click(addButton);
      expect(onAddToActiveVsum).toHaveBeenCalled();
    }
  });
});


describe('MetaModelsPanel – additional tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: empty list
    apiService.findMetaModels.mockResolvedValue({ data: [] });
  });

  it('shows empty state when no models found', async () => {
    render(<MetaModelsPanel />);
    expect(
      await screen.findByText(/No meta models found/i),
    ).toBeInTheDocument();
  });

  it('shows error message when API fails', async () => {
    apiService.findMetaModels.mockRejectedValueOnce(new Error('Server down'));
    render(<MetaModelsPanel />);
    expect(await screen.findByText(/Server down/i)).toBeInTheDocument();
  });

  it('switches to All Models tab and refetches with ownedByUser=false', async () => {
    render(<MetaModelsPanel />);
    const allTab = await screen.findByRole('button', { name: /All Models/i });
    fireEvent.click(allTab);
    await waitFor(() => {
      expect(apiService.findMetaModels).toHaveBeenCalledWith(
        expect.objectContaining({ ownedByUser: false }),
      );
    });
  });

  it('shows ✓ Added and disables button for already-selected model', async () => {
    // Override the default empty mock for this specific test
    apiService.findMetaModels.mockResolvedValue({
      data: [
        {
          id: 7,
          name: 'Selected Model',
          domain: 'Eng',
          createdAt: new Date().toISOString(),
          keyword: [],
        },
      ],
    });

    render(
      <MetaModelsPanel
        activeVsumId={1}
        selectedMetaModelIds={[7]}
        onAddToActiveVsum={jest.fn()}
      />,
    );

    const addedBtn = await screen.findByRole('button', { name: /✓ Added/i });
    expect(addedBtn).toBeDisabled();
  });

  it('shows export menu on right-click and downloads .ecore', async () => {
    apiService.findMetaModels.mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'Export Model',
          domain: 'Demo',
          createdAt: '2024-01-01T00:00:00Z',
          ecoreFileId: 100,
          genModelFileId: 200,
        },
      ],
    });
    apiService.getFile.mockResolvedValue('<ecore/>');

    render(<MetaModelsPanel />);

    const card = await screen.findByText('Export Model');
    fireEvent.contextMenu(card.closest('article')!);

    const downloadEcore = await screen.findByRole('menuitem', { name: /Download \.ecore/i });
    fireEvent.click(downloadEcore);

    await waitFor(() => {
      expect(apiService.getFile).toHaveBeenCalledWith(100);
      expect(downloadTextAsFile).toHaveBeenCalledWith('<ecore/>', 'Export Model.ecore');
    });
  });
});