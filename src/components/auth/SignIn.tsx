import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { AuthService, SignInCredentials } from '../../services/auth';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { AuthLayout, AuthErrorBanner } from './AuthLayout';
import { KitLogoIcon } from './KitLogoIcon';
import { MODAL_Z_INDEX, modalBackdropStyle, useModalBodyLock } from '../ui/modalUtils';

interface SignInProps {
  onSignInSuccess: (user: any) => void;
  onSwitchToSignUp: () => void;
}

export function SignIn({ onSignInSuccess, onSwitchToSignUp }: Readonly<SignInProps>) {
  const { signIn } = useAuth();
  const [credentials, setCredentials] = useState<SignInCredentials>({
    username: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  // Forgot password state
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetError, setResetError] = useState('');

  const closeForgotPasswordModal = () => {
    setIsForgotPasswordOpen(false);
    setResetError('');
    setResetSuccess('');
    setForgotPasswordEmail('');
  };

  const handleForgotPasswordBackdropClick = () => {
    if (isSendingReset) return;
    closeForgotPasswordModal();
  };

  const handleForgotPasswordBackdropKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (isSendingReset) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      closeForgotPasswordModal();
    }
  };

  useEffect(() => {
    if (!isForgotPasswordOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isSendingReset) return;
      e.preventDefault();
      closeForgotPasswordModal();
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [isForgotPasswordOpen, isSendingReset]);

  useModalBodyLock(isForgotPasswordOpen);
  useEffect(() => {
    const syncAutofill = () => {
      const usernameEl = document.getElementById('username') as HTMLInputElement | null;
      const passwordEl = document.getElementById('password') as HTMLInputElement | null;
      const username = usernameEl?.value ?? '';
      const password = passwordEl?.value ?? '';
      if (!username && !password) return;
      setCredentials(prev => ({
        username: username || prev.username,
        password: password || prev.password,
      }));
    };

    syncAutofill();
    const t1 = globalThis.setTimeout(syncAutofill, 100);
    const t2 = globalThis.setTimeout(syncAutofill, 500);
    return () => {
      globalThis.clearTimeout(t1);
      globalThis.clearTimeout(t2);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const syncFieldValue = (e: React.FormEvent<HTMLInputElement>) => {
    const { name, value } = e.currentTarget;
    setCredentials(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.username.trim() || !credentials.password) {
      setError('Please fill in all fields');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const userInfo = await signIn(credentials.username, credentials.password);
      onSignInSuccess(userInfo);
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'Sign in failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setResetError('');
    setResetSuccess('');
    if (!forgotPasswordEmail?.includes('@')) {
      setResetError('Please enter a valid email address');
      return;
    }
    setIsSendingReset(true);
    try {
      const response = await apiService.forgotPassword(forgotPasswordEmail);
      setResetSuccess(response.message || 'Password reset instructions have been sent to your email address.');
      setForgotPasswordEmail('');
      setTimeout(() => {
        setIsForgotPasswordOpen(false);
        setResetSuccess('');
      }, 3000);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleFastLogin = () => {
    try {
      setError(null);
      const authorizationUrl = AuthService.getFastLoginAuthorizationUrl();
      globalThis.location.assign(authorizationUrl);
    } catch (err: any) {
      setError(err?.message || 'Unable to start Fast Login. Please try again.');
    }
  };

  return (
    <AuthLayout>
      <div className="mock-auth-header">
        <h1>Welcome Back</h1>
        <p>Log in to your Vitruv account</p>
      </div>

      <form onSubmit={handleSubmit} className="mock-auth-form">
        <AuthErrorBanner message={error} />

        <div className="mock-form-group">
          <label htmlFor="username">Username or Email *</label>
          <input
            id="username"
            name="username"
            type="text"
            value={credentials.username}
            onChange={handleInputChange}
            onInput={syncFieldValue}
            autoComplete="username"
            placeholder="Enter your username or email"
            disabled={isLoading}
            required
          />
        </div>

        <div className="mock-form-group">
          <label htmlFor="password">Password *</label>
          <input
            id="password"
            name="password"
            type="password"
            value={credentials.password}
            onChange={handleInputChange}
            onInput={syncFieldValue}
            autoComplete="current-password"
            placeholder="Enter your password"
            disabled={isLoading}
            required
          />
        </div>

        <div className="mock-form-options">
          <label className="mock-checkbox-container">
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
              disabled={isLoading}
            />
            <span>Keep me signed in</span>
          </label>
          <button
            type="button"
            className="mock-forgot-link"
            onClick={() => setIsForgotPasswordOpen(true)}
            disabled={isLoading}
          >
            Forgot Password?
          </button>
        </div>

        <button
          type="submit"
          className="mock-action-button"
          disabled={isLoading}
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <div className="mock-auth-divider">
        <span>or</span>
      </div>

      <button
        type="button"
        className="mock-action-button mock-fast-login-button"
        onClick={handleFastLogin}
        disabled={isLoading}
      >
        <KitLogoIcon className="mock-fast-login-icon" />
        <span className="mock-fast-login-label">Log in with KIT account</span>
      </button>

      {/* Switch to Sign Up */}
      <div className="mock-auth-footer">
        <p>
          Don't have an account yet?{' '}
          <button type="button" className="mock-signup-link" onClick={onSwitchToSignUp} disabled={isLoading}>
            Sign Up
          </button>
        </p>
      </div>

      {/* Forgot Password Modal — portaled and viewport-centered */}
      {isForgotPasswordOpen && ReactDOM.createPortal(
        <>
          <button
            type="button"
            aria-label="Close password reset dialog"
            tabIndex={isSendingReset ? -1 : 0}
            onClick={handleForgotPasswordBackdropClick}
            onKeyDown={handleForgotPasswordBackdropKeyDown}
            style={{ ...modalBackdropStyle, zIndex: MODAL_Z_INDEX }}
          />
          <div
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: MODAL_Z_INDEX + 1,
              pointerEvents: 'none',
              padding: 16,
              boxSizing: 'border-box',
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="forgot-password-title"
              aria-describedby="forgot-password-description"
              style={{
                pointerEvents: 'auto',
                background: '#ffffff',
                borderRadius: 14,
                padding: '28px 32px 24px',
                width: '100%',
                maxWidth: 400,
                boxShadow: '0 20px 40px rgba(15, 23, 42, 0.14)',
                textAlign: 'center',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ marginBottom: 4 }}>
                <h2
                  id="forgot-password-title"
                  style={{
                    margin: '0 0 10px 0',
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#0f172a',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Password Reset
                </h2>
                <p
                  id="forgot-password-description"
                  style={{
                    margin: '0 0 20px 0',
                    color: '#64748b',
                    fontSize: 14,
                    lineHeight: 1.55,
                    maxWidth: '20rem',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                  }}
                >
                  Enter your registered email address. Password reset instructions will be sent to your inbox.
                </p>
              </div>

              {resetError && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  marginBottom: 12,
                  fontSize: 13,
                  lineHeight: 1.45,
                  textAlign: 'center',
                  background: '#fef2f2',
                  color: '#991b1b',
                }}
                >
                  {resetError}
                </div>
              )}
              {resetSuccess && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  marginBottom: 12,
                  fontSize: 13,
                  lineHeight: 1.45,
                  textAlign: 'center',
                  background: '#ecfdf5',
                  color: '#065f46',
                }}
                >
                  {resetSuccess}
                </div>
              )}

              <input
                type="email"
                className="modal-input"
                placeholder="Email address"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                disabled={isSendingReset}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  boxSizing: 'border-box',
                  fontSize: 14,
                  textAlign: 'left',
                }}
              />

              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 10,
                marginTop: 22,
              }}
              >
                <button type="button" className="btn-secondary" onClick={closeForgotPasswordModal} disabled={isSendingReset}>
                  Cancel
                </button>
                <button type="button" className="btn-primary-gradient" onClick={handleForgotPassword} disabled={isSendingReset}>
                  {isSendingReset ? 'Sending…' : 'Send instructions'}
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}
    </AuthLayout>
  );
}
