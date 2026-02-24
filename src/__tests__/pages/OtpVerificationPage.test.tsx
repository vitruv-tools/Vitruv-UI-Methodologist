import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OtpVerificationPage } from '../../pages/OtpVerificationPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  // Only mock the hooks that this page uses
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    pathname: '/verify-otp',
    state: null,
  }),
}));

const mockRefreshCurrentUser = jest.fn();

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    refreshCurrentUser: mockRefreshCurrentUser,
  }),
}));

const verifyOtpMock = jest.fn();
const resendOtpMock = jest.fn();

jest.mock('../../services/api', () => ({
  apiService: {
    verifyOtp: (...args: any[]) => verifyOtpMock(...args),
    resendOtp: (...args: any[]) => resendOtpMock(...args),
  },
}));

describe('OtpVerificationPage', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders main UI elements', () => {
    render(<OtpVerificationPage />);

    expect(screen.getByText(/Email Verification/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Verification Code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verify Email/i })).toBeInTheDocument();
  });

  it('shows validation error when submitting empty code', async () => {
    render(<OtpVerificationPage />);

    const submitButton = screen.getByRole('button', { name: /Verify Email/i });
    await userEvent.click(submitButton);

    expect(screen.getByText(/Please enter a valid OTP code/i)).toBeInTheDocument();
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });

  it('calls verifyOtp and shows success on valid code', async () => {
    verifyOtpMock.mockResolvedValueOnce({ message: 'Email verified successfully!' });

    render(<OtpVerificationPage />);

    const input = screen.getByLabelText(/Verification Code/i);
    await userEvent.type(input, '1234');

    const submitButton = screen.getByRole('button', { name: /Verify Email/i });
    await userEvent.click(submitButton);

    expect(verifyOtpMock).toHaveBeenCalledWith('1234');

    const successMessage = await screen.findByText(/Email verified successfully!/i);
    expect(successMessage).toBeInTheDocument();

    expect(mockRefreshCurrentUser).toHaveBeenCalled();

    // Advance timers to trigger redirect
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(mockNavigate).toHaveBeenCalledWith('/mml');
  });

  it('displays the countdown timer starting at 5:00', () => {
    render(<OtpVerificationPage />);

    expect(screen.getByText(/Time Remaining/i)).toBeInTheDocument();
    expect(screen.getByText('5:00')).toBeInTheDocument();
  });

  it('enables resend button after timer expires', () => {
    render(<OtpVerificationPage />);

    act(() => {
      jest.advanceTimersByTime(5 * 60 * 1000);
    });

    expect(
      screen.getByRole('button', { name: /Resend Verification Code/i })
    ).toBeInTheDocument();
  });

  it('resends OTP and resets state when clicking resend', async () => {
    resendOtpMock.mockResolvedValueOnce({});

    render(<OtpVerificationPage />);

    act(() => {
      jest.advanceTimersByTime(5 * 60 * 1000);
    });

    const resendButton = screen.getByRole('button', { name: /Resend Verification Code/i });
    await userEvent.click(resendButton);

    expect(resendOtpMock).toHaveBeenCalled();
    expect(
      await screen.findByText(/A new verification code has been sent/i)
    ).toBeInTheDocument();
  });

  it('navigates back to login when Go to Sign In is clicked', async () => {
    render(<OtpVerificationPage />);

    const goToLoginButton = screen.getByRole('button', { name: /Go to Sign In/i });
    await userEvent.click(goToLoginButton);

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});

