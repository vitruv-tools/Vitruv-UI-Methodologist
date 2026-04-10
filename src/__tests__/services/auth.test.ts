import { AuthService, AuthResponse, SignUpCredentials } from '../../services/auth';

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
