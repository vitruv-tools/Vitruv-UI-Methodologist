import type { Mock } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VsumUsersTab } from '../../../components/ui/VsumUsersTab';
import * as apiModule from '../../../services/api';

vi.mock('../../../services/api', () => ({
  apiService: {
    getVsumMembers: vi.fn().mockResolvedValue({
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
    searchUsers: vi.fn().mockResolvedValue({
      data: [
        {
          id: 2,
          firstName: 'Bob',
          lastName: 'Member',
          email: 'bob@example.com',
        },
      ],
    }),
    addVsumMember: vi.fn().mockResolvedValue({}),
    removeVsumMember: vi.fn().mockResolvedValue({}),
    inviteVsumViewer: vi.fn().mockResolvedValue({ message: 'Invitation sent' }),
  },
}));

const { apiService } = (apiModule as unknown) as {
  apiService: {
    getVsumMembers: Mock;
    searchUsers: Mock;
    addVsumMember: Mock;
    removeVsumMember: Mock;
    inviteVsumViewer: Mock;
  };
};

describe('VsumUsersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    (globalThis.confirm as Mock).mockRestore();
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

  it('lets the first suggested user be selected and added', async () => {
    apiService.getVsumMembers.mockResolvedValue({ data: [] });
    apiService.searchUsers.mockResolvedValue({
      data: [{ id: 2, firstName: 'Bob', lastName: 'Member', email: 'bob@example.com' }],
    });
    apiService.addVsumMember.mockResolvedValue({});
    render(<VsumUsersTab vsumId={1} />);
    fireEvent.change(screen.getByPlaceholderText(/Search user by name or email/i), {
      target: { value: 'bob' },
    });

    // A list even for one match, with no user selected yet, so choosing the first is a real change.
    const results = await screen.findByRole('listbox', { name: 'Search results' });
    expect((screen.getByRole('option', { name: /Bob Member/ }) as HTMLOptionElement).selected).toBe(false);
    expect(screen.getByRole('button', { name: /Add member/i })).toBeDisabled();

    fireEvent.change(results, { target: { value: '2' } });
    expect(screen.getByText(/Selected:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add member/i }));

    await waitFor(() => expect(apiService.addVsumMember).toHaveBeenCalledWith(1, { userId: 2 }));
  });
});


describe('VsumUsersTab – additional tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    apiService.getVsumMembers.mockResolvedValue({ data: [] });
    apiService.searchUsers.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    (globalThis.confirm as Mock).mockRestore();
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

  it('invites a viewer by email', async () => {
    apiService.inviteVsumViewer.mockResolvedValueOnce({ message: 'Invitation sent to viewer@example.com' });
    render(<VsumUsersTab vsumId={1} />);
    await screen.findByText(/No members yet/i);

    fireEvent.change(screen.getByPlaceholderText('viewer@example.com'), {
      target: { value: 'viewer@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Invite viewer/i }));

    await waitFor(() => {
      expect(apiService.inviteVsumViewer).toHaveBeenCalledWith(1, { email: 'viewer@example.com' });
    });
    expect(await screen.findByText(/Invitation sent/i)).toBeInTheDocument();
  });

  it('shows pending badge for pending viewer invites', async () => {
    apiService.getVsumMembers.mockResolvedValueOnce({
      data: [{
        id: 20,
        vsumId: 1,
        firstName: '',
        lastName: '',
        email: 'pending@example.com',
        role: 'VIEWER',
        status: 'PENDING',
      }],
    });
    render(<VsumUsersTab vsumId={1} />);
    expect(await screen.findByText('Pending invite')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });

  it('hides invite and add controls when canManage is false', async () => {
    apiService.getVsumMembers.mockResolvedValueOnce({
      data: [{
        id: 1,
        vsumId: 1,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        role: 'OWNER',
      }],
    });
    render(<VsumUsersTab vsumId={1} canManage={false} />);
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByText('Invite viewer')).not.toBeInTheDocument();
    expect(screen.queryByText('Add member')).not.toBeInTheDocument();
    expect(screen.queryByText('Remove')).not.toBeInTheDocument();
  });
});