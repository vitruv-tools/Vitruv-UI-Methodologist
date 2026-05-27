import React, { useEffect, useState } from 'react';
import { AuthService, SignInCredentials } from '../../services/auth';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import './Auth.css';

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
  
  // Forgot password states
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
      if (e.key !== 'Escape') return;
      if (isSendingReset) return;
      e.preventDefault();
      closeForgotPasswordModal();
    };

    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [isForgotPasswordOpen, isSendingReset]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
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
      
      // Call success callback with user info including emailVerified status
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
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Failed to send reset email');
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
    <div 
      className="auth-container"
      style={{
        backgroundImage: `url(${process.env.PUBLIC_URL}/assets/vitruvius1.png)`,
        backgroundSize: 'contain',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#f0f0f0'
      }}
    >
      <div className="auth-card">
        <div className="auth-header">
          <h1>Welcome Back</h1>
          <p>Sign in to your Vitruv account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Username or Email</label>
            <input
              type="text"
              id="username"
              name="username"
              value={credentials.username}
              onChange={handleInputChange}
              placeholder="Enter your username or email"
              disabled={isLoading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={credentials.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              disabled={isLoading}
              required
            />
          </div>

          <div style={{ 
            textAlign: 'right', 
            marginBottom: '16px',
            marginTop: '-8px'
          }}>
            <button
              type="button"
              className="link-button"
              onClick={() => setIsForgotPasswordOpen(true)}
              disabled={isLoading}
              style={{
                fontSize: '13px',
                color: '#049484',
                fontWeight: 500,
              }}
            >
              Forgot your password?
            </button>
          </div>

          <button
            type="submit"
            className="auth-button primary"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading-spinner">
                <div className="spinner"></div>
                Signing In...
              </span>
            ) : (
              'Sign In'
            )}
          </button>

          <button
            type="button"
            className="auth-button secondary"
            disabled={isLoading}
            onClick={handleFastLogin}
            style={{ marginTop: '12px' }}
          >
            Fast Login (KIT/FeLS)
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <button
              type="button"
              className="link-button"
              onClick={onSwitchToSignUp}
              disabled={isLoading}
            >
              Sign Up
            </button>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotPasswordOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close forgot password modal"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            animation: 'fadeIn 0.2s ease-out',
            cursor: 'default',
          }}
          onClick={(e) => {
            // Only close if clicking directly on the backdrop, not its children
            if (e.target === e.currentTarget && !isSendingReset) {
              closeForgotPasswordModal();
            }
          }}
          onTouchEnd={(e) => {
            // Mirror backdrop-close behavior for touch interactions
            if (e.target === e.currentTarget && !isSendingReset) {
              closeForgotPasswordModal();
            }
          }}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget || isSendingReset) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              closeForgotPasswordModal();
            }
          }}
        >
          <dialog
            open
            aria-modal="true"
            aria-labelledby="forgot-password-title"
            style={{
              background: '#ffffff',
              border: 'none',
              borderRadius: 16,
              padding: 0,
              width: '90%',
              maxWidth: 480,
              boxShadow: '0 24px 72px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
              animation: 'slideUp 0.3s ease-out',
            }}
          >
            {/* Header with gradient */}
            <div style={{
              background: 'linear-gradient(135deg, #049484 0%, #037368 100%)',
              padding: '28px 32px',
              color: '#ffffff',
              borderBottom: '3px solid #037368',
            }}>
              <h2
                id="forgot-password-title"
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: '-0.5px',
                  lineHeight: 1.3,
                }}
              >
                Password Recovery
              </h2>
              <p style={{
                margin: '10px 0 0 0',
                fontSize: 14,
                opacity: 0.95,
                fontWeight: 400,
                lineHeight: 1.5,
              }}>
                Please provide your registered email address. We will send a new password to your inbox for account recovery.
              </p>
            </div>

            {/* Form Content */}
            <div style={{ padding: '32px' }}>
              <div style={{ marginBottom: 24 }}>
                <label
                  htmlFor="forgot-password-email"
                  style={{
                    display: 'block',
                    marginBottom: 10,
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#1f2937',
                    letterSpacing: '0.2px',
                  }}
                >
                  Registered Email Address
                </label>
                <input
                  id="forgot-password-email"
                  type="email"
                  value={forgotPasswordEmail}
                  onChange={(e) => {
                    setForgotPasswordEmail(e.target.value);
                    setResetError('');
                  }}
                  placeholder="your.email@example.com"
                  disabled={isSendingReset}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 14,
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    background: '#f9fafb',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#049484';
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(4, 148, 132, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isSendingReset && forgotPasswordEmail) {
                      handleForgotPassword();
                    }
                  }}
                />
              </div>

              {resetError && (
                <div style={{
                  padding: '14px 16px',
                  background: '#fef2f2',
                  border: '2px solid #fecaca',
                  borderRadius: 8,
                  color: '#991b1b',
                  fontSize: 13,
                  marginBottom: 20,
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}>
                  {resetError}
                </div>
              )}

              {resetSuccess && (
                <div style={{
                  padding: '14px 16px',
                  background: '#d5f4e6',
                  border: '2px solid #a9dfbf',
                  borderRadius: 8,
                  color: '#166534',
                  fontSize: 13,
                  marginBottom: 20,
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}>
                  {resetSuccess}
                </div>
              )}

              <div style={{
                display: 'flex',
                gap: 12,
                justifyContent: 'flex-end',
                paddingTop: 4,
              }}>
                <button
                  onClick={() => {
                    setIsForgotPasswordOpen(false);
                    setResetError('');
                    setResetSuccess('');
                    setForgotPasswordEmail('');
                  }}
                  disabled={isSendingReset}
                  style={{
                    padding: '12px 24px',
                    borderRadius: 8,
                    border: '2px solid #e5e7eb',
                    background: '#ffffff',
                    color: '#374151',
                    cursor: isSendingReset ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                    transition: 'all 0.2s ease',
                    opacity: isSendingReset ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSendingReset) {
                      e.currentTarget.style.background = '#f9fafb';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSendingReset) {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleForgotPassword}
                  disabled={isSendingReset || !forgotPasswordEmail}
                  style={{
                    padding: '12px 28px',
                    borderRadius: 8,
                    border: '2px solid #037368',
                    background: (isSendingReset || !forgotPasswordEmail) ? '#95a5a6' : 'linear-gradient(135deg, #049484 0%, #037368 100%)',
                    color: '#ffffff',
                    cursor: (isSendingReset || !forgotPasswordEmail) ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: 14,
                    transition: 'all 0.2s ease',
                    boxShadow: (isSendingReset || !forgotPasswordEmail) ? 'none' : '0 2px 8px rgba(4, 148, 132, 0.25)',
                    opacity: (isSendingReset || !forgotPasswordEmail) ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSendingReset && forgotPasswordEmail) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(4, 148, 132, 0.35)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSendingReset && forgotPasswordEmail) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(4, 148, 132, 0.25)';
                    }
                  }}
                >
                  {isSendingReset ? 'Processing Request...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </dialog>
        </div>
      )}
    </div>
  );
}
