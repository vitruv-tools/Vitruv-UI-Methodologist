import { renderHook, act, waitFor } from '@testing-library/react';
import { useTokenRefresh } from '../../hooks/useTokenRefresh';
import { AuthService, AuthResponse } from '../../services/auth';

// Mock AuthService
jest.mock('../../services/auth', () => ({
    AuthService: {
        isAuthenticated: jest.fn(),
        refreshToken: jest.fn(),
        ensureValidToken: jest.fn(),
    },
}));

const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;

const mockAuthResponse: AuthResponse = {
    access_token: 'new-access-token',
    refresh_token: 'new-refresh-token',
    expires_in: 3600,
    refresh_expires_in: 7200,
    token_type: 'Bearer',
    session_state: 'session-123',
    scope: 'openid',
    'not-before-policy': 0,
};

const FIVE_MINUTES = 5 * 60 * 1000;

const setTokenExpiry = (msFromNow: number) => {
    localStorage.setItem('auth.access_expires_at', String(Date.now() + msFromNow));
};

describe('useTokenRefresh', () => {

    beforeEach(() => {
        jest.useFakeTimers();
        localStorage.clear();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('setup', () => {
        it('should not set up refresh if user is not authenticated', () => {
            mockAuthService.isAuthenticated.mockReturnValue(false);

            renderHook(() => useTokenRefresh());

            expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
        });

        it('should not set up refresh if no token expiry is stored', () => {
            mockAuthService.isAuthenticated.mockReturnValue(true);
            // No localStorage entry set

            renderHook(() => useTokenRefresh());

            expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
        });
    });

    describe('immediate refresh', () => {
        it('should refresh immediately if token expires in less than 5 minutes', async () => {
            mockAuthService.isAuthenticated.mockReturnValue(true);
            mockAuthService.refreshToken.mockResolvedValue(mockAuthResponse);
            setTokenExpiry(FIVE_MINUTES - 1000); // expires in ~4:59

            renderHook(() => useTokenRefresh());

            await waitFor(() => {
                expect(mockAuthService.refreshToken).toHaveBeenCalledTimes(1);
            });
        });

        it('should not refresh immediately if token has more than 5 minutes left', () => {
            mockAuthService.isAuthenticated.mockReturnValue(true);
            mockAuthService.refreshToken.mockResolvedValue(mockAuthResponse);
            setTokenExpiry(FIVE_MINUTES + 10000); // expires in ~5:10

            renderHook(() => useTokenRefresh());

            expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
        });
    });

    describe('interval refresh', () => {
        it('should refresh token after interval if token is about to expire', async () => {
            mockAuthService.isAuthenticated.mockReturnValue(true);
            mockAuthService.refreshToken.mockResolvedValue(mockAuthResponse);
            setTokenExpiry(FIVE_MINUTES + 10000); // not expiring yet

            renderHook(() => useTokenRefresh());

            // Simulate token now about to expire
            setTokenExpiry(FIVE_MINUTES - 1000);

            act(() => {
                jest.advanceTimersByTime(60 * 1000);
            });

            await waitFor(() => {
                expect(mockAuthService.refreshToken).toHaveBeenCalledTimes(1);
            });
        });

        it('should not refresh if token still has plenty of time during interval', () => {
            mockAuthService.isAuthenticated.mockReturnValue(true);
            mockAuthService.refreshToken.mockResolvedValue(mockAuthResponse);
            setTokenExpiry(FIVE_MINUTES + 60000 * 10); // 10 Minuten statt nur wenige Sekunden Puffer

            renderHook(() => useTokenRefresh());

            act(() => {
                jest.advanceTimersByTime(60 * 1000);
            });

            expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
        });

        it('should clear interval if refresh fails during interval', async () => {
            mockAuthService.isAuthenticated.mockReturnValue(true);
            mockAuthService.refreshToken.mockRejectedValue(new Error('Refresh failed'));
            setTokenExpiry(FIVE_MINUTES - 1000); // about to expire

            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

            renderHook(() => useTokenRefresh());

            act(() => {
                jest.advanceTimersByTime(60 * 1000);
            });

            await waitFor(() => {
                expect(clearIntervalSpy).toHaveBeenCalled();
            });
        });
    });

    describe('cleanup', () => {
        it('should clear interval on unmount', () => {
            mockAuthService.isAuthenticated.mockReturnValue(true);
            mockAuthService.refreshToken.mockResolvedValue(mockAuthResponse);
            setTokenExpiry(FIVE_MINUTES + 10000);

            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
            const { unmount } = renderHook(() => useTokenRefresh());

            unmount();

            expect(clearIntervalSpy).toHaveBeenCalled();
        });
    });

    describe('refreshToken', () => {
        it('should call AuthService.refreshToken', async () => {
            mockAuthService.isAuthenticated.mockReturnValue(false);
            mockAuthService.refreshToken.mockResolvedValue(mockAuthResponse);

            const { result } = renderHook(() => useTokenRefresh());

            await act(async () => {
                await result.current.refreshToken();
            });

            expect(mockAuthService.refreshToken).toHaveBeenCalledTimes(1);
        });

        it('should return the AuthResponse on success', async () => {
            mockAuthService.isAuthenticated.mockReturnValue(false);
            mockAuthService.refreshToken.mockResolvedValue(mockAuthResponse);

            const { result } = renderHook(() => useTokenRefresh());

            let response: AuthResponse | null = null;
            await act(async () => {
                response = await result.current.refreshToken();
            });

            expect(response).toEqual(mockAuthResponse);
        });

        it('should throw if AuthService.refreshToken fails', async () => {
            mockAuthService.isAuthenticated.mockReturnValue(false);
            mockAuthService.refreshToken.mockRejectedValue(new Error('Failed'));

            const { result } = renderHook(() => useTokenRefresh());

            await expect(
                act(async () => { await result.current.refreshToken(); })
            ).rejects.toThrow('Failed');
        });
    });

    describe('getValidToken', () => {
        it('should call AuthService.ensureValidToken', async () => {
            mockAuthService.isAuthenticated.mockReturnValue(false);
            mockAuthService.ensureValidToken.mockResolvedValue('valid-token');

            const { result } = renderHook(() => useTokenRefresh());

            await act(async () => {
                await result.current.getValidToken();
            });

            expect(mockAuthService.ensureValidToken).toHaveBeenCalledTimes(1);
        });

        it('should return the token string on success', async () => {
            mockAuthService.isAuthenticated.mockReturnValue(false);
            mockAuthService.ensureValidToken.mockResolvedValue('valid-token');

            const { result } = renderHook(() => useTokenRefresh());

            let token: string | null = null;
            await act(async () => {
                token = await result.current.getValidToken();
            });

            expect(token).toBe('valid-token');
        });

        it('should return null if no valid token exists', async () => {
            mockAuthService.isAuthenticated.mockReturnValue(false);
            mockAuthService.ensureValidToken.mockResolvedValue(null);

            const { result } = renderHook(() => useTokenRefresh());

            let token: string | null = 'initial';
            await act(async () => {
                token = await result.current.getValidToken();
            });

            expect(token).toBeNull();
        });

        it('should throw if AuthService.ensureValidToken fails', async () => {
            mockAuthService.isAuthenticated.mockReturnValue(false);
            mockAuthService.ensureValidToken.mockRejectedValue(new Error('No valid token'));

            const { result } = renderHook(() => useTokenRefresh());

            await expect(
                act(async () => { await result.current.getValidToken(); })
            ).rejects.toThrow('No valid token');
        });
    });

});