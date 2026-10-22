import React from 'react';
import { ThemeToggle } from '../ui/ThemeToggle';

// ── Shared styles ─────────────────────────────────────────────────────────────
// All auth-page CSS lives here once so SignIn and SignUp stay DRY.
const AUTH_STYLES = `
  .unified-auth-container {
    position: relative;
    display: flex;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    min-height: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    background-color: #f7f9fa;
  }

  .auth-bg-video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 1;
    pointer-events: none;
    filter: blur(2px);
    transform: scale(1.05);
    transform-origin: bottom center;
  }

  .auth-left-image-area {
    position: relative;
    z-index: 2;
    flex: 0 0 50%;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 40px 0;
    box-sizing: border-box;
    overflow: visible;
  }

  .auth-floating-img {
    width: 100%;
    height: 100%;
    max-height: 90vh;
    object-fit: contain;
    object-position: left center;
    transform: scale(2.0);
    transform-origin: left center;
  }

  .auth-right-form-area {
    position: relative;
    z-index: 2;
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 32px 40px;
    box-sizing: border-box;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  @media (max-width: 950px) {
    .auth-left-image-area { display: none; }
    .auth-right-form-area { flex: 0 0 100%; }
  }

  .mock-auth-card {
    position: relative;
    background: #ffffff;
    width: 100%;
    max-width: 460px;
    border-radius: 16px;
    padding: 35px 35px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.06);
    text-align: center;
    box-sizing: border-box;
    transform: translate(-100px, 0px);
    margin: auto 0;
    flex-shrink: 0;
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

  /* Grid for First Name & Last Name (SignUp) */
  .form-row {
    display: flex;
    gap: 16px;
  }

  .form-row .mock-form-group {
    flex: 1;
  }

  .mock-form-group { margin-bottom: 16px; }

  .mock-form-group label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 6px;
  }

  .mock-form-group input {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 14px;
    color: #1e293b;
    background-color: #ffffff;
    box-sizing: border-box;
    transition: border-color 0.2s;
  }

  .mock-form-group input:focus {
    outline: none;
    border-color: #1f9f92;
  }

  .mock-form-group input:disabled {
    background-color: #f8fafc;
    color: #94a3b8;
  }

  .mock-password-field {
    position: relative;
  }

  .mock-password-field input {
    padding-right: 44px;
  }

  .mock-password-toggle {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: color 0.15s, background-color 0.15s;
  }

  .mock-password-toggle:hover:not(:disabled) {
    color: #1f9f92;
    background: #f0fdfa;
  }

  .mock-password-toggle:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  /* Keep-signed-in / forgot-password row (SignIn) */
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
    color: #1e293b;
    font-weight: 600;
    cursor: pointer;
    font-size: 14px;
    padding: 0;
  }

  .mock-forgot-link:hover { color: #1f9f92; }

  .mock-action-button {
    width: 100%;
    min-height: 48px;
    padding: 12px 16px;
    border: none;
    border-radius: 4px;
    background: #00876c;
    color: #ffffff;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: background-color 0.2s, opacity 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 8px;
  }

  .mock-action-button:hover:not(:disabled) {
    background: #00755d;
  }

  .mock-action-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  /* Legacy alias used by SignUp */
  .mock-submit-button {
    width: 100%;
    min-height: 48px;
    padding: 12px 16px;
    border: none;
    border-radius: 4px;
    background: #00876c;
    color: #ffffff;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: background-color 0.2s, opacity 0.2s;
    margin-top: 8px;
  }

  .mock-submit-button:hover:not(:disabled) { background: #00755d; }

  .mock-submit-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .mock-auth-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 18px 0 14px;
    color: #94a3b8;
    font-size: 13px;
    font-weight: 600;
    text-transform: lowercase;
  }

  .mock-auth-divider::before,
  .mock-auth-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e2e8f0;
  }

  .mock-fast-login-button {
    display: flex;
    align-items: center;
    padding: 13px 16px;
    position: relative;
  }

  .mock-fast-login-icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: block;
    object-fit: contain;
  }

  .mock-fast-login-label {
    flex: 1;
    text-align: center;
    padding-right: 24px;
    line-height: 1.2;
    letter-spacing: 0.01em;
  }

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

  /* Forgot-password modal (SignIn) */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
    box-sizing: border-box;
  }
  .modal-dialog {
    background: white;
    border: none;
    border-radius: 14px;
    padding: 28px 32px 24px;
    max-width: 400px;
    width: 100%;
    box-shadow: 0 20px 40px rgba(15, 23, 42, 0.14);
    font-family: inherit;
    margin: 0;
    text-align: center;
  }
  .modal-header { margin-bottom: 4px; }
  .modal-header h2 {
    margin: 0 0 10px 0;
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
  }
  .modal-header p {
    margin: 0 0 20px 0;
    color: #64748b;
    font-size: 14px;
    line-height: 1.55;
    max-width: 20rem;
    margin-left: auto;
    margin-right: auto;
  }
  .modal-message {
    padding: 10px 12px;
    border-radius: 8px;
    margin-bottom: 12px;
    font-size: 13px;
    line-height: 1.45;
    text-align: center;
  }
  .modal-message-error { background: #fef2f2; color: #991b1b; }
  .modal-message-success { background: #ecfdf5; color: #065f46; }
  .modal-input {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    box-sizing: border-box;
    font-size: 14px;
    text-align: left;
  }
  .modal-input:focus { outline: none; border-color: #1f9f92; }
  .modal-actions {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 22px;
  }
  .btn-secondary {
    background: #f1f5f9; border: none; padding: 10px 18px;
    border-radius: 8px; cursor: pointer; font-weight: 600;
  }
  .btn-primary-gradient {
    background: linear-gradient(90deg, #1f9f92 0%, #037368 100%);
    color: white; border: none; padding: 10px 18px;
    border-radius: 8px; cursor: pointer; font-weight: 600;
  }

  /* Password requirements (SignUp) */
  .password-requirements {
    margin-top: 12px;
    background-color: #f8fafc;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }
  .password-requirements-title {
    font-size: 12px;
    font-weight: 700;
    color: #475569;
    margin-bottom: 6px;
  }
  .password-requirements-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .password-requirement {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    margin-bottom: 4px;
  }
  .password-requirement.ok   { color: #1f9f92; }
  .password-requirement.fail { color: #94a3b8; }
  .password-requirement-icon { font-size: 10px; }

  /* OTP verification */
  /* Scoped under .mock-form-group so it outranks the shared input rule above,
     which would otherwise keep the code at the standard 14px field size. */
  .mock-form-group input.otp-code-input {
    text-align: center;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.4em;
    /* Offsets the trailing letter-spacing so the digits sit optically centred. */
    text-indent: 0.4em;
    font-variant-numeric: tabular-nums;
  }

  .otp-status {
    padding: 10px 12px;
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 13px;
    line-height: 1.45;
    white-space: pre-line;
  }
  .otp-status-success { background: #ecfdf5; color: #065f46; }
  .otp-status-warning { background: #fffbeb; color: #92400e; }

  .otp-timer {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 8px;
    margin: 2px 0 18px;
    font-size: 13px;
    color: #64748b;
  }
  .otp-timer-value {
    font-size: 18px;
    font-weight: 700;
    color: #1f9f92;
    font-variant-numeric: tabular-nums;
  }
  .otp-timer-value.is-expiring { color: #dc2626; }

  .otp-resend {
    margin-top: 18px;
    text-align: center;
    font-size: 14px;
    color: #475569;
  }
  .otp-resend-button {
    background: none;
    border: none;
    color: #00876c;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    padding: 0;
  }
  .otp-resend-button:hover:not(:disabled) { color: #00755d; text-decoration: underline; }
  .otp-resend-button:disabled { color: #94a3b8; cursor: not-allowed; }

  .otp-help {
    margin: 0 0 10px 0;
    font-size: 12px;
    color: #64748b;
    line-height: 1.55;
  }

  .auth-theme-toggle {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 2;
    background: var(--v-surface-muted);
    border: 1px solid var(--v-border);
    border-radius: 10px;
    padding: 2px;
  }

  [data-theme="dark"] .mock-auth-card {
    background: rgba(15, 23, 42, 0.88);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
    color: #f1f5f9;
  }
  [data-theme="dark"] .mock-auth-header h1 { color: #f8fafc; }
  [data-theme="dark"] .mock-auth-header p,
  [data-theme="dark"] .mock-auth-footer,
  [data-theme="dark"] .otp-help,
  [data-theme="dark"] .otp-timer { color: #94a3b8; }
  [data-theme="dark"] .mock-form-group label { color: #e2e8f0; }
  [data-theme="dark"] .mock-form-group input {
    background-color: #0f172a;
    border-color: #334155;
    color: #f1f5f9;
  }
  [data-theme="dark"] .mock-form-group input:disabled {
    background-color: #162032;
    color: #64748b;
  }
  [data-theme="dark"] .mock-checkbox-container { color: #cbd5e1; }
  [data-theme="dark"] .mock-forgot-link,
  [data-theme="dark"] .mock-signup-link { color: #e2e8f0; }
  [data-theme="dark"] .mock-auth-divider::before,
  [data-theme="dark"] .mock-auth-divider::after { background: #334155; }
  [data-theme="dark"] .modal-dialog {
    background: #1e293b;
    color: #f1f5f9;
  }
  [data-theme="dark"] .modal-header h2 { color: #f8fafc; }
  [data-theme="dark"] .modal-header p { color: #94a3b8; }
  [data-theme="dark"] .modal-input {
    background: #0f172a;
    border-color: #334155;
    color: #f1f5f9;
  }
  [data-theme="dark"] .btn-secondary {
    background: #334155;
    color: #e2e8f0;
  }
  [data-theme="dark"] .password-requirements {
    background-color: #0f172a;
    border-color: #334155;
  }
  [data-theme="dark"] .password-requirements-title { color: #cbd5e1; }
  [data-theme="dark"] .auth-theme-toggle {
    background: var(--v-chrome-hover);
    border-color: var(--v-border);
  }
`;

// ── AuthErrorBanner ────────────────────────────────────────────────────────────

interface AuthErrorBannerProps {
  message: string | null;
}

export const AuthErrorBanner: React.FC<AuthErrorBannerProps> = ({ message }) => {
  if (!message) return null;
  return (
    <div style={{
      backgroundColor: '#fef2f2', color: '#991b1b',
      padding: '12px', borderRadius: '8px', marginBottom: '16px',
      fontSize: '14px', whiteSpace: 'pre-line', lineHeight: '1.5',
    }}>
      ⚠️ {message}
    </div>
  );
};

// ── AuthLayout ─────────────────────────────────────────────────────────────────

interface AuthLayoutProps {
  /** Content rendered inside the card, after the logo. */
  children: React.ReactNode;
}

/**
 * Shared page shell for SignIn and SignUp.
 * Renders the background video, the decorative left-side image, and the white
 * card on the right. The logo is included so callers only need to provide their
 * header + form + footer.
 */
export function AuthLayout({ children }: Readonly<AuthLayoutProps>) {
  return (
    <div className="unified-auth-container">
      <style>{AUTH_STYLES}</style>

      {/* Background video */}
      <video className="auth-bg-video" autoPlay loop muted playsInline>
        <source src={`${process.env.PUBLIC_URL}/assets/signInBackground.mp4`} type="video/mp4" />
      </video>

      {/* Left decorative image */}
      <div className="auth-left-image-area">
        <img
          src={`${process.env.PUBLIC_URL}/assets/loginside.png`}
          alt="Vitruvius Graphics"
          className="auth-floating-img"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      {/* Right form card */}
      <div className="auth-right-form-area">
        <div className="mock-auth-card">
          <div className="auth-theme-toggle">
            <ThemeToggle />
          </div>

          {/* Logo */}
          <div className="mock-logo-container">
            <img
              src={`${process.env.PUBLIC_URL}/assets/vitruvius1.png`}
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

          {children}
        </div>
      </div>
    </div>
  );
}
