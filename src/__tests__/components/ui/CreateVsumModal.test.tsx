import type { Mock } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateVsumModal } from '../../../components/ui/CreateVsumModal';
import * as apiModule from '../../../services/api';

vi.mock('../../../services/api', () => ({
  apiService: {
    createVsum: vi.fn().mockResolvedValue({
      data: { id: 1, name: 'Test VSUM' },
      message: 'created',
    }),
  },
}));

vi.mock('../../../components/ui/ToastProvider', async () => {
  const actual = (await vi.importActual<any>('../../../components/ui/ToastProvider'));
  return {
    ...actual,
    useToast: () => ({
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showInfo: vi.fn(),
    }),
  };
});

const { apiService } = (apiModule as unknown) as {
  apiService: { createVsum: Mock };
};

describe('CreateVsumModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open and calls onClose on Cancel', () => {
    const onClose = vi.fn();

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
    const onClose = vi.fn();
    const onSuccess = vi.fn();

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

    fireEvent.click(screen.getByRole('button', { name: /Create project/i }));

    await waitFor(() => {
      expect(apiService.createVsum).toHaveBeenCalled();
    });
  });
});


describe('CreateVsumModal – additional tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when not open', () => {
    const { container } = render(
      <CreateVsumModal isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('Create button is disabled when name is empty', () => {
    render(<CreateVsumModal isOpen onClose={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /Create project/i }),
    ).toBeDisabled();
  });

  it('shows "Creating..." while submitting', async () => {
    apiService.createVsum.mockImplementation(
      () => new Promise((r) => setTimeout(r, 500)),
    );

    render(<CreateVsumModal isOpen onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Name \*/i), 'My VSUM');
    fireEvent.click(screen.getByRole('button', { name: /Create project/i }));

    expect(await screen.findByText(/Creating/i)).toBeInTheDocument();
  });

  it('shows API error when createVsum throws', async () => {
    apiService.createVsum.mockRejectedValueOnce(new Error('Server offline'));

    render(<CreateVsumModal isOpen onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Name \*/i), 'My VSUM');
    fireEvent.click(screen.getByRole('button', { name: /Create project/i }));

    expect(await screen.findByText(/Server offline/i)).toBeInTheDocument();
  });

  it('passes name and optional description to createVsum', async () => {
    apiService.createVsum.mockResolvedValueOnce({
      data: { id: 2, name: 'Ecore VSUM' },
    });

    render(<CreateVsumModal isOpen onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Name \*/i), 'Ecore VSUM');
    await userEvent.type(
      screen.getByLabelText(/Description/i),
      'A test vsum',
    );
    fireEvent.click(screen.getByRole('button', { name: /Create project/i }));

    await waitFor(() => {
      expect(apiService.createVsum).toHaveBeenCalledWith({
        name: 'Ecore VSUM',
        description: 'A test vsum',
      });
    });
  });

  it('trims whitespace from name before submitting', async () => {
    apiService.createVsum.mockResolvedValueOnce({ data: { id: 3 } });

    render(<CreateVsumModal isOpen onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Name \*/i), '  Padded Name  ');
    fireEvent.click(screen.getByRole('button', { name: /Create project/i }));

    await waitFor(() => {
      expect(apiService.createVsum).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Padded Name' }),
      );
    });
  });

  it('renders the modal content when open', () => {
    render(<CreateVsumModal isOpen onClose={vi.fn()} />);
    expect(screen.getByText('New Project')).toBeInTheDocument();
  });
});