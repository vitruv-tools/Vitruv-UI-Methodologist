import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProjectsView } from '../../../components/ui/ProjectsView';
import * as apiModule from '../../../services/api';

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<any>('react-router-dom')),
  useNavigate: () => vi.fn(),
}));

vi.mock('../../../services/api', () => ({
  apiService: {
    getVsumsPaginated: vi.fn(),
    getRemovedVsumsPaginated: vi.fn(),
    deleteVsum: vi.fn(),
    recoverVsum: vi.fn(),
    deleteVsumPermanently: vi.fn(),
  },
}));

vi.mock('../../../components/ui/CreateVsumModal', () => ({
  CreateVsumModal: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="create-modal">
        <button onClick={onClose}>Close modal</button>
      </div>
    ) : null,
}));

vi.mock('../../../components/ui/VsumDetailsModal', () => ({
  VsumDetailsModal: ({ isOpen }: any) =>
    isOpen ? <div data-testid="details-modal" /> : null,
}));

vi.mock('../../../components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({ isOpen, title, message, onConfirm, onCancel }: any) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <div data-testid="confirm-title">{title}</div>
        <div data-testid="confirm-message">{message}</div>
        <button data-testid="confirm-btn" onClick={onConfirm}>
          Confirm
        </button>
        <button data-testid="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

const { apiService } = (apiModule as any);

type VsumListResponse = { data: unknown[] };

let resolveVsums: ((value: VsumListResponse) => void) | undefined;
let rejectVsums: ((reason?: unknown) => void) | undefined;
let resolveRemoved: ((value: VsumListResponse) => void) | undefined;

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
  vi.clearAllMocks();
  apiService.getVsumsPaginated.mockImplementation(
    () => new Promise((resolve, reject) => {
      resolveVsums = resolve;
      rejectVsums = reject;
    }),
  );
  apiService.getRemovedVsumsPaginated.mockImplementation(
    () => new Promise(resolve => { resolveRemoved = resolve; }),
  );
});

async function settleVsums(data: unknown[] = []) {
  await act(async () => {
    resolveVsums?.({ data });
    await Promise.resolve();
  });
}

async function rejectVsumsLoad(error: Error) {
  await act(async () => {
    rejectVsums?.(error);
    await Promise.resolve();
  });
}

async function settleRemoved(data: unknown[] = []) {
  await act(async () => {
    resolveRemoved?.({ data });
    await Promise.resolve();
  });
}

const renderView = () =>
  render(
    <MemoryRouter>
      <ProjectsView />
    </MemoryRouter>
  );

async function renderProjectsView() {
  renderView();
  await settleVsums();
  expect(screen.getByText('No projects yet')).toBeInTheDocument();
}

describe('ProjectsView real component', () => {
  it('renders "Workbench / Projects" heading', async () => {
    await renderProjectsView();
    expect(screen.getByText('Workbench / Projects')).toBeInTheDocument();
  });

  it('renders "New project" button', async () => {
    await renderProjectsView();
    expect(screen.getByText('New project')).toBeInTheDocument();
  });

  it('getVsumsPaginated is called on mount', async () => {
    await renderProjectsView();
    expect(apiService.getVsumsPaginated).toHaveBeenCalled();
  });

  it('clicking "New project" opens the CreateVsumModal', async () => {
    await renderProjectsView();
    fireEvent.click(screen.getByText('New project'));
    expect(screen.getByTestId('create-modal')).toBeInTheDocument();
  });

  it('closing the modal hides it', async () => {
    await renderProjectsView();
    fireEvent.click(screen.getByText('New project'));
    expect(screen.getByTestId('create-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close modal'));
    expect(screen.queryByTestId('create-modal')).not.toBeInTheDocument();
  });

  it('search input exists with placeholder "Search projects..."', async () => {
    await renderProjectsView();
    expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
  });

  it('typing in search input updates the value', async () => {
    await renderProjectsView();
    const input = screen.getByPlaceholderText('Search projects...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(input.value).toBe('hello');
  });

  it('pressing Enter in search input triggers getVsumsPaginated again', async () => {
    await renderProjectsView();
    expect(apiService.getVsumsPaginated).toHaveBeenCalledTimes(1);
    const input = screen.getByPlaceholderText('Search projects...');
    fireEvent.keyDown(input, { key: 'Enter' });
    await settleVsums();
    expect(apiService.getVsumsPaginated).toHaveBeenCalledTimes(2);
  });

  it('"Deleted projects" button switches view and calls getRemovedVsumsPaginated', async () => {
    await renderProjectsView();
    fireEvent.click(screen.getByText('Deleted projects'));
    await settleRemoved();
    expect(apiService.getRemovedVsumsPaginated).toHaveBeenCalled();
    expect(screen.getByText('No deleted projects')).toBeInTheDocument();
  });

  it('when getVsumsPaginated returns items, they appear in the table', async () => {
    renderView();
    await settleVsums([mockVsum, mockVsum2]);
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('Second Project')).toBeInTheDocument();
  });

  it('when getVsumsPaginated rejects, error message is shown', async () => {
    renderView();
    await rejectVsumsLoad(new Error('Server error'));
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  it('"My projects" tab is initially selected (font weight 600)', async () => {
    await renderProjectsView();
    const activeBtn = screen.getByRole('button', { name: 'My projects' });
    expect(activeBtn).toBeInTheDocument();
    expect(activeBtn).toHaveStyle({ fontWeight: 600 });
  });

  it('opens details modal when Details is chosen from row menu', async () => {
    renderView();
    await settleVsums([{ ...mockVsum, role: 'OWNER' }]);
    expect(screen.getByText('Test Project')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Details' }));

    expect(screen.getByTestId('details-modal')).toBeInTheDocument();
  });

  describe('permanent delete from the trash', () => {
    const trashedVsum = {
      id: 7,
      name: 'Trashed Project',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      removedAt: new Date().toISOString(),
    };

    async function openTrashWithProject() {
      await renderProjectsView();
      fireEvent.click(screen.getByText('Deleted projects'));
      await settleRemoved([trashedVsum]);
      expect(screen.getByText('Trashed Project')).toBeInTheDocument();
    }

    const clickDeletePermanently = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));

    const confirmDelete = async () => {
      await act(async () => {
        fireEvent.click(screen.getByTestId('confirm-btn'));
        await Promise.resolve();
      });
    };

    it('asks for confirmation and does not call the API before it is given', async () => {
      await openTrashWithProject();

      clickDeletePermanently();

      expect(screen.getByTestId('confirm-title')).toHaveTextContent('Delete permanently');
      expect(screen.getByTestId('confirm-message')).toHaveTextContent('cannot be undone');
      expect(apiService.deleteVsumPermanently).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('cancel-btn'));

      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
      expect(apiService.deleteVsumPermanently).not.toHaveBeenCalled();
      expect(screen.getByText('Trashed Project')).toBeInTheDocument();
    });

    it('deletes the project permanently and removes it from the trash list', async () => {
      apiService.deleteVsumPermanently.mockResolvedValue({ data: {} });
      await openTrashWithProject();

      clickDeletePermanently();
      await confirmDelete();

      expect(apiService.deleteVsumPermanently).toHaveBeenCalledTimes(1);
      expect(apiService.deleteVsumPermanently).toHaveBeenCalledWith(7);
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();

      // The trash list is reloaded and no longer contains the project.
      expect(apiService.getRemovedVsumsPaginated).toHaveBeenCalledTimes(2);
      await settleRemoved([]);
      expect(screen.queryByText('Trashed Project')).not.toBeInTheDocument();
      expect(screen.getByText('No deleted projects')).toBeInTheDocument();
    });

    it('shows the backend error and keeps the project when the delete fails', async () => {
      apiService.deleteVsumPermanently.mockRejectedValue(new Error('Vsum id not found'));
      await openTrashWithProject();

      clickDeletePermanently();
      await confirmDelete();

      expect(screen.getByTestId('confirm-message')).toHaveTextContent('Vsum id not found');
      expect(apiService.getRemovedVsumsPaginated).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Trashed Project')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('cancel-btn'));

      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });
  });
});
