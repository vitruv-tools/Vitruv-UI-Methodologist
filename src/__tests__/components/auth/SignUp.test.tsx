import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignUp } from '../../../components/auth/SignUp';

const mockSignUp = jest.fn();

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    signUp: mockSignUp,
  }),
}));

describe('SignUp component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('renders all required fields and submit button', () => {
    render(
      <SignUp
        onSignUpSuccess={jest.fn()}
        onSwitchToSignIn={jest.fn()}
      />,
    );

    expect(screen.getByLabelText(/First Name \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Username \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email \*/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Create a strong password/i),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Confirm your password/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Create Account/i }),
    ).toBeInTheDocument();
  });

  it('toggles sign-up password fields independently', async () => {
    render(
      <SignUp
        onSignUpSuccess={jest.fn()}
        onSwitchToSignIn={jest.fn()}
      />,
    );

    const passwordInput = screen.getByLabelText(/^Password \*$/i);
    const confirmPasswordInput = screen.getByLabelText(/^Confirm Password \*$/i);

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Show confirm password' }),
    );

    expect(confirmPasswordInput).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('button', { name: 'Hide confirm password' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows validation error for too short first name', async () => {
    render(
      <SignUp
        onSignUpSuccess={jest.fn()}
        onSwitchToSignIn={jest.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText(/First Name \*/i), 'A');
    await userEvent.type(screen.getByLabelText(/Last Name \*/i), 'Doe');
    await userEvent.type(screen.getByLabelText(/Username \*/i), 'john');
    await userEvent.type(screen.getByLabelText(/Email \*/i), 'john@example.com');
    await userEvent.type(
      screen.getByPlaceholderText(/Create a strong password/i),
      'Password1!',
    );
    await userEvent.type(
      screen.getByPlaceholderText(/Confirm your password/i),
      'Password1!',
    );

    await userEvent.click(
      screen.getByRole('button', { name: /Create Account/i }),
    );

    expect(
      await screen.findByText(/First name is required \(at least 2 characters\)/i),
    ).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('calls signUp and onSignUpSuccess on valid submit', async () => {
    jest.useFakeTimers();
    const onSignUpSuccess = jest.fn();
    mockSignUp.mockResolvedValueOnce(undefined);

    render(
      <SignUp
        onSignUpSuccess={onSignUpSuccess}
        onSwitchToSignIn={jest.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText(/First Name \*/i), 'John');
    await userEvent.type(screen.getByLabelText(/Last Name \*/i), 'Doe');
    await userEvent.type(screen.getByLabelText(/Username \*/i), 'johndoe');
    await userEvent.type(screen.getByLabelText(/Email \*/i), 'john@example.com');
    await userEvent.type(
      screen.getByPlaceholderText(/Create a strong password/i),
      'Password1!',
    );
    await userEvent.type(
      screen.getByPlaceholderText(/Confirm your password/i),
      'Password1!',
    );

    await userEvent.click(
      screen.getByRole('button', { name: /Create Account/i }),
    );

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalled();
    });

    expect(
      await screen.findByText(/Account Created Successfully!/i),
    ).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(onSignUpSuccess).toHaveBeenCalled();
  });
});
