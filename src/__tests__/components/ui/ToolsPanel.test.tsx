import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToolsPanel } from '../../../components/ui/ToolsPanel';

jest.mock('../../../services/api', () => ({
  apiService: {
    findMetaModels: jest.fn().mockResolvedValue({ data: [] }),
    deleteMetaModel: jest.fn().mockResolvedValue({ data: {}, message: 'Deleted' }),
    getMetaModel: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

jest.mock('../../../components/ui/CreateModelModal', () => ({
  CreateModelModal: ({ isOpen }: any) =>
    isOpen ? <div data-testid="create-model-modal" /> : null,
}));

jest.mock('../../../components/ui/KeywordTagsInput', () => ({
  KeywordTagsInput: () => <div data-testid="keyword-tags-input" />,
}));

const { apiService } = require('../../../services/api') as {
  apiService: {
    findMetaModels: jest.Mock;
    deleteMetaModel: jest.Mock;
    getMetaModel: jest.Mock;
  };
};

describe('ToolsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and Import Meta Model button', () => {
    render(<ToolsPanel suppressApi />);

    expect(screen.getByText(/Meta Models/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Import Meta Model/i }),
    ).toBeInTheDocument();
  });

  it('opens CreateModelModal when Import Meta Model is clicked', () => {
    render(<ToolsPanel suppressApi />);

    fireEvent.click(
      screen.getByRole('button', { name: /Import Meta Model/i }),
    );

    expect(screen.getByTestId('create-model-modal')).toBeInTheDocument();
  });

  it('fetches meta models from API when not suppressed', async () => {
    apiService.findMetaModels.mockResolvedValueOnce({
      data: [],
    });

    render(<ToolsPanel />);

    await waitFor(() => {
      expect(apiService.findMetaModels).toHaveBeenCalled();
    });
  });
});

