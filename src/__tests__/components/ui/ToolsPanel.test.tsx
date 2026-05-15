import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToolsPanel } from '../../../components/ui/ToolsPanel';

jest.mock('../../../utils/downloadTextAsFile', () => ({
  downloadTextAsFile: jest.fn(),
}));

jest.mock('../../../services/api', () => ({
  apiService: {
    findMetaModels: jest.fn().mockResolvedValue({ data: [] }),
    deleteMetaModel: jest.fn().mockResolvedValue({ data: {}, message: 'Deleted' }),
    getMetaModel: jest.fn().mockResolvedValue({ data: {} }),
    getFile: jest.fn(),
  },
}));

jest.mock('../../../components/ui/CreateModelModal', () => ({
  CreateModelModal: ({ isOpen }: any) =>
    isOpen ? <div data-testid="create-model-modal" /> : null,
}));

jest.mock('../../../components/ui/KeywordTagsInput', () => ({
  KeywordTagsInput: () => <div data-testid="keyword-tags-input" />,
}));

const { downloadTextAsFile } = require('../../../utils/downloadTextAsFile') as {
  downloadTextAsFile: jest.Mock;
};

const { apiService } = require('../../../services/api') as {
  apiService: {
    findMetaModels: jest.Mock;
    deleteMetaModel: jest.Mock;
    getMetaModel: jest.Mock;
    getFile: jest.Mock;
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
    apiService.findMetaModels.mockResolvedValueOnce({ data: [] });

    render(<ToolsPanel />);

    await waitFor(() => {
      expect(apiService.findMetaModels).toHaveBeenCalled();
    });
  });
});


describe('ToolsPanel – additional tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiService.findMetaModels.mockResolvedValue({ data: [] });
  });

  it('renders My Models and All Models tabs when not suppressApi', async () => {
    render(<ToolsPanel />);
    expect(await screen.findByRole('button', { name: /My Models/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All Models/i })).toBeInTheDocument();
  });

  it('shows empty state when no models', async () => {
    render(<ToolsPanel />);
    expect(
      await screen.findByText(/No Meta Models Found/i),
    ).toBeInTheDocument();
  });

  it('renders model cards when API returns data', async () => {
    apiService.findMetaModels.mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'Ecore Model',
          domain: 'Auto',
          createdAt: new Date().toISOString(),
          keyword: [],
        },
      ],
    });
    render(<ToolsPanel />);
    expect(await screen.findByText(/Ecore Model/i)).toBeInTheDocument();
  });

  it('uses custom title prop', async () => {
    render(<ToolsPanel suppressApi title="Custom Panel Title" />);
    expect(await screen.findByText('Custom Panel Title')).toBeInTheDocument();
  });

  it('shows API error message', async () => {
    apiService.findMetaModels.mockRejectedValueOnce(new Error('Fetch error'));
    render(<ToolsPanel />);
    expect(await screen.findByText(/Fetch error/i)).toBeInTheDocument();
  });

  it('shows export menu on right-click and downloads .genmodel', async () => {
    apiService.findMetaModels.mockResolvedValue({
      data: [
        {
          id: 2,
          name: 'Tools Export',
          domain: 'Auto',
          createdAt: new Date().toISOString(),
          keyword: [],
          ecoreFileId: 11,
          genModelFileId: 22,
        },
      ],
    });
    apiService.getFile.mockResolvedValue('<genmodel/>');

    render(<ToolsPanel />);

    const card = await screen.findByLabelText(/Meta model: Tools Export/i);
    fireEvent.contextMenu(card);

    const downloadGen = await screen.findByRole('menuitem', { name: /Download \.genmodel/i });
    fireEvent.click(downloadGen);

    await waitFor(() => {
      expect(apiService.getFile).toHaveBeenCalledWith(22);
      expect(downloadTextAsFile).toHaveBeenCalledWith('<genmodel/>', 'Tools Export.genmodel');
    });
  });
});