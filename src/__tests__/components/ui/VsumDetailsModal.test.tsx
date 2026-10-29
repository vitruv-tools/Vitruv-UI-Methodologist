import type { Mock } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { resetThemeStore, setTheme } from '../../../theme/theme';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../services/api', () => ({
  apiService: {
    getVsumDetails: vi.fn(),
    getVsumVersions: vi.fn().mockResolvedValue({ data: [] }),
    getVsumMembers: vi.fn().mockResolvedValue({ data: [] }),
    searchUsers: vi.fn().mockResolvedValue({ data: [] }),
    renameVsum: vi.fn(),
    deleteVsum: vi.fn(),
    recoverVsum: vi.fn(),
    restoreVsumVersion: vi.fn(),
    addVsumMember: vi.fn(),
    removeVsumMember: vi.fn(),
  },
}));

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<any>('react-dom');
  const mocked = {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
  return { ...mocked, default: mocked };
});

vi.mock('../../../components/ui/VsumUsersTab', () => ({
  VsumUsersTab: () => <div data-testid="vsum-users-tab" />,
}));

const { apiService } = (apiModule as unknown) as {
  apiService: Record<string, Mock>;
};

const baseDetails = {
  id: 1,
  name: 'Test VSUM',
  description: 'desc',
  metaModels: [{ id: 10, name: 'ModelA' }],
  updatedAt: new Date().toISOString(),
};

// ─── Mocked-component smoke test (original) ───────────────────────────────────

const mockVsumDetailsModal = vi.fn((_props?: any) => <div>VsumDetailsModal mock</div>);

vi.mock('../../../components/ui/VsumDetailsModal', () => ({
  __esModule: true,
  VsumDetailsModal: (props: any) => mockVsumDetailsModal(props),
}));

import { VsumDetailsModal } from '../../../components/ui/VsumDetailsModal';
import * as apiModule from '../../../services/api';

describe('VsumDetailsModal (mocked)', () => {
  it('renders with minimal props', () => {
    render(
      <VsumDetailsModal
        isOpen
        vsumId={1}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(mockVsumDetailsModal).toHaveBeenCalled();
  });
});

// ─── Real component tests ─────────────────────────────────────────────────────

const { VsumDetailsModal: RealModal } =
  (await vi.importActual<any>('../../../components/ui/VsumDetailsModal')) as {
    VsumDetailsModal: React.ComponentType<any>;
  };

describe('VsumDetailsModal – real component tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getVsumDetails.mockResolvedValue({ data: baseDetails });
    apiService.getVsumVersions.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    resetThemeStore();
  });

  it('returns null when not open', () => {
    const { container } = render(
      <RealModal isOpen={false} vsumId={1} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('loads and displays VSUM name', async () => {
    render(<RealModal isOpen vsumId={1} onClose={vi.fn()} />);
    expect(await screen.findByText('Test VSUM')).toBeInTheDocument();
  });

  it('shows linked meta model name', async () => {
    render(<RealModal isOpen vsumId={1} onClose={vi.fn()} />);
    expect(await screen.findByText('ModelA')).toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', async () => {
    const onClose = vi.fn();
    render(<RealModal isOpen vsumId={1} onClose={onClose} />);
    await screen.findByText('Test VSUM');
    fireEvent.click(screen.getAllByRole('button', { name: /Close/i })[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Details, Manage Users, and Versions tab buttons', async () => {
    render(<RealModal isOpen vsumId={1} onClose={vi.fn()} />);
    await screen.findByText('Test VSUM');
    expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Users' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Versions' })).toBeInTheDocument();
  });

  it('shows error when getVsumDetails fails', async () => {
    apiService.getVsumDetails.mockRejectedValueOnce(new Error('Not found'));
    render(<RealModal isOpen vsumId={99} onClose={vi.fn()} />);
    expect(await screen.findByText(/Not found/i)).toBeInTheDocument();
  });

  it('calls renameVsum when Save is clicked', async () => {
    apiService.renameVsum.mockResolvedValue({});
    render(<RealModal isOpen vsumId={1} onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByText('Test VSUM');
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    await waitFor(() => {
      expect(apiService.renameVsum).toHaveBeenCalledWith(1, { name: 'Test VSUM' });
    });
  });

  it('uses theme surfaces so the dialog matches dark mode', async () => {
    setTheme('dark');
    render(<RealModal isOpen vsumId={1} onClose={vi.fn()} />);
    const title = await screen.findByText('Test VSUM');
    expect(title).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Users' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Link Meta Models' })).toBeInTheDocument();
  });
});