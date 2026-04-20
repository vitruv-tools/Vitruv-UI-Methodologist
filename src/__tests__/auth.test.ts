import { AuthService, AuthResponse, SignUpCredentials } from '../services/auth';

const baseAuthResponse: AuthResponse = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  refresh_expires_in: 7200,
  token_type: 'Bearer',
  session_state: 'session-1',
  scope: 'openid',
  'not-before-policy': 0,
};

const credentials: SignUpCredentials = {
  email: 'john@example.com',
  roleType: 'USER',
  username: 'john',
  firstName: 'John',
  lastName: 'Doe',
  password: 'secret',
};

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
    global.fetch = jest.fn() as jest.Mock;
  });

  it('stores tokens on successful signIn', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => baseAuthResponse,
    });

    const result = await AuthService.signIn({ username: 'john', password: 'secret' });

    expect(result.access_token).toBe('access-token');
    expect(localStorage.getItem('auth.access_token')).toBe('access-token');
    expect(localStorage.getItem('auth.refresh_token')).toBe('refresh-token');
    expect(localStorage.getItem('auth.access_expires_at')).toBeTruthy();
    expect(localStorage.getItem('auth.refresh_expires_at')).toBeTruthy();
  });

  it('throws parsed API message on failed signIn', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
      text: async () => JSON.stringify({ message: 'Bad credentials' }),
    });

    await expect(
      AuthService.signIn({ username: 'john', password: 'wrong' })
    ).rejects.toThrow('Bad credentials');
  });

  it('throws duplicate username message on signUp conflict', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      text: async () => JSON.stringify({ message: 'username already exists' }),
    });

    await expect(AuthService.signUp(credentials)).rejects.toThrow(
      'Username is already used. Please choose another username.'
    );
  });

  it('stores signUp tokens when backend returns token payload', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ ...baseAuthResponse, data: { ignored: true }, message: 'created' }),
    });

    const result = await AuthService.signUp(credentials);

    expect(result.access_token).toBe('access-token');
    expect(localStorage.getItem('auth.access_token')).toBe('access-token');
    expect(localStorage.getItem('auth.not_before_policy')).toBe('0');
  });

  it('throws extracted error message on forgotPassword failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({ error_description: 'Email is required' }),
    });

    await expect(AuthService.forgotPassword({ email: '' })).rejects.toThrow('Email is required');
  });

  it('signs out and returns null when refresh token is expired', async () => {
    localStorage.setItem('auth.refresh_token', 'expired-refresh');
    localStorage.setItem('auth.refresh_expires_at', String(Date.now() - 1000));
    const signOutSpy = jest.spyOn(AuthService, 'signOut');

    const result = await AuthService.refreshToken();

    expect(result).toBeNull();
    expect(signOutSpy).toHaveBeenCalled();
  });

  it('returns current access token in ensureValidToken when still valid', async () => {
    localStorage.setItem('auth.access_token', 'still-valid');
    localStorage.setItem('auth.access_expires_at', String(Date.now() + 60000));
    localStorage.setItem('auth.refresh_token', 'refresh');
    localStorage.setItem('auth.refresh_expires_at', String(Date.now() + 120000));

    const token = await AuthService.ensureValidToken();

    expect(token).toBe('still-valid');
  });

  it('refreshes in ensureValidToken when access token is expired', async () => {
    localStorage.setItem('auth.access_token', 'expired');
    localStorage.setItem('auth.access_expires_at', String(Date.now() - 1000));
    localStorage.setItem('auth.refresh_token', 'refresh');
    localStorage.setItem('auth.refresh_expires_at', String(Date.now() + 120000));
    jest.spyOn(AuthService, 'refreshToken').mockResolvedValue({
      ...baseAuthResponse,
      access_token: 'new-access',
    });

    const token = await AuthService.ensureValidToken();

    expect(token).toBe('new-access');
  });

  it('returns null for malformed current user JSON', () => {
    localStorage.setItem('auth.user', '{bad-json');

    const user = AuthService.getCurrentUser();

    expect(user).toBeNull();
  });
});

describe('AuthService – additional coverage', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
    global.fetch = jest.fn() as jest.Mock;
  });

  // ── signIn ────────────────────────────────────────────────────────────────

  it('stores all token fields on successful signIn', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => baseAuthResponse,
    });

    await AuthService.signIn({ username: 'john', password: 'secret' });

    expect(localStorage.getItem('auth.token_type')).toBe('Bearer');
    expect(localStorage.getItem('auth.session_state')).toBe('session-1');
    expect(localStorage.getItem('auth.scope')).toBe('openid');
    expect(localStorage.getItem('auth.not_before_policy')).toBe('0');
    expect(localStorage.getItem('auth.expires_in')).toBe('3600');
    expect(localStorage.getItem('auth.refresh_expires_in')).toBe('7200');
  });

  it('throws statusText fallback when error body is empty', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      statusText: 'Forbidden',
      text: async () => '',
    });

    await expect(
      AuthService.signIn({ username: 'x', password: 'y' }),
    ).rejects.toThrow('Forbidden');
  });

  // ── signUp ────────────────────────────────────────────────────────────────

  it('throws email-duplicate message when error contains "email" and "exists"', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({ message: 'email already exists' }),
    });

    await expect(AuthService.signUp(credentials)).rejects.toThrow(
      'Email is already used. Please use another email or sign in.',
    );
  });

  it('throws 409 generic message when body does not contain username/email keywords', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      text: async () => JSON.stringify({ message: 'conflict detected' }),
    });

    await expect(AuthService.signUp(credentials)).rejects.toThrow(
      'This username or email is already registered',
    );
  });

  it('throws 500 message for server errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => JSON.stringify({ message: 'DB down' }),
    });

    await expect(AuthService.signUp(credentials)).rejects.toThrow(
      'Server error occurred',
    );
  });

  it('throws network-error message on fetch failure', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Failed to fetch'));

    await expect(AuthService.signUp(credentials)).rejects.toThrow(
      'Network error',
    );
  });

  it('auto-signs-in when signUp succeeds but returns no tokens', async () => {
    // First call: signUp returns 200 but no access_token
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: {}, message: 'created' }),
      })
      // Second call: auto signIn
      .mockResolvedValueOnce({
        ok: true,
        json: async () => baseAuthResponse,
      });

    await AuthService.signUp(credentials);

    // The auto signIn stores the access token
    expect(localStorage.getItem('auth.access_token')).toBe('access-token');
  });

  // ── signOut ───────────────────────────────────────────────────────────────

  it('removes all auth keys from localStorage on signOut', async () => {
    const keys = [
      'auth.access_token', 'auth.refresh_token', 'auth.expires_in',
      'auth.refresh_expires_in', 'auth.token_type', 'auth.session_state',
      'auth.scope', 'auth.not_before_policy', 'auth.access_expires_at',
      'auth.refresh_expires_at', 'auth.user',
    ];
    keys.forEach((k) => localStorage.setItem(k, 'value'));

    await AuthService.signOut();

    keys.forEach((k) => {
      expect(localStorage.getItem(k)).toBeNull();
    });
  });

  it('dispatches auth:signout event on signOut', async () => {
    const listener = jest.fn();
    globalThis.addEventListener('auth:signout', listener);

    await AuthService.signOut();

    expect(listener).toHaveBeenCalled();
    globalThis.removeEventListener('auth:signout', listener);
  });

  // ── isAuthenticated ───────────────────────────────────────────────────────

  it('returns true when access token is valid', () => {
    localStorage.setItem('auth.access_token', 'tok');
    localStorage.setItem('auth.access_expires_at', String(Date.now() + 60000));
    expect(AuthService.isAuthenticated()).toBe(true);
  });

  it('returns false when both tokens are expired', () => {
    localStorage.setItem('auth.access_token', 'tok');
    localStorage.setItem('auth.access_expires_at', String(Date.now() - 1000));
    localStorage.setItem('auth.refresh_token', 'ref');
    localStorage.setItem('auth.refresh_expires_at', String(Date.now() - 1000));
    expect(AuthService.isAuthenticated()).toBe(false);
  });

  it('returns true when access expired but refresh still valid', () => {
    localStorage.setItem('auth.access_token', 'tok');
    localStorage.setItem('auth.access_expires_at', String(Date.now() - 1000));
    localStorage.setItem('auth.refresh_token', 'ref');
    localStorage.setItem('auth.refresh_expires_at', String(Date.now() + 60000));
    expect(AuthService.isAuthenticated()).toBe(true);
  });

  // ── getAccessToken ────────────────────────────────────────────────────────

  it('returns null from getAccessToken when not authenticated', () => {
    expect(AuthService.getAccessToken()).toBeNull();
  });

  it('returns the access token from getAccessToken when authenticated', () => {
    localStorage.setItem('auth.access_token', 'my-token');
    localStorage.setItem('auth.access_expires_at', String(Date.now() + 60000));
    expect(AuthService.getAccessToken()).toBe('my-token');
  });

  // ── setCurrentUser / getCurrentUser ───────────────────────────────────────

  it('stores and retrieves user via setCurrentUser/getCurrentUser', () => {
    const user = { id: 'u1', username: 'john', email: 'john@example.com' };
    AuthService.setCurrentUser(user);
    expect(AuthService.getCurrentUser()).toEqual(user);
  });

  // ── refreshToken ─────────────────────────────────────────────────────────

  it('returns null from refreshToken when no refresh token in storage', async () => {
    const result = await AuthService.refreshToken();
    expect(result).toBeNull();
  });

  it('returns null and signs out when refresh API fails', async () => {
    localStorage.setItem('auth.refresh_token', 'valid-refresh');
    localStorage.setItem('auth.refresh_expires_at', String(Date.now() + 120000));
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 });

    const signOutSpy = jest.spyOn(AuthService, 'signOut');
    const result = await AuthService.refreshToken();

    expect(result).toBeNull();
    expect(signOutSpy).toHaveBeenCalled();
  });

  it('stores new tokens on successful refreshToken', async () => {
    localStorage.setItem('auth.refresh_token', 'valid-refresh');
    localStorage.setItem('auth.refresh_expires_at', String(Date.now() + 120000));
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ...baseAuthResponse, access_token: 'new-tok' }),
    });

    const result = await AuthService.refreshToken();

    expect(result?.access_token).toBe('new-tok');
    expect(localStorage.getItem('auth.access_token')).toBe('new-tok');
  });

  // ── ensureValidToken ──────────────────────────────────────────────────────

  it('returns null and signs out when both tokens expired in ensureValidToken', async () => {
    localStorage.setItem('auth.access_token', 'exp');
    localStorage.setItem('auth.access_expires_at', String(Date.now() - 1000));
    localStorage.setItem('auth.refresh_token', 'exp-ref');
    localStorage.setItem('auth.refresh_expires_at', String(Date.now() - 1000));

    const signOutSpy = jest.spyOn(AuthService, 'signOut');
    const token = await AuthService.ensureValidToken();

    expect(token).toBeNull();
    expect(signOutSpy).toHaveBeenCalled();
  });
});