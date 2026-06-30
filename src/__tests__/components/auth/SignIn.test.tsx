import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignIn } from '../../../components/auth/SignIn';

const { apiService } = jest.requireMock('../../../services/api') as {
  apiService: { forgotPassword: jest.Mock };
};

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
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('shows validation error when submitting with empty fields', async () => {
    render(
      <SignIn
        onSignInSuccess={mockOnSignInSuccess}
        onSwitchToSignUp={mockOnSwitchToSignUp}
      />,
    );

    fireEvent.submit(document.querySelector('form')!);

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
    await userEvent.type(screen.getByLabelText(/Password/i), 'password123!');
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
    await userEvent.type(screen.getByLabelText(/Password/i), 'wrong');
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
      screen.getByRole('button', { name: /Forgot Password\?/i }),
    );

    const emailInput = await screen.findByPlaceholderText(/Email address/i);
    const submitButton = screen.getByRole('button', {
      name: /Send instructions/i,
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


describe('SignIn – forgot password dialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderSignIn = () =>
    render(
      <SignIn
        onSignInSuccess={mockOnSignInSuccess}
        onSwitchToSignUp={mockOnSwitchToSignUp}
      />,
    );

  it('opens forgot password dialog when "Forgot Password?" is clicked', async () => {
    renderSignIn();
    await userEvent.click(
      screen.getByRole('button', { name: /Forgot Password\?/i }),
    );
    expect(await screen.findByText(/Password Reset/i)).toBeInTheDocument();
  });

  it('closes dialog when Cancel button is clicked', async () => {
    renderSignIn();
    await userEvent.click(
      screen.getByRole('button', { name: /Forgot Password\?/i }),
    );
    await screen.findByText(/Password Reset/i);

    await userEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText(/Password Reset/i)).not.toBeInTheDocument();
    });
  });

  it('shows error for invalid email in forgot password dialog', async () => {
    renderSignIn();
    await userEvent.click(
      screen.getByRole('button', { name: /Forgot Password\?/i }),
    );

    const emailInput = await screen.findByPlaceholderText(/Email address/i);
    await userEvent.type(emailInput, 'not-an-email');
    await userEvent.click(
      screen.getByRole('button', { name: /Send instructions/i }),
    );

    expect(
      await screen.findByText(/Please enter a valid email address/i),
    ).toBeInTheDocument();
    expect(apiService.forgotPassword).not.toHaveBeenCalled();
  });

  it('calls forgotPassword with valid email and shows success message', async () => {
    apiService.forgotPassword.mockResolvedValueOnce({
      message: 'Reset sent',
      data: {},
    });

    renderSignIn();
    await userEvent.click(
      screen.getByRole('button', { name: /Forgot Password\?/i }),
    );

    const emailInput = await screen.findByPlaceholderText(/Email address/i);
    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.click(
      screen.getByRole('button', { name: /Send instructions/i }),
    );

    await waitFor(() => {
      expect(apiService.forgotPassword).toHaveBeenCalledWith('user@example.com');
    });
    expect(await screen.findByText(/Reset sent/i)).toBeInTheDocument();
  });

  it('shows API error when forgotPassword throws', async () => {
    apiService.forgotPassword.mockRejectedValueOnce(
      new Error('Email not found'),
    );

    renderSignIn();
    await userEvent.click(
      screen.getByRole('button', { name: /Forgot Password\?/i }),
    );

    const emailInput = await screen.findByPlaceholderText(/Email address/i);
    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.click(
      screen.getByRole('button', { name: /Send instructions/i }),
    );

    expect(await screen.findByText(/Email not found/i)).toBeInTheDocument();
  });

  it('clears sign-in error when user starts typing', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('Bad credentials'));

    renderSignIn();
    await userEvent.type(
      screen.getByLabelText(/Username or Email/i),
      'user',
    );
    await userEvent.type(screen.getByLabelText(/Password/i), 'pw');
    await userEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await screen.findByText(/Bad credentials/i);

    await userEvent.type(
      screen.getByLabelText(/Username or Email/i),
      'x',
    );

    await waitFor(() => {
      expect(screen.queryByText(/Bad credentials/i)).not.toBeInTheDocument();
    });
  });

  it('calls onSwitchToSignUp when Sign Up link is clicked', async () => {
    renderSignIn();
    await userEvent.click(
      screen.getByRole('button', { name: /Sign Up/i }),
    );
    expect(mockOnSwitchToSignUp).toHaveBeenCalled();
  });
});

// ── Fast Login button ─────────────────────────────────────────────────────────

import { AuthService } from '../../../services/auth';

describe('SignIn – Fast Login button', () => {
  // JSDOM marks location.assign as read-only; replace globalThis.location with
  // a plain object so we can intercept the redirect call.
  const assignMock = jest.fn();
  const originalLocation = globalThis.location;

  let fastLoginSpy: jest.SpyInstance;

  beforeAll(() => {
    // @ts-ignore — intentional JSDOM workaround
    delete globalThis.location;
    (globalThis as any).location = { ...originalLocation, assign: assignMock };
  });

  afterAll(() => {
    (globalThis as any).location = originalLocation;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    assignMock.mockReset();
    fastLoginSpy = jest
      .spyOn(AuthService, 'getFastLoginAuthorizationUrl')
      .mockReturnValue('https://keycloak.example.com/auth?code');
  });

  afterEach(() => {
    fastLoginSpy.mockRestore();
  });

  const renderFastLoginSignIn = () =>
    render(
      <SignIn
        onSignInSuccess={mockOnSignInSuccess}
        onSwitchToSignUp={mockOnSwitchToSignUp}
      />,
    );

  it('renders the KIT Fast Login button', () => {
    renderFastLoginSignIn();
    expect(
      screen.getByRole('button', { name: /Log in with KIT account/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Log in with FeLS account/i }),
    ).not.toBeInTheDocument();
  });

  it('calls getFastLoginAuthorizationUrl and redirects on click', async () => {
    renderFastLoginSignIn();
    await userEvent.click(
      screen.getByRole('button', { name: /Log in with KIT account/i }),
    );
    expect(fastLoginSpy).toHaveBeenCalled();
    expect(assignMock).toHaveBeenCalledWith('https://keycloak.example.com/auth?code');
  });

  it('shows an error message when getFastLoginAuthorizationUrl throws', async () => {
    fastLoginSpy.mockImplementationOnce(() => {
      throw new Error('Config error');
    });
    renderFastLoginSignIn();
    await userEvent.click(
      screen.getByRole('button', { name: /Log in with KIT account/i }),
    );
    expect(await screen.findByText(/Config error/i)).toBeInTheDocument();
  });
});
