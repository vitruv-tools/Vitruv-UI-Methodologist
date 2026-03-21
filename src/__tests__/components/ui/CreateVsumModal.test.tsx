import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateVsumModal } from '../../../components/ui/CreateVsumModal';

jest.mock('../../../services/api', () => ({
  apiService: {
    createVsum: jest.fn().mockResolvedValue({
      data: { id: 1, name: 'Test VSUM' },
      message: 'created',
    }),
  },
}));

jest.mock('../../../components/ui/ToastProvider', () => {
  const actual = jest.requireActual('../../../components/ui/ToastProvider');
  return {
    ...actual,
    useToast: () => ({
      showSuccess: jest.fn(),
      showError: jest.fn(),
      showInfo: jest.fn(),
    }),
  };
});

const { apiService } = require('../../../services/api') as {
  apiService: { createVsum: jest.Mock };
};

describe('CreateVsumModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when open and calls onClose on Cancel', () => {
    const onClose = jest.fn();

    render(
      <CreateVsumModal
        isOpen
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls apiService.createVsum on submit with name', async () => {
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    render(
      <CreateVsumModal
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Name \*/i), {
      target: { value: 'My Project' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Create$/i }));

    await waitFor(() => {
      expect(apiService.createVsum).toHaveBeenCalled();
    });
  });
});

