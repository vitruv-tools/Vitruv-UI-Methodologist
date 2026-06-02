import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProjectsView } from '../../../components/ui/ProjectsView';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

jest.mock('../../../services/api', () => ({
  apiService: {
    getVsumsPaginated: jest.fn(),
    getRemovedVsumsPaginated: jest.fn(),
    deleteVsum: jest.fn(),
    recoverVsum: jest.fn(),
  },
}));

jest.mock('../../../components/ui/CreateVsumModal', () => ({
  CreateVsumModal: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="create-modal">
        <button onClick={onClose}>Close modal</button>
      </div>
    ) : null,
}));

jest.mock('../../../components/ui/VsumDetailsModal', () => ({
  VsumDetailsModal: ({ isOpen }: any) =>
    isOpen ? <div data-testid="details-modal" /> : null,
}));

jest.mock('../../../components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({ isOpen, onConfirm }: any) =>
    isOpen ? (
      <button data-testid="confirm-btn" onClick={onConfirm}>
        Confirm
      </button>
    ) : null,
}));

const { apiService } = require('../../../services/api');

const mockVsum = {
  id: 1,
  name: 'Test Project',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  removedAt: null,
};

const mockVsum2 = {
  id: 2,
  name: 'Second Project',
  createdAt: '2024-01-02T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  removedAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  apiService.getVsumsPaginated.mockResolvedValue({ data: [] });
  apiService.getRemovedVsumsPaginated.mockResolvedValue({ data: [] });
});

const renderView = () =>
  render(
    <MemoryRouter>
      <ProjectsView />
    </MemoryRouter>
  );

describe('ProjectsView real component', () => {
  it('renders "Dashboard / Projects" heading', async () => {
    await act(async () => {
      renderView();
    });
    expect(screen.getByText('Dashboard / Projects')).toBeInTheDocument();
  });

  it('renders "New project" button', async () => {
    await act(async () => {
      renderView();
    });
    expect(screen.getByText('New project')).toBeInTheDocument();
  });

  it('getVsumsPaginated is called on mount', async () => {
    await act(async () => {
      renderView();
    });
    await waitFor(() => {
      expect(apiService.getVsumsPaginated).toHaveBeenCalled();
    });
  });

  it('clicking "New project" opens the CreateVsumModal', async () => {
    await act(async () => {
      renderView();
    });
    fireEvent.click(screen.getByText('New project'));
    expect(screen.getByTestId('create-modal')).toBeInTheDocument();
  });

  it('closing the modal hides it', async () => {
    await act(async () => {
      renderView();
    });
    fireEvent.click(screen.getByText('New project'));
    expect(screen.getByTestId('create-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close modal'));
    expect(screen.queryByTestId('create-modal')).not.toBeInTheDocument();
  });

  it('search input exists with placeholder "Search projects..."', async () => {
    await act(async () => {
      renderView();
    });
    expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
  });

  it('typing in search input updates the value', async () => {
    await act(async () => {
      renderView();
    });
    const input = screen.getByPlaceholderText('Search projects...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(input.value).toBe('hello');
  });

  it('pressing Enter in search input triggers getVsumsPaginated again', async () => {
    await act(async () => {
      renderView();
    });
    await waitFor(() => {
      expect(apiService.getVsumsPaginated).toHaveBeenCalledTimes(1);
    });
    const input = screen.getByPlaceholderText('Search projects...');
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await waitFor(() => {
      expect(apiService.getVsumsPaginated).toHaveBeenCalledTimes(2);
    });
  });

  it('"Deleted projects" button switches view and calls getRemovedVsumsPaginated', async () => {
    await act(async () => {
      renderView();
    });
    fireEvent.click(screen.getByText('Deleted projects'));
    await waitFor(() => {
      expect(apiService.getRemovedVsumsPaginated).toHaveBeenCalled();
    });
  });

  it('when getVsumsPaginated returns items, they appear in the table', async () => {
    apiService.getVsumsPaginated.mockResolvedValue({ data: [mockVsum, mockVsum2] });
    await act(async () => {
      renderView();
    });
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
      expect(screen.getByText('Second Project')).toBeInTheDocument();
    });
  });

  it('when getVsumsPaginated rejects, error message is shown', async () => {
    apiService.getVsumsPaginated.mockRejectedValue(new Error('Server error'));
    await act(async () => {
      renderView();
    });
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('"Active projects" tab is initially selected (font weight 600)', async () => {
    await act(async () => {
      renderView();
    });
    const activeBtn = screen.getByText('Active projects');
    expect(activeBtn).toBeInTheDocument();
    // Active tab has fontWeight 600, inactive has 400
    expect(activeBtn).toHaveStyle({ fontWeight: 600 });
  });
});
