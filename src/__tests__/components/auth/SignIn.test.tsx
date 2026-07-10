import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignIn } from '../../../components/auth/SignIn';

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
  }),
}));

jest.mock('../../../services/api', () => ({
  apiService: {
    forgotPassword: jest.fn(),
  },
}));

const mockSignIn = jest.fn();
const mockOnSignInSuccess = jest.fn();
const mockOnSwitchToSignUp = jest.fn();

describe('SignIn component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders username, password fields and sign in button', () => {
    render(
      <SignIn
        onSignInSuccess={mockOnSignInSuccess}
        onSwitchToSignUp={mockOnSwitchToSignUp}
      />,
    );

    expect(screen.getByLabelText(/Username or Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('toggles password visibility without changing the password value', async () => {
    render(
      <SignIn
        onSignInSuccess={mockOnSignInSuccess}
        onSwitchToSignUp={mockOnSwitchToSignUp}
      />,
    );

    const passwordInput = screen.getByLabelText(/^Password$/i);
    await userEvent.type(passwordInput, 'password123!');

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(
      screen.getByRole('button', { name: 'Show password' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(passwordInput).toHaveValue('password123!');
    expect(
      screen.getByRole('button', { name: 'Hide password' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveValue('password123!');
  });

  it('shows validation error when submitting with empty fields', async () => {
    render(
      <SignIn
        onSignInSuccess={mockOnSignInSuccess}
        onSwitchToSignUp={mockOnSwitchToSignUp}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    expect(
      await screen.findByText(/Please fill in all fields/i),
    ).toBeInTheDocument();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('calls signIn and onSignInSuccess on successful submit', async () => {
    const fakeUser = { id: '1', emailVerified: true };
    mockSignIn.mockResolvedValueOnce(fakeUser);

    render(
      <SignIn
        onSignInSuccess={mockOnSignInSuccess}
        onSwitchToSignUp={mockOnSwitchToSignUp}
      />,
    );

    await userEvent.type(
      screen.getByLabelText(/Username or Email/i),
      'john@example.com',
    );
    await userEvent.type(screen.getByLabelText(/^Password$/i), 'password123!');
    await userEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith(
        'john@example.com',
        'password123!',
      );
    });
    expect(mockOnSignInSuccess).toHaveBeenCalledWith(fakeUser);
  });

  it('shows error when signIn throws', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('Invalid credentials'));

    render(
      <SignIn
        onSignInSuccess={mockOnSignInSuccess}
        onSwitchToSignUp={mockOnSwitchToSignUp}
      />,
    );

    await userEvent.type(
      screen.getByLabelText(/Username or Email/i),
      'john@example.com',
    );
    await userEvent.type(screen.getByLabelText(/^Password$/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    expect(
      await screen.findByText(/Invalid credentials/i),
    ).toBeInTheDocument();
  });

  it('opens forgot password modal and validates email', async () => {
    const { apiService } = jest.requireMock('../../../services/api') as {
      apiService: { forgotPassword: jest.Mock };
    };

    render(
      <SignIn
        onSignInSuccess={mockOnSignInSuccess}
        onSwitchToSignUp={mockOnSwitchToSignUp}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /Forgot your password\?/i }),
    );

    const emailInput = await screen.findByLabelText(/Registered Email Address/i);
    const submitButton = screen.getByRole('button', {
      name: /Submit Request/i,
    });

    // Invalid email
    await userEvent.type(emailInput, 'not-an-email');
    await userEvent.click(submitButton);
    expect(
      await screen.findByText(/Please enter a valid email address/i),
    ).toBeInTheDocument();

    // Valid email -> API is called
    apiService.forgotPassword.mockResolvedValueOnce({
      message: 'Reset email sent',
      data: {},
    });

    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(apiService.forgotPassword).toHaveBeenCalledWith('user@example.com');
    });
  });
});
