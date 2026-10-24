import type { Mock } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareProjectModal } from '../../../components/ui/ShareProjectModal';
import * as apiModule from '../../../services/api';

vi.mock('../../../services/api', () => ({
  apiService: {
    getVsumMembers: vi.fn().mockResolvedValue({ data: [] }),
    inviteVsumViewer: vi.fn().mockResolvedValue({ message: 'Invitation sent' }),
    removeVsumMember: vi.fn().mockResolvedValue({}),
    searchUsers: vi.fn().mockResolvedValue({ data: [] }),
    addVsumMember: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../../components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({
    isOpen,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
  }) => isOpen ? (
    <div data-testid="confirm-dialog">
      <button type="button" onClick={onConfirm}>{confirmText}</button>
      <button type="button" onClick={onCancel}>{cancelText}</button>
    </div>
  ) : null,
}));

const { apiService } = (apiModule as unknown) as {
  apiService: {
    getVsumMembers: Mock;
    inviteVsumViewer: Mock;
    removeVsumMember: Mock;
    searchUsers: Mock;
    addVsumMember: Mock;
  };
};

describe('ShareProjectModal', () => {
  const onClose = vi.fn();
  const onInvited = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getVsumMembers.mockResolvedValue({ data: [] });
  });

  it('loads members when opened', async () => {
    render(
      <ShareProjectModal isOpen vsumId={1} projectName="Demo" onClose={onClose} onInvited={onInvited} />,
    );

    await waitFor(() => {
      expect(apiService.getVsumMembers).toHaveBeenCalledWith(1);
    });
  });

  it('does not show Remove access for owner', async () => {
    apiService.getVsumMembers.mockResolvedValueOnce({
      data: [{ id: 1, firstName: 'Alice', lastName: 'Owner', email: 'alice@example.com', role: 'OWNER' }],
    });

    render(
      <ShareProjectModal isOpen vsumId={1} onClose={onClose} />,
    );

    await screen.findByText('Alice Owner');
    expect(screen.queryByRole('button', { name: /^Remove access$/i })).not.toBeInTheDocument();
  });

  it('removes access for viewers when confirmed in dialog', async () => {
    apiService.getVsumMembers
      .mockResolvedValueOnce({
        data: [{ id: 42, firstName: 'Vic', lastName: 'Viewer', email: 'vic@example.com', role: 'VIEWER' }],
      })
      .mockResolvedValueOnce({ data: [] });
    apiService.removeVsumMember.mockResolvedValue({});

    render(
      <ShareProjectModal isOpen vsumId={1} onClose={onClose} onInvited={onInvited} />,
    );

    const removeButtons = await screen.findAllByRole('button', { name: /Remove access/i });
    fireEvent.click(removeButtons[0]);
    fireEvent.click(screen.getByTestId('confirm-dialog').querySelector('button')!);

    await waitFor(() => {
      expect(apiService.removeVsumMember).toHaveBeenCalledWith(42);
      expect(onInvited).toHaveBeenCalled();
    });
  });

  describe('Add people', () => {
    const bob = { id: 7, firstName: 'Bob', lastName: 'Member', email: 'bob@example.com' };
    const carol = { id: 8, firstName: 'Carol', lastName: 'Coder', email: 'carol@example.com' };

    const renderModal = () => render(
      <ShareProjectModal isOpen vsumId={1} onClose={onClose} onInvited={onInvited} />,
    );
    const addAs = (role: 'VIEWER' | 'MEMBER') =>
      fireEvent.change(screen.getByLabelText('Add as'), { target: { value: role } });
    const searchFor = (text: string) =>
      fireEvent.change(screen.getByPlaceholderText('Name or email…'), { target: { value: text } });

    it('invites a viewer by email by default', async () => {
      apiService.inviteVsumViewer.mockResolvedValue({ message: 'Invitation sent' });
      renderModal();

      expect(screen.getByLabelText('Add as')).toHaveValue('VIEWER');
      fireEvent.change(screen.getByPlaceholderText('viewer@example.com'), { target: { value: 'vic@example.com' } });
      fireEvent.click(screen.getByRole('button', { name: 'Invite viewer' }));

      await waitFor(() => {
        expect(apiService.inviteVsumViewer).toHaveBeenCalledWith(1, { email: 'vic@example.com' });
      });
    });

    it('adds a registered user as a member', async () => {
      apiService.searchUsers.mockResolvedValue({ data: [bob] });
      apiService.addVsumMember.mockResolvedValue({});
      renderModal();

      addAs('MEMBER');
      expect(screen.getByRole('button', { name: 'Add member' })).toBeDisabled();
      searchFor('bob');
      fireEvent.click(await screen.findByRole('option', { name: /Bob Member/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Add member' }));

      await waitFor(() => {
        expect(apiService.addVsumMember).toHaveBeenCalledWith(1, { userId: 7 });
        expect(onInvited).toHaveBeenCalled();
      });
      expect(await screen.findByText('Bob Member was added as a member.')).toBeInTheDocument();
    });

    it('does not suggest people who already have access', async () => {
      apiService.getVsumMembers.mockResolvedValue({
        data: [{ id: 3, firstName: 'Bob', lastName: 'Member', email: 'bob@example.com', role: 'VIEWER' }],
      });
      apiService.searchUsers.mockResolvedValue({ data: [bob, carol] });
      renderModal();
      await screen.findByText('bob@example.com');

      addAs('MEMBER');
      searchFor('example');

      expect(await screen.findByRole('option', { name: /Carol Coder/ })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /Bob Member/ })).not.toBeInTheDocument();
    });
  });
});