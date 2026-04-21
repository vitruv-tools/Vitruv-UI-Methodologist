import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../../services/api', () => ({
  apiService: {
    getVsumDetails: jest.fn(),
    getVsumVersions: jest.fn().mockResolvedValue({ data: [] }),
    getVsumMembers: jest.fn().mockResolvedValue({ data: [] }),
    searchUsers: jest.fn().mockResolvedValue({ data: [] }),
    renameVsum: jest.fn(),
    deleteVsum: jest.fn(),
    recoverVsum: jest.fn(),
    restoreVsumVersion: jest.fn(),
    addVsumMember: jest.fn(),
    removeVsumMember: jest.fn(),
  },
}));

jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

jest.mock('../../../components/ui/VsumUsersTab', () => ({
  VsumUsersTab: () => <div data-testid="vsum-users-tab" />,
}));

const { apiService } = require('../../../services/api') as {
  apiService: Record<string, jest.Mock>;
};

const baseDetails = {
  id: 1,
  name: 'Test VSUM',
  description: 'desc',
  metaModels: [{ id: 10, name: 'ModelA' }],
  updatedAt: new Date().toISOString(),
};

// ─── Mocked-component smoke test (original) ───────────────────────────────────

const mockVsumDetailsModal = jest.fn((_props?: any) => <div>VsumDetailsModal mock</div>);

jest.mock('../../../components/ui/VsumDetailsModal', () => ({
  __esModule: true,
  VsumDetailsModal: (props: any) => mockVsumDetailsModal(props),
}));

import { VsumDetailsModal } from '../../../components/ui/VsumDetailsModal';

describe('VsumDetailsModal (mocked)', () => {
  it('renders with minimal props', () => {
    render(
      <VsumDetailsModal
        isOpen
        vsumId={1}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );
    expect(mockVsumDetailsModal).toHaveBeenCalled();
  });
});

// ─── Real component tests ─────────────────────────────────────────────────────

const { VsumDetailsModal: RealModal } =
  jest.requireActual('../../../components/ui/VsumDetailsModal') as {
    VsumDetailsModal: React.ComponentType<any>;
  };

describe('VsumDetailsModal – real component tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiService.getVsumDetails.mockResolvedValue({ data: baseDetails });
    apiService.getVsumVersions.mockResolvedValue({ data: [] });
  });

  it('returns null when not open', () => {
    const { container } = render(
      <RealModal isOpen={false} vsumId={1} onClose={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('loads and displays VSUM name', async () => {
    render(<RealModal isOpen vsumId={1} onClose={jest.fn()} />);
    expect(await screen.findByText('Test VSUM')).toBeInTheDocument();
  });

  it('shows linked meta model name', async () => {
    render(<RealModal isOpen vsumId={1} onClose={jest.fn()} />);
    expect(await screen.findByText('ModelA')).toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', async () => {
    const onClose = jest.fn();
    render(<RealModal isOpen vsumId={1} onClose={onClose} />);
    await screen.findByText('Test VSUM');
    fireEvent.click(screen.getAllByRole('button', { name: /Close/i })[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Details, Manage Users, and Versions tab buttons', async () => {
    render(<RealModal isOpen vsumId={1} onClose={jest.fn()} />);
    await screen.findByText('Test VSUM');
    expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Users' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Versions' })).toBeInTheDocument();
  });

  it('shows error when getVsumDetails fails', async () => {
    apiService.getVsumDetails.mockRejectedValueOnce(new Error('Not found'));
    render(<RealModal isOpen vsumId={99} onClose={jest.fn()} />);
    expect(await screen.findByText(/Not found/i)).toBeInTheDocument();
  });

  it('calls renameVsum when Save is clicked', async () => {
    apiService.renameVsum.mockResolvedValue({});
    render(<RealModal isOpen vsumId={1} onClose={jest.fn()} onSaved={jest.fn()} />);
    await screen.findByText('Test VSUM');
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    await waitFor(() => {
      expect(apiService.renameVsum).toHaveBeenCalledWith(1, { name: 'Test VSUM' });
    });
  });
});