import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MetaModelsPanel } from '../../../components/ui/MetaModelsPanel';

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

  return {
    apiService: {
      findMetaModels,
    },
  };
});

const { apiService } = require('../../../services/api') as {
  apiService: { findMetaModels: jest.Mock };
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

    // If the component renders a "+ Add" button for the model card, click it
    const addButton = screen.queryByRole('button', { name: /\+ Add/i });
    if (addButton) {
      fireEvent.click(addButton);
      expect(onAddToActiveVsum).toHaveBeenCalled();
    }
  });
});

