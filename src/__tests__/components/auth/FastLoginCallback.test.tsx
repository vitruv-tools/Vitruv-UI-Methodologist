import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FastLoginCallback } from '../../../components/auth/FastLoginCallback';

const mockUseFastLoginCallback = jest.fn();

jest.mock('../../../hooks/useFastLoginCallback', () => ({
  useFastLoginCallback: () => mockUseFastLoginCallback(),
}));

function renderCallback() {
  return render(
    <MemoryRouter>
      <FastLoginCallback />
    </MemoryRouter>,
  );
}

describe('FastLoginCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading spinner while processing', () => {
    mockUseFastLoginCallback.mockReturnValue({ isProcessing: true, error: null });
    renderCallback();
    expect(screen.getByText(/Completing Fast Login/i)).toBeInTheDocument();
    expect(screen.getByText(/Exchanging authorization code/i)).toBeInTheDocument();
  });

  it('shows error state with message when fast login fails', () => {
    mockUseFastLoginCallback.mockReturnValue({
      isProcessing: false,
      error: 'Invalid authorization code',
    });
    renderCallback();
    expect(screen.getByText(/Fast Login Failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Invalid authorization code/i)).toBeInTheDocument();
  });

  it('shows "Back to Sign In" link pointing to /login on error', () => {
    mockUseFastLoginCallback.mockReturnValue({
      isProcessing: false,
      error: 'Something went wrong',
    });
    renderCallback();
    const link = screen.getByRole('link', { name: /Back to Sign In/i });
    expect(link).toHaveAttribute('href', '/login');
  });

  it('shows generic processing text when not processing and no error', () => {
    mockUseFastLoginCallback.mockReturnValue({ isProcessing: false, error: null });
    renderCallback();
    expect(screen.getByText(/Processing/i)).toBeInTheDocument();
  });

  it('does not show error block while processing', () => {
    mockUseFastLoginCallback.mockReturnValue({ isProcessing: true, error: null });
    renderCallback();
    expect(screen.queryByText(/Fast Login Failed/i)).not.toBeInTheDocument();
  });
});
