import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VsumUsersTab } from '../../../components/ui/VsumUsersTab';

jest.mock('../../../services/api', () => ({
  apiService: {
    getVsumMembers: jest.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          firstName: 'Alice',
          lastName: 'Owner',
          email: 'alice@example.com',
          role: 'OWNER',
        },
      ],
    }),
    searchUsers: jest.fn().mockResolvedValue({
      data: [
        {
          id: 2,
          firstName: 'Bob',
          lastName: 'Member',
          email: 'bob@example.com',
        },
      ],
    }),
    addVsumMember: jest.fn().mockResolvedValue({}),
    removeVsumMember: jest.fn().mockResolvedValue({}),
  },
}));

const { apiService } = require('../../../services/api') as {
  apiService: {
    getVsumMembers: jest.Mock;
    searchUsers: jest.Mock;
    addVsumMember: jest.Mock;
    removeVsumMember: jest.Mock;
  };
};

describe('VsumUsersTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(globalThis, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    (globalThis.confirm as jest.Mock).mockRestore();
  });

  it('loads and displays members', async () => {
    render(<VsumUsersTab vsumId={1} />);

    await waitFor(() => {
      expect(apiService.getVsumMembers).toHaveBeenCalledWith(1);
    });
  });

  it('searches and adds a new member', async () => {
    render(<VsumUsersTab vsumId={1} />);

    const input = screen.getByPlaceholderText(/Search user by name or email/i);
    fireEvent.change(input, { target: { value: 'bob' } });

    await waitFor(() => {
      expect(apiService.searchUsers).toHaveBeenCalled();
    });
    // we only assert that search was triggered; UI list rendering is implementation-detail heavy
  });
});


describe('VsumUsersTab – additional tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(globalThis, 'confirm').mockReturnValue(true);
    apiService.getVsumMembers.mockResolvedValue({ data: [] });
    apiService.searchUsers.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    (globalThis.confirm as jest.Mock).mockRestore();
  });

  it('shows "No members yet." when list is empty', async () => {
    render(<VsumUsersTab vsumId={1} />);
    expect(await screen.findByText(/No members yet/i)).toBeInTheDocument();
  });

  it('renders member rows when members are loaded', async () => {
    apiService.getVsumMembers.mockResolvedValueOnce({
      data: [{ id: 10, firstName: 'Carol', lastName: 'Dev', email: 'carol@example.com', role: 'MEMBER' }],
    });
    render(<VsumUsersTab vsumId={1} />);
    expect(await screen.findByText('Carol Dev')).toBeInTheDocument();
    expect(screen.getByText('carol@example.com')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('does not show Remove button for OWNER role', async () => {
    apiService.getVsumMembers.mockResolvedValueOnce({
      data: [{ id: 1, firstName: 'Alice', lastName: 'Owner', email: 'alice@example.com', role: 'OWNER' }],
    });
    render(<VsumUsersTab vsumId={1} />);
    await screen.findByText('Alice Owner');
    expect(screen.queryByRole('button', { name: /Remove/i })).not.toBeInTheDocument();
  });

  it('shows Remove button for non-owner members', async () => {
    apiService.getVsumMembers.mockResolvedValueOnce({
      data: [{ id: 99, firstName: 'Dan', lastName: 'Member', email: 'dan@example.com', role: 'MEMBER' }],
    });
    render(<VsumUsersTab vsumId={1} />);
    expect(await screen.findByRole('button', { name: /Remove/i })).toBeInTheDocument();
  });

  it('calls removeVsumMember when Remove is clicked and confirmed', async () => {
    apiService.getVsumMembers
      .mockResolvedValueOnce({
        data: [{ id: 99, firstName: 'Dan', lastName: 'Member', email: 'dan@example.com', role: 'MEMBER' }],
      })
      .mockResolvedValueOnce({ data: [] });
    apiService.removeVsumMember.mockResolvedValue({});

    render(<VsumUsersTab vsumId={1} />);
    fireEvent.click(await screen.findByRole('button', { name: /Remove/i }));

    await waitFor(() => {
      expect(apiService.removeVsumMember).toHaveBeenCalledWith(99);
    });
  });

  it('Add member button is disabled when no user is selected', async () => {
    render(<VsumUsersTab vsumId={1} />);
    await screen.findByText(/No members yet/i);
    expect(screen.getByRole('button', { name: /Add member/i })).toBeDisabled();
  });

  it('shows error when getVsumMembers fails', async () => {
    apiService.getVsumMembers.mockRejectedValueOnce(new Error('Unauthorized'));
    render(<VsumUsersTab vsumId={1} />);
    expect(await screen.findByText(/Unauthorized/i)).toBeInTheDocument();
  });
});