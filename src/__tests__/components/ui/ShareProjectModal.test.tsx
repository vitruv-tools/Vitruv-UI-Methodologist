import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareProjectModal } from '../../../components/ui/ShareProjectModal';

jest.mock('../../../services/api', () => ({
  apiService: {
    getVsumMembers: jest.fn().mockResolvedValue({ data: [] }),
    inviteVsumViewer: jest.fn().mockResolvedValue({ message: 'Invitation sent' }),
    removeVsumMember: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../../../components/ui/ConfirmDialog', () => ({
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

const { apiService } = require('../../../services/api') as {
  apiService: {
    getVsumMembers: jest.Mock;
    inviteVsumViewer: jest.Mock;
    removeVsumMember: jest.Mock;
  };
};

describe('ShareProjectModal', () => {
  const onClose = jest.fn();
  const onInvited = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
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
});
