import { useEffect, useRef } from 'react';
import { AuthService } from '../services/auth';

export function useTokenRefresh() {
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Set up automatic token refresh
    const setupTokenRefresh = () => {
      const accessExpiresAt = localStorage.getItem('auth.access_expires_at');
      if (!accessExpiresAt) return;

      const expirationTime = parseInt(accessExpiresAt, 10);
      const now = Date.now();
      const timeUntilExpiry = expirationTime - now;

      // If token expires in less than 5 minutes, refresh immediately
      if (timeUntilExpiry < 5 * 60 * 1000) {
        AuthService.refreshToken().catch(console.error);
      }

      // Set up interval to check token every minute
      refreshIntervalRef.current = setInterval(async () => {
        const currentExpiresAt = localStorage.getItem('auth.access_expires_at');
        if (!currentExpiresAt) return;

        const currentExpirationTime = parseInt(currentExpiresAt, 10);
        const currentTime = Date.now();
        const currentTimeUntilExpiry = currentExpirationTime - currentTime;

        // Refresh token if it expires in less than 5 minutes
        if (currentTimeUntilExpiry < 5 * 60 * 1000) {
          try {
            await AuthService.refreshToken();
          } catch (error) {
            console.error('Automatic token refresh failed:', error);
            // If refresh fails, clear the interval
            if (refreshIntervalRef.current) {
              clearInterval(refreshIntervalRef.current);
              refreshIntervalRef.current = null;
            }
          }
        }
      }, 60 * 1000); // Check every minute
    };

    // Only set up refresh if user is authenticated
    if (AuthService.isAuthenticated()) {
      setupTokenRefresh();
    }

    // Cleanup function
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, []);

  // Function to manually refresh token
  const refreshToken = async () => {
    try {
      return await AuthService.refreshToken();
    } catch (error) {
      console.error('Manual token refresh failed:', error);
      throw error;
    }
  };

  // Function to get a valid token (refreshes if needed)
  const getValidToken = async () => {
    return await AuthService.ensureValidToken();
  };

  return {
    refreshToken,
    getValidToken,
  };
} 