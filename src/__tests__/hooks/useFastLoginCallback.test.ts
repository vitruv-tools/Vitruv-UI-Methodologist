import { renderHook, waitFor } from '@testing-library/react';
import { useFastLoginCallback, navigateAfterFastLogin } from '../../hooks/useFastLoginCallback';

// ── helpers ──────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
const mockFastLoginWithCode = jest.fn();

// Mutable so individual tests can set the context user.
let mockContextUser: any = null;

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ fastLoginWithCode: mockFastLoginWithCode, user: mockContextUser }),
}));

function setSearch(search: string) {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { ...globalThis.location, search, pathname: '/auth/callback' },
  });
}

// ── navigateAfterFastLogin ────────────────────────────────────────────────────

describe('navigateAfterFastLogin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('always navigates to /mml regardless of emailVerified', () => {
    navigateAfterFastLogin({ id: '1', username: 'kit-user', emailVerified: false }, mockNavigate);
    expect(mockNavigate).toHaveBeenCalledWith('/mml', { replace: true });
  });

  it('navigates to /mml for verified users too', () => {
    navigateAfterFastLogin({ id: '1', username: 'kit-user', emailVerified: true }, mockNavigate);
    expect(mockNavigate).toHaveBeenCalledWith('/mml', { replace: true });
  });
});

// ── useFastLoginCallback ──────────────────────────────────────────────────────

describe('useFastLoginCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContextUser = null;
  });

  it('sets error when OAuth provider returns error param', async () => {
    setSearch('?error=access_denied&error_description=User+cancelled');

    const { result } = renderHook(() => useFastLoginCallback());

    await waitFor(() => {
      expect(result.current.error).toMatch(/User cancelled/i);
    });
    expect(result.current.isProcessing).toBe(false);
    expect(mockFastLoginWithCode).not.toHaveBeenCalled();
  });

  it('sets error when code param is missing', async () => {
    setSearch('?session_state=abc');

    const { result } = renderHook(() => useFastLoginCallback());

    await waitFor(() => {
      expect(result.current.error).toMatch(/missing authentication response/i);
    });
    expect(result.current.isProcessing).toBe(false);
  });

  it('calls fastLoginWithCode with the correct code', async () => {
    const fakeUser = { id: '1', username: 'kit-user', emailVerified: true };
    setSearch('?code=test-code-123');
    mockContextUser = fakeUser;
    mockFastLoginWithCode.mockResolvedValue(fakeUser);

    renderHook(() => useFastLoginCallback());

    await waitFor(() => {
      expect(mockFastLoginWithCode).toHaveBeenCalledWith('test-code-123');
    });
  });

  it('navigates to /mml when fastLoginWithCode succeeds and user is in context', async () => {
    const fakeUser = { id: '1', username: 'kit-user', emailVerified: true };
    setSearch('?code=test-code-123');
    // Simulate AuthContext already reflecting the user (as it does after
    // fastLoginWithCode calls setUser() internally).
    mockContextUser = fakeUser;
    mockFastLoginWithCode.mockResolvedValue(fakeUser);

    renderHook(() => useFastLoginCallback());

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/mml', { replace: true });
    });
  });

  it('does not navigate while user is still null in context', async () => {
    // User stays null — simulates the moment between exchange completing and
    // React committing the setUser() call. Navigation must wait.
    setSearch('?code=test-code-123');
    mockFastLoginWithCode.mockResolvedValue({ id: '1', username: 'kit-user' });
    // mockContextUser remains null

    renderHook(() => useFastLoginCallback());

    await waitFor(() => expect(mockFastLoginWithCode).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('sets error when fastLoginWithCode throws', async () => {
    setSearch('?code=bad-code');
    mockFastLoginWithCode.mockRejectedValue(new Error('Token exchange failed'));

    const { result } = renderHook(() => useFastLoginCallback());

    await waitFor(() => {
      expect(result.current.error).toBe('Token exchange failed');
    });
    expect(result.current.isProcessing).toBe(false);
  });

  it('initialises isProcessing true when code param is present', () => {
    setSearch('?code=abc');
    mockFastLoginWithCode.mockResolvedValue({ id: '1', username: 'u' });

    const { result } = renderHook(() => useFastLoginCallback());

    expect(result.current.isProcessing).toBe(true);
  });

  it('initialises isProcessing false when error param is present', () => {
    setSearch('?error=access_denied');

    const { result } = renderHook(() => useFastLoginCallback());

    expect(result.current.isProcessing).toBe(false);
  });
});
