import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../services/auth';

function getAuthorizationCode(): string | null {
  const params = new URLSearchParams(globalThis.location.search);
  const raw = params.get('code');
  const code = raw?.trim() || '';
  return code || null;
}

function getOAuthCallbackError(): string | null {
  const params = new URLSearchParams(globalThis.location.search);
  return params.get('error_description') || params.get('error');
}

export function navigateAfterFastLogin(
  user: User,
  navigate: ReturnType<typeof useNavigate>,
): void {
  // Clear the authorization code from the URL so it isn't reused.
  globalThis.history.replaceState({}, '', globalThis.location.pathname);

  // FeLS/KIT users authenticated via an external trusted IDP — always go
  // straight to the workspace, bypassing internal OTP verification.
  console.log('[Fast Login] Navigating to workspace for external IDP user', user.username);
  navigate('/mml', { replace: true });
}

/**
 * Completes fast login when Keycloak redirects back with ?code=...
 */
export function useFastLoginCallback(): {
  isProcessing: boolean;
  error: string | null;
} {
  const navigate = useNavigate();
  const { fastLoginWithCode } = useAuth();
  const exchangeStartedRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(() => {
    const params = new URLSearchParams(globalThis.location.search);
    const oauthError = getOAuthCallbackError();
    if (oauthError) return false;

    return params.has('code');
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const oauthError = getOAuthCallbackError();
    if (oauthError) {
      console.error('[Fast Login] OAuth provider returned error:', oauthError);
      setError(oauthError);
      setIsProcessing(false);
      return;
    }

    const authorizationCode = getAuthorizationCode();
    if (!authorizationCode) {
      console.error('[Fast Login] Missing Fast Login authentication parameter', {
        available: Object.fromEntries(new URLSearchParams(globalThis.location.search).entries()),
      });
      setError(
        'Fast Login failed: missing authentication response. Please try again from the sign-in page.',
      );
      setIsProcessing(false);
      return;
    }

    if (exchangeStartedRef.current) {
      return;
    }
    exchangeStartedRef.current = true;

    console.log('[Fast Login] Authorization code received, starting token exchange');

    let cancelled = false;

    const complete = async () => {
      try {
        const user = await fastLoginWithCode(authorizationCode);
        if (cancelled) return;
        navigateAfterFastLogin(user, navigate);
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Fast login failed. Please try again.';
        console.error('[Fast Login] Callback handling failed:', message);
        setError(message);
        setIsProcessing(false);
        exchangeStartedRef.current = false;
      }
    };

    complete();

    return () => {
      cancelled = true;
    };
  }, [fastLoginWithCode, navigate]);

  return { isProcessing, error };
}
