import React, { useEffect, useState } from 'react';
import { AuthService, SignInCredentials } from '../../services/auth';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';

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
    <div className="unified-auth-container">
      <style>{`
        /* Gesamter Viewport mit Video-Hintergrund */
        .unified-auth-container {
          position: relative;
          display: flex;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          background-color: #f7f9fa;
        }

        /* 🎥 Hintergrundvideo-Styling mit leichtem Blur-Effekt */
        .auth-bg-video {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 1;
          pointer-events: none;
          filter: blur(3px);
          transform: scale(1.12) translateY(32px);
        }

        /* Linker Bereich für die schwebende Grafik */
        .auth-left-image-area {
          position: relative;
          z-index: 2; 
          flex: 0 0 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 0 40px 40px;
          box-sizing: border-box;
          overflow: visible;
        }

        /* Präzise Skalierung und Verschiebung deiner Grafik */
        .auth-floating-img {
          width: 100%;
          height: 100%;
          max-height: 90vh;
          object-fit: contain;
          transform: scale(2.0) translate(150px, 0px);
        }

        /* Rechter Bereich für das Formular */
        .auth-right-form-area {
          position: relative;
          z-index: 2;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          box-sizing: border-box;
        }

        @media (max-width: 950px) {
          .auth-left-image-area { display: none; }
          .auth-right-form-area { flex: 0 0 100%; }
        }

        /* Die weiße Login-Karte (exakt Maße der Sign Up Karte) */
        .mock-auth-card {
          background: #ffffff;
          width: 100%;
          max-width: 460px;
          border-radius: 16px;
          padding: 35px 35px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.06);
          text-align: center;
          box-sizing: border-box;
          transform: translate(-100px, 0px); 
        }

        .mock-logo-container {
          margin-bottom: 20px;
          display: flex;
          justify-content: center;
        }

        .fallback-logo {
          font-size: 32px;
          font-weight: 900;
          color: #1f9f92;
          letter-spacing: -1.5px;
        }

        .mock-auth-header h1 {
          font-size: 28px;
          color: #09182e;
          margin: 0 0 6px 0;
          font-weight: 700;
        }

        .mock-auth-header p {
          font-size: 14px;
          color: #64748b;
          margin: 0 0 24px 0;
        }

        .mock-auth-form { text-align: left; }
        .mock-form-group { margin-bottom: 16px; }

        .mock-form-group label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #049484;
          margin-bottom: 6px;
        }

        .mock-form-group input {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 14px;
          color: #049484;
          background-color: #ffffff;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }

        .mock-form-group input:focus {
          outline: none;
          border-color: #1f9f92;
        }

        /* Zusätzliche Optionen für Keep Signed In & Forgot Password */
        .mock-form-options {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 20px 0;
          font-size: 14px;
        }

        .mock-checkbox-container {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #475569;
          cursor: pointer;
        }

        .mock-checkbox-container input {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .mock-forgot-link {
          background: none;
          border: none;
          color: #049484;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          padding: 0;
        }

        .mock-forgot-link:hover {
          color: #1f9f92;
        }

        .mock-submit-button {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 30px;
          background: linear-gradient(90deg, #1f9f92 0%, #037368 100%);
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(3, 115, 104, 0.3);
          transition: opacity 0.2s;
          margin-top: 8px;
        }

        .mock-submit-button:hover:not(:disabled) { opacity: 0.95; }

        .mock-auth-footer {
          margin-top: 20px;
          font-size: 14px;
          color: #475569;
          text-align: center;
        }

        .mock-signup-link {
          background: none;
          border: none;
          color: #0f172a;
          font-weight: 700;
          cursor: pointer;
          padding: 0;
        }

        /* Modal Styles */
        .modal-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000;
        }
        .modal-dialog {
          background: white; border: none; border-radius: 12px;
          padding: 24px; max-width: 400px; width: 90%; box-shadow: 0 20px 25px rgba(0,0,0,0.1);
          font-family: inherit;
        }
        .modal-header h2 { margin: 0 0 8px 0; font-size: 20px; color: #0f172a; }
        .modal-header p { margin: 0 0 16px 0; color: #64748b; font-size: 14px; }
        .modal-input {
          width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; margin-top: 8px;
        }
        .modal-input:focus { outline: none; border-color: #1f9f92; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
        .btn-secondary { background: #f1f5f9; border: none; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-weight: 600; }
        .btn-primary-gradient {
          background: linear-gradient(90deg, #1f9f92 0%, #037368 100%); color: white; border: none; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-weight: 600;
        }
      `}</style>

      {/* 🎥 Das Video-Element */}
      <video
        className="auth-bg-video"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src={`${process.env.PUBLIC_URL}/assets/Video Project 6.mp4`} type="video/mp4" />
      </video>

      {/* Linke Seite (Grafik) */}
      <div className="auth-left-image-area">
        <img
          src={`${process.env.PUBLIC_URL}/assets/loginside.png`}
          alt="Vitruvius Graphics"
          className="auth-floating-img"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      {/* Rechte Seite (Formular-Card) */}
      <div className="auth-right-form-area">
        <div className="mock-auth-card">

          {/* Logo */}
          <div className="mock-logo-container">
            <img
              src={`${process.env.PUBLIC_URL}/assets/logo_new.png`}
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const container = e.currentTarget.parentElement;
                if (container && !container.querySelector('.fallback-logo')) {
                  const fallback = document.createElement('div');
                  fallback.className = 'fallback-logo';
                  fallback.innerText = 'VITRUVIUS';
                  container.appendChild(fallback);
                }
              }}
              style={{ height: '100px', objectFit: 'contain' }}
            />
          </div>

          <div className="mock-auth-header">
            <h1>Welcome Back</h1>
            <p>Log in to your Vitruv account</p>
          </div>

          <form onSubmit={handleSubmit} className="mock-auth-form">
            {error && (
              <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
                ⚠️ {error}
              </div>
            )}

            {/* Username / Email */}
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

            {/* Password */}
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

            {/* Checkbox & Forgot Password Row */}
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

            {/* Submit Button */}
            <button
              type="submit"
              className="mock-submit-button"
              disabled={isLoading || !credentials.username || !credentials.password}
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </button>
          </form>

          {/* Footer Switching Link */}
          <div className="mock-auth-footer">
            <p>
              Don't have an account yet?{" "}
              <button type="button" className="mock-signup-link" onClick={onSwitchToSignUp} disabled={isLoading}>
                Sign Up
              </button>
            </p>
          </div>

        </div>
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
              <button
                type="button"
                className="btn-secondary"
                onClick={closeForgotPasswordModal}
                disabled={isSendingReset}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary-gradient"
                onClick={handleForgotPassword}
                disabled={isSendingReset}
              >
                {isSendingReset ? "Sending..." : "Send Reset Link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}