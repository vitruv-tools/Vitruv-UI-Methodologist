import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignUp } from '../../../components/auth/SignUp';

const mockSignUp = vi.fn();

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    signUp: mockSignUp,
  }),
}));

describe('SignUp component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders all required fields and submit button', () => {
    render(
      <SignUp
        onSignUpSuccess={vi.fn()}
        onSwitchToSignIn={vi.fn()}
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

  it('shows validation error for too short first name', async () => {
    render(
      <SignUp
        onSignUpSuccess={vi.fn()}
        onSwitchToSignIn={vi.fn()}
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
    vi.useFakeTimers();
    const onSignUpSuccess = vi.fn();
    mockSignUp.mockResolvedValueOnce(undefined);

    render(
      <SignUp
        onSignUpSuccess={onSignUpSuccess}
        onSwitchToSignIn={vi.fn()}
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
      vi.advanceTimersByTime(2000);
    });

    expect(onSignUpSuccess).toHaveBeenCalled();
  });
});


describe('SignUp – additional validation and password UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  const renderSignUp = () =>
    render(
      <SignUp onSignUpSuccess={vi.fn()} onSwitchToSignIn={vi.fn()} />,
    );

  it('shows password strength meter when password is entered', async () => {
    renderSignUp();
    const passwordInput = screen.getByPlaceholderText(/Create a strong password/i);
    await userEvent.type(passwordInput, 'abc');
    // Strength label visible after typing
    expect(screen.getByText(/Very Weak/i)).toBeInTheDocument();
  });

  it('shows "Very Strong" for a fully qualifying password', async () => {
    renderSignUp();
    const passwordInput = screen.getByPlaceholderText(/Create a strong password/i);
    await userEvent.type(passwordInput, 'Str0ng!Pass');
    expect(screen.getByText(/Very Strong/i)).toBeInTheDocument();
  });

  it('shows password requirements list when password is invalid', async () => {
    renderSignUp();
    const passwordInput = screen.getByPlaceholderText(/Create a strong password/i);
    await userEvent.type(passwordInput, 'weak');
    expect(screen.getByText(/Password must:/i)).toBeInTheDocument();
    expect(screen.getByText(/Be at least 8 characters long/i)).toBeInTheDocument();
  });

  it('hides password requirements once password is valid', async () => {
    renderSignUp();
    const passwordInput = screen.getByPlaceholderText(/Create a strong password/i);
    await userEvent.type(passwordInput, 'ValidPass1!');
    expect(screen.queryByText(/Password must:/i)).not.toBeInTheDocument();
  });

  it('shows validation error for short last name', async () => {
    renderSignUp();
    await userEvent.type(screen.getByLabelText(/First Name \*/i), 'John');
    await userEvent.type(screen.getByLabelText(/Last Name \*/i), 'D');
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
    await userEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    expect(
      await screen.findByText(/Last name is required/i),
    ).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('shows validation error for short username', async () => {
    renderSignUp();
    await userEvent.type(screen.getByLabelText(/First Name \*/i), 'John');
    await userEvent.type(screen.getByLabelText(/Last Name \*/i), 'Doe');
    await userEvent.type(screen.getByLabelText(/Username \*/i), 'jo');
    await userEvent.type(screen.getByLabelText(/Email \*/i), 'john@example.com');
    await userEvent.type(
      screen.getByPlaceholderText(/Create a strong password/i),
      'Password1!',
    );
    await userEvent.type(
      screen.getByPlaceholderText(/Confirm your password/i),
      'Password1!',
    );
    await userEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    expect(
      await screen.findByText(/Username is too short/i),
    ).toBeInTheDocument();
  });

  it('shows validation error for invalid email', async () => {
    renderSignUp();
    await userEvent.type(screen.getByLabelText(/First Name \*/i), 'John');
    await userEvent.type(screen.getByLabelText(/Last Name \*/i), 'Doe');
    await userEvent.type(screen.getByLabelText(/Username \*/i), 'johndoe');
    await userEvent.type(screen.getByLabelText(/Email \*/i), 'not-an-email');
    await userEvent.type(
      screen.getByPlaceholderText(/Create a strong password/i),
      'Password1!',
    );
    await userEvent.type(
      screen.getByPlaceholderText(/Confirm your password/i),
      'Password1!',
    );
    // The browser's own type="email" validation blocks a button click; submit directly to reach the form's validator.
    fireEvent.submit(screen.getByRole('button', { name: /Create Account/i }).closest('form')!);
    expect(
      await screen.findByText(/Email is invalid/i),
    ).toBeInTheDocument();
  });

  it('shows validation error when passwords do not match', async () => {
    renderSignUp();
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
      'DifferentPass1!',
    );
    await userEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    expect(
      await screen.findByText(/Confirm password is empty or doesn't match/i),
    ).toBeInTheDocument();
  });

  it('shows error from signUp and does not call onSignUpSuccess', async () => {
    mockSignUp.mockRejectedValueOnce(
      new Error('Username is already used. Please choose another username.'),
    );

    renderSignUp();
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
    await userEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(
      await screen.findByText(/Username is already used/i),
    ).toBeInTheDocument();
  });

  it('submit button is disabled when form is incomplete', () => {
    renderSignUp();
    expect(
      screen.getByRole('button', { name: /Create Account/i }),
    ).toBeDisabled();
  });

  it('clears error when user types in any field', async () => {
    mockSignUp.mockRejectedValueOnce(new Error('Some error'));

    renderSignUp();
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
    await userEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    await screen.findByText(/Some error/i);

    await userEvent.type(screen.getByLabelText(/First Name \*/i), 'X');
    await waitFor(() => {
      expect(screen.queryByText(/Some error/i)).not.toBeInTheDocument();
    });
  });
});
