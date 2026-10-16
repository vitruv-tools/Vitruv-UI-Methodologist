import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { AuthErrorBanner, AuthLayout } from '../components/auth/AuthLayout';

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

  const showTooManyAttemptsError = () => {
    setError(
      `Too many failed attempts (${MAX_ATTEMPTS}/${MAX_ATTEMPTS}).\n\n` +
      'Please click "Resend Verification Code" to get a new code.'
    );
    setCanResend(true);
  };

  const handleIncorrectOtpAttempt = () => {
    const newFailedAttempts = failedAttempts + 1;
    setFailedAttempts(newFailedAttempts);

    if (newFailedAttempts >= MAX_ATTEMPTS) {
      showTooManyAttemptsError();
      return;
    }

    const remainingAttempts = MAX_ATTEMPTS - newFailedAttempts;
    setError(
      `❌ Verification code is not valid\n\n` +
      `Attempts: ${newFailedAttempts}/${MAX_ATTEMPTS} used\n` +
      `${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining\n\n` +
      `Please check your email and try again.`
    );
  };

  const handleVerifyOtpError = (errorMessage: string) => {
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
    const normalizedError = errorMessage.toLowerCase();
    const shouldCountAsOtpFailure =
      isIncorrectCodeError(errorMessage) ||
      normalizedError.includes('authentication session expired') ||
      normalizedError.includes('session expired');

    if (shouldCountAsOtpFailure) {
      handleIncorrectOtpAttempt();
      return;
    }

    setError(errorMessage);
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
      showTooManyAttemptsError();
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

      handleVerifyOtpError(errorMessage);
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

  const verifyDisabled = isVerifying || !otpCode || failedAttempts >= MAX_ATTEMPTS;
  const attemptsLeft = MAX_ATTEMPTS - failedAttempts;

  return (
    <AuthLayout>
      <div className="mock-auth-header">
        <h1>Email Verification</h1>
        <p>Enter the latest verification code sent to your email</p>
      </div>

      <form onSubmit={handleVerifyOtp} className="mock-auth-form">
        <AuthErrorBanner message={error} />

        {error?.includes('session expired') && (
          <button
            type="button"
            className="mock-action-button"
            onClick={() => navigate('/login')}
            style={{ marginBottom: 16 }}
          >
            Go to Sign In
          </button>
        )}

        {success && <div className="otp-status otp-status-success">{success}</div>}

        {/* Attempts warning after the first failure, unless an error already says so */}
        {failedAttempts > 0 && failedAttempts < MAX_ATTEMPTS && !error && (
          <div className="otp-status otp-status-warning">
            <strong>Verification attempts:</strong> {failedAttempts}/{MAX_ATTEMPTS} used —{' '}
            {attemptsLeft} {attemptsLeft === 1 ? 'attempt' : 'attempts'} remaining.
          </div>
        )}

        <div className="mock-form-group">
          <label htmlFor="otpCode">Verification Code</label>
          <input
            className="otp-code-input"
            type="text"
            id="otpCode"
            name="otpCode"
            value={otpCode}
            onChange={(e) => {
              setOtpCode(e.target.value);
              setError(null);
            }}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            disabled={isVerifying}
            required
          />
        </div>

        <div className="otp-timer">
          <span>Code expires in</span>
          <span className={`otp-timer-value${timeLeft <= 60 ? ' is-expiring' : ''}`}>
            {formatTime(timeLeft)}
          </span>
        </div>

        <button type="submit" className="mock-action-button" disabled={verifyDisabled}>
          {isVerifying ? 'Verifying...' : 'Verify Email'}
        </button>

        {canResend && (
          <div className="otp-resend">
            Didn&apos;t receive the code?{' '}
            <button
              type="button"
              className="otp-resend-button"
              onClick={handleResendOtp}
              disabled={isResending}
            >
              {isResending ? 'Sending...' : 'Resend code'}
            </button>
          </div>
        )}
      </form>

      <div className="mock-auth-footer">
        <p className="otp-help">
          Check your inbox and spam folder. The code is valid for 5 minutes, and sending a
          new one invalidates any previous code.
        </p>
        <button type="button" className="mock-signup-link" onClick={() => navigate('/login')}>
          Back to Sign In
        </button>
      </div>
    </AuthLayout>
  );
}
