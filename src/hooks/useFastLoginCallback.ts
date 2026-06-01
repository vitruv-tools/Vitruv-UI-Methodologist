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
 *
 * Two-phase design:
 *  1. Exchange the code for tokens (async, guarded against double-execution).
 *  2. Navigate only after `user` is committed in AuthContext.
 *
 * React.StrictMode runs effects twice in development. The guard ref stops the
 * second run from starting a second exchange (authorization codes are
 * single-use). However, the first run's async callback may be cancelled before
 * it can trigger navigation. Phase 2 solves this: it watches `user` directly
 * and fires as soon as AuthContext reflects the new user — regardless of
 * whether phase 1's callback was cancelled by the StrictMode cleanup.
 */
export function useFastLoginCallback(): {
  isProcessing: boolean;
  error: string | null;
} {
  const navigate = useNavigate();
  const { fastLoginWithCode, user } = useAuth();
  const exchangeStartedRef = useRef(false);

  const [isProcessing, setIsProcessing] = useState(() => {
    const oauthError = getOAuthCallbackError();
    if (oauthError) return false;
    return new URLSearchParams(globalThis.location.search).has('code');
  });
  const [error, setError] = useState<string | null>(null);

  // ── Phase 1: kick off the token exchange ─────────────────────────────────
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

    // Guard: authorization codes are single-use. Prevent a second exchange
    // request (e.g. from React StrictMode's intentional double-mount).
    if (exchangeStartedRef.current) return;
    exchangeStartedRef.current = true;

    console.log('[Fast Login] Authorization code received, starting token exchange');

    let cancelled = false;

    const complete = async () => {
      try {
        // fastLoginWithCode calls setUser() internally — that state update
        // is what Phase 2 watches to trigger navigation.
        await fastLoginWithCode(authorizationCode);
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
  }, [fastLoginWithCode]);

  // ── Phase 2: navigate once AuthContext has committed the new user ─────────
  //
  // Watching `user` (instead of a separate "pendingNavigate" flag) handles the
  // StrictMode scenario: even if Phase 1's async callback was cancelled before
  // it could set a flag, fastLoginWithCode already called setUser() — so
  // `user` becomes non-null and this effect fires on the very next render.
  useEffect(() => {
    if (!isProcessing || !user) return;

    navigateAfterFastLogin(user, navigate);
  }, [isProcessing, user, navigate]);

  return { isProcessing, error };
}
