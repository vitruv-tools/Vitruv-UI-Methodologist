import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { AuthService } from '../../services/auth';
import { apiService } from '../../services/api';

// ── mocks ─────────────────────────────────────────────────────────────────────

global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');

jest.mock('../../services/auth', () => ({
  AuthService: {
    isAuthenticated:  jest.fn(),
    getCurrentUser:   jest.fn(),
    setCurrentUser:   jest.fn(),
    getAccessToken:   jest.fn(),
    signIn:           jest.fn(),
    signOut:          jest.fn(),
    refreshToken:     jest.fn(),
  },
}));

jest.mock('../../services/api', () => ({
  apiService: {
    getUserInfo: jest.fn(),
  },
}));

jest.mock('../../hooks/useTokenRefresh', () => ({
  useTokenRefresh: () => ({ refreshToken: jest.fn().mockResolvedValue(null) }),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

const createJwt = (payload: object): string => {
  const h = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const p = btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `${h}.${p}.sig`;
};

const TestConsumer: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div>loading</div>;
  return <div data-testid="user">{user?.username ?? 'none'}</div>;
};

const setup = () => render(<AuthProvider><TestConsumer /></AuthProvider>);

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AuthContext – initial load', () => {
  afterEach(() => jest.clearAllMocks());

  it('resolves to "none" when not authenticated', async () => {
    (AuthService.isAuthenticated as jest.Mock).mockReturnValue(false);
    (AuthService.getCurrentUser as jest.Mock).mockReturnValue(null);
    setup();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('none'));
  });

  it('sets user from localStorage cache when present', async () => {
    const cachedUser = { id: '1', username: 'cached_user', email: 'c@kit.edu', givenName: 'C', familyName: 'U', emailVerified: true };
    (AuthService.isAuthenticated as jest.Mock).mockReturnValue(true);
    (AuthService.getCurrentUser as jest.Mock).mockReturnValue(cachedUser);
    setup();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('cached_user'));
  });

  it('fetches from API when no cache is present', async () => {
    (AuthService.isAuthenticated as jest.Mock).mockReturnValue(true);
    (AuthService.getCurrentUser as jest.Mock).mockReturnValue(null);
    (AuthService.getAccessToken as jest.Mock).mockReturnValue(null);
    (apiService.getUserInfo as jest.Mock).mockResolvedValue({
      data: { id: 42, email: 'api@kit.edu', firstName: 'Api', lastName: 'User', verified: true },
      message: null,
    });
    setup();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('api'));
  });

  it('uses preferred_username from JWT when fetching from API', async () => {
    const token = createJwt({ preferred_username: 'jwtuser', email: 'jwt@kit.edu' });
    (AuthService.isAuthenticated as jest.Mock).mockReturnValue(true);
    (AuthService.getCurrentUser as jest.Mock).mockReturnValue(null);
    (AuthService.getAccessToken as jest.Mock).mockReturnValue(token);
    (apiService.getUserInfo as jest.Mock).mockResolvedValue({
      data: { id: 7, email: 'jwt@kit.edu', firstName: 'Jwt', lastName: 'User', verified: true },
      message: null,
    });
    setup();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('jwtuser'));
  });

  it('sets user to none when not authenticated', async () => {
    (AuthService.isAuthenticated as jest.Mock).mockReturnValue(false);
    (AuthService.getCurrentUser as jest.Mock).mockReturnValue(null);
    setup();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('none'));
  });
});

describe('AuthContext – refreshCurrentUser', () => {
  afterEach(() => jest.clearAllMocks());

  it('updates user state after refresh', async () => {
    (AuthService.isAuthenticated as jest.Mock).mockReturnValue(true);
    (AuthService.getCurrentUser as jest.Mock).mockReturnValue(null);
    (AuthService.getAccessToken as jest.Mock).mockReturnValue(null);
    (AuthService.setCurrentUser as jest.Mock).mockImplementation(() => {});
    (apiService.getUserInfo as jest.Mock).mockResolvedValue({
      data: { id: 5, email: 'refresh@kit.edu', firstName: 'Re', lastName: 'Fresh', verified: true },
      message: null,
    });

    const RefreshConsumer: React.FC = () => {
      const { user, refreshCurrentUser } = useAuth();
      return (
        <div>
          <div data-testid="user">{user?.username ?? 'none'}</div>
          <button onClick={refreshCurrentUser}>refresh</button>
        </div>
      );
    };

    render(<AuthProvider><RefreshConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('refresh'));

    // simulate name change on backend
    (apiService.getUserInfo as jest.Mock).mockResolvedValue({
      data: { id: 5, email: 'refresh@kit.edu', firstName: 'Updated', lastName: 'Name', verified: true },
      message: null,
    });
    await act(async () => { screen.getByRole('button', { name: 'refresh' }).click(); });
    await waitFor(() => expect(AuthService.setCurrentUser).toHaveBeenCalled());
  });
});

describe('AuthContext – signOut', () => {
  afterEach(() => jest.clearAllMocks());

  it('calls AuthService.signOut and clears user', async () => {
    const cachedUser = { id: '1', username: 'u', email: 'u@kit.edu', givenName: 'U', familyName: 'U', emailVerified: true };
    (AuthService.isAuthenticated as jest.Mock).mockReturnValue(true);
    (AuthService.getCurrentUser as jest.Mock).mockReturnValue(cachedUser);
    (AuthService.signOut as jest.Mock).mockResolvedValue(undefined);

    const SignOutConsumer: React.FC = () => {
      const { user, signOut } = useAuth();
      return (
        <div>
          <div data-testid="user">{user?.username ?? 'none'}</div>
          <button onClick={signOut}>logout</button>
        </div>
      );
    };

    render(<AuthProvider><SignOutConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('u'));
    await act(async () => { screen.getByText('logout').click(); });
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('none'));
    expect(AuthService.signOut).toHaveBeenCalled();
  });
});

describe('AuthContext – resolveVerifiedFlag', () => {
  afterEach(() => jest.clearAllMocks());

  it('marks emailVerified true when backend returns verified:true', async () => {
    (AuthService.isAuthenticated as jest.Mock).mockReturnValue(true);
    (AuthService.getCurrentUser as jest.Mock).mockReturnValue(null);
    (AuthService.getAccessToken as jest.Mock).mockReturnValue(null);
    (apiService.getUserInfo as jest.Mock).mockResolvedValue({
      data: { id: 1, email: 'v@kit.edu', firstName: 'V', lastName: 'U', verified: true },
      message: null,
    });
    const Probe: React.FC = () => {
      const { user } = useAuth();
      return <div data-testid="verified">{String(user?.emailVerified)}</div>;
    };
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('verified').textContent).toBe('true'));
  });
});
