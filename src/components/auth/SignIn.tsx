import React, { useEffect, useState } from 'react';
import { AuthService, SignInCredentials } from '../../services/auth';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { AuthLayout, AuthErrorBanner } from './AuthLayout';

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.username || !credentials.password) {
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
      setResetSuccess(response.message || 'Password reset instructions have been sent to your email!');
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
          className="mock-submit-button"
          disabled={isLoading || !credentials.username || !credentials.password}
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      {/* Fast Login */}
      <div className="mock-auth-footer" style={{ marginTop: '8px' }}>
        <button
          type="button"
          className="mock-submit-button"
          onClick={handleFastLogin}
          disabled={isLoading}
          style={{ width: '100%' }}
        >
          Fast Login (KIT/FeLS)
        </button>
      </div>

      {/* Switch to Sign Up */}
      <div className="mock-auth-footer">
        <p>
          Don't have an account yet?{' '}
          <button type="button" className="mock-signup-link" onClick={onSwitchToSignUp} disabled={isLoading}>
            Sign Up
          </button>
        </p>
      </div>

      {/* Forgot Password Modal */}
      {isForgotPasswordOpen && (
        <div className="modal-backdrop" onClick={closeForgotPasswordModal}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reset Password</h2>
              <p>Enter your email address and we'll send you instructions to reset your password.</p>
            </div>

            {resetError && (
              <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '10px', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>
                ⚠️ {resetError}
              </div>
            )}
            {resetSuccess && (
              <div style={{ backgroundColor: '#ecfdf5', color: '#065f46', padding: '10px', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>
                ✅ {resetSuccess}
              </div>
            )}

            <input
              type="email"
              className="modal-input"
              placeholder="Email address"
              value={forgotPasswordEmail}
              onChange={(e) => setForgotPasswordEmail(e.target.value)}
              disabled={isSendingReset}
            />

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={closeForgotPasswordModal} disabled={isSendingReset}>
                Cancel
              </button>
              <button type="button" className="btn-primary-gradient" onClick={handleForgotPassword} disabled={isSendingReset}>
                {isSendingReset ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
