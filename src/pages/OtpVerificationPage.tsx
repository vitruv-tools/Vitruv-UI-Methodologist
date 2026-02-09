import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import '../components/auth/Auth.css';

const OTP_DURATION = 5 * 60; // 5 minutes in seconds

export function OtpVerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshCurrentUser } = useAuth();
  const hasAutoResentRef = useRef(false);
  const [otpCode, setOtpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(OTP_DURATION);
  const [canResend, setCanResend] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const MAX_ATTEMPTS = 2;

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isIncorrectCodeError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('invalid otp') ||
      normalized.includes('incorrect verification code') ||
      normalized.includes('invalid verification code') ||
      normalized.includes('invalid code') ||
      normalized.includes('incorrect code');
  };

  const isAuthError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('no valid authentication token') ||
      normalized.includes('token expired') ||
      normalized.includes('invalid token') ||
      normalized.includes('not authenticated');
  };

  const isCodeExpiredError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('code is expired') ||
      normalized.includes('validation code is expired') ||
      normalized.includes('verification code is expired') ||
      normalized.includes('otp expired') ||
      normalized.includes('code expired');
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!otpCode || otpCode.length < 4) {
      setError('Please enter a valid OTP code');
      return;
    }

    if (failedAttempts >= MAX_ATTEMPTS) {
      setError(
        `Too many failed attempts (${MAX_ATTEMPTS}/${MAX_ATTEMPTS}).\n\n` +
        'Please click "Resend Verification Code" to get a new code.'
      );
      setCanResend(true);
      return;
    }

    setIsVerifying(true);
    try {
      const response = await apiService.verifyOtp(otpCode);
      setSuccess(response.message || 'Email verified successfully!');
      
      // Refresh user context so route guards immediately see verified state
      try {
        await refreshCurrentUser();
      } catch (userInfoError) {
        console.error('Failed to refresh updated user info:', userInfoError);
      }
      
      // Redirect to workspace after successful verification
      setTimeout(() => {
        navigate('/mml');
      }, 1500);
    } catch (err: any) {
      const errorMessage = err.message || 'Invalid OTP code. Please try again.';
      
      console.log('OTP Verification Error:', errorMessage); // Debug log

      if (isCodeExpiredError(errorMessage)) {
        setError('Verification code is expired. Please resend and use the new code.');
        setCanResend(true);
        setTimeLeft(0);
        return;
      }

      if (isAuthError(errorMessage)) {
        setError('Authentication session expired. Please sign in again.');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      // Treat session-expired text from OTP verify endpoint as an incorrect attempt,
      // because some backends use that wording for invalid OTP responses.
      const shouldCountAsOtpFailure =
        isIncorrectCodeError(errorMessage) ||
        errorMessage.toLowerCase().includes('authentication session expired') ||
        errorMessage.toLowerCase().includes('session expired');

      if (shouldCountAsOtpFailure) {
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);

        if (newFailedAttempts >= MAX_ATTEMPTS) {
          setError(
            `Too many failed attempts (${MAX_ATTEMPTS}/${MAX_ATTEMPTS}).\n\n` +
            'Please click "Resend Verification Code" to get a new code.'
          );
          setCanResend(true);
          return;
        }

        const remainingAttempts = MAX_ATTEMPTS - newFailedAttempts;
        setError(
          `❌ Verification code is not valid\n\n` +
          `Attempts: ${newFailedAttempts}/${MAX_ATTEMPTS} used\n` +
          `${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining\n\n` +
          `Please check your email and try again.`
        );
        return;
      }

      setError(errorMessage);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    setSuccess(null);

    setIsResending(true);

    try {
      await apiService.resendOtp();
      setSuccess('A new verification code has been sent to your email. Previous code is no longer valid.');
      setTimeLeft(OTP_DURATION);
      setCanResend(false);
      setOtpCode('');
      setFailedAttempts(0); // Reset failed attempts with new code
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to resend OTP code';
      
      // Check if it's an authentication error
      if (isAuthError(errorMessage)) {
        setError('Your session has expired. Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    const shouldAutoResend = Boolean((location.state as { autoResend?: boolean } | null)?.autoResend);
    if (!shouldAutoResend || hasAutoResentRef.current) {
      return;
    }

    hasAutoResentRef.current = true;
    void handleResendOtp();

    // Clear navigation state so refresh/back won't trigger auto resend again.
    navigate('/verify-otp', { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, navigate]);

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
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-header">
          <h1>Email Verification</h1>
          <p>Please enter the latest verification code sent to your email</p>
          <p style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
            If a new code is sent, all previous codes become invalid.
          </p>
        </div>

        <form onSubmit={handleVerifyOtp} className="auth-form">
          {error && (
            <div className="error-message" style={{ display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span className="error-icon">⚠️</span>
                <div style={{ flex: 1 }}>
                  {error}
                  {error.includes('session expired') && (
                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={() => navigate('/login')}
                        style={{
                          padding: '8px 16px',
                          background: '#049484',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        Go to Sign In
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {success && (
            <div style={{
              padding: '14px 16px',
              background: '#d5f4e6',
              border: '2px solid #a9dfbf',
              borderRadius: 8,
              color: '#166534',
              fontSize: 14,
              marginBottom: 20,
              fontWeight: 500,
              lineHeight: 1.5,
            }}>
              {success}
            </div>
          )}

          {/* Show attempts warning after first failure */}
          {failedAttempts > 0 && failedAttempts < MAX_ATTEMPTS && !error && (
            <div style={{
              padding: '12px 14px',
              background: '#fff3cd',
              border: '2px solid #ffc107',
              borderRadius: 8,
              color: '#856404',
              fontSize: 13,
              marginBottom: 16,
              fontWeight: 500,
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <div>
                <strong>Verification attempts:</strong> {failedAttempts}/{MAX_ATTEMPTS} used
                <br />
                <span style={{ fontSize: 12 }}>
                  {MAX_ATTEMPTS - failedAttempts} attempts remaining before requiring sign-in
                </span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="otpCode">Verification Code</label>
            <input
              type="text"
              id="otpCode"
              name="otpCode"
              value={otpCode}
              onChange={(e) => {
                setOtpCode(e.target.value);
                setError(null);
              }}
              placeholder="Enter OTP code"
              disabled={isVerifying}
              required
              style={{
                fontSize: 18,
                letterSpacing: '0.5em',
                textAlign: 'center',
                fontWeight: 600,
              }}
            />
          </div>

          {/* Timer Display */}
          <div style={{
            textAlign: 'center',
            marginBottom: 20,
            padding: '12px',
            background: timeLeft <= 60 ? '#fef2f2' : '#f0f7ff',
            border: `2px solid ${timeLeft <= 60 ? '#fecaca' : '#bfdbfe'}`,
            borderRadius: 8,
          }}>
            <div style={{
              fontSize: 13,
              color: '#6b7280',
              marginBottom: 4,
              fontWeight: 500,
            }}>
              Time Remaining
            </div>
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              color: timeLeft <= 60 ? '#dc2626' : '#049484',
              fontFamily: 'monospace',
            }}>
              {formatTime(timeLeft)}
            </div>
          </div>

          <button
            type="submit"
            className="auth-button primary"
            disabled={isVerifying || !otpCode || failedAttempts >= MAX_ATTEMPTS}
            style={{
              background: (isVerifying || !otpCode || failedAttempts >= MAX_ATTEMPTS) ? '#95a5a6' : 'linear-gradient(135deg, #049484 0%, #037368 100%)',
              opacity: (isVerifying || !otpCode || failedAttempts >= MAX_ATTEMPTS) ? 0.6 : 1,
            }}
          >
            {isVerifying ? (
              <span className="loading-spinner">
                <div className="spinner"></div>
                Verifying...
              </span>
            ) : (
              'Verify Email'
            )}
          </button>

          {/* Resend OTP Link */}
          {canResend && (
            <div style={{
              textAlign: 'center',
              marginTop: 20,
              padding: '12px',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
            }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 13, color: '#6b7280' }}>
                Didn't receive the code?
              </p>
              <button
                type="button"
                className="link-button"
                onClick={handleResendOtp}
                disabled={isResending}
                style={{
                  fontSize: 14,
                  color: '#049484',
                  fontWeight: 600,
                  cursor: isResending ? 'not-allowed' : 'pointer',
                  opacity: isResending ? 0.6 : 1,
                }}
              >
                {isResending ? 'Sending...' : 'Resend Verification Code'}
              </button>
            </div>
          )}
        </form>

        <div className="auth-footer">
          <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
            Please check your inbox and spam folder for the verification code. 
            The code is valid for 5 minutes.
          </p>
          <button
            type="button"
            className="link-button"
            onClick={() => navigate('/login')}
            style={{ marginTop: 12 }}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
