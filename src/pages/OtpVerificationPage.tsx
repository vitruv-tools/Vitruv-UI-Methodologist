import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { AuthService } from '../services/auth';
import '../components/auth/Auth.css';

const OTP_DURATION = 5 * 60; // 5 minutes in seconds

export function OtpVerificationPage() {
  const navigate = useNavigate();
  const [otpCode, setOtpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(OTP_DURATION);
  const [canResend, setCanResend] = useState(false);
  const [hasToken, setHasToken] = useState(true);

  // Check if user has authentication token
  useEffect(() => {
    const token = AuthService.getAccessToken();
    if (!token) {
      setHasToken(false);
      setError('Authentication session expired. Please sign in again.');
    }
  }, []);

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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!hasToken) {
      setError('Authentication session expired. Please sign in again.');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    if (!otpCode || otpCode.length < 4) {
      setError('Please enter a valid OTP code');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await apiService.verifyOtp(otpCode);
      setSuccess(response.message || 'Email verified successfully!');
      
      // Redirect to home page after successful verification
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err: any) {
      const errorMessage = err.message || 'Invalid OTP code. Please try again.';
      
      // Check if it's an authentication error
      if (errorMessage.includes('authentication') || errorMessage.includes('token')) {
        setError('Your session has expired. Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    setSuccess(null);

    if (!hasToken) {
      setError('Authentication session expired. Please sign in again.');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    setIsResending(true);

    try {
      const response = await apiService.resendOtp();
      setSuccess(response.message || 'A new OTP code has been sent to your email');
      setTimeLeft(OTP_DURATION);
      setCanResend(false);
      setOtpCode('');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to resend OTP code';
      
      // Check if it's an authentication error
      if (errorMessage.includes('authentication') || errorMessage.includes('token')) {
        setError('Your session has expired. Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsResending(false);
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
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-header">
          <h1>Email Verification</h1>
          <p>Please enter the verification code sent to your email</p>
        </div>

        <form onSubmit={handleVerifyOtp} className="auth-form">
          {!hasToken && (
            <div style={{
              padding: '14px 16px',
              background: '#fff3cd',
              border: '2px solid #ffc107',
              borderRadius: 8,
              color: '#856404',
              fontSize: 14,
              marginBottom: 20,
              fontWeight: 500,
              lineHeight: 1.5,
            }}>
              Your authentication session has expired. Please{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#049484',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontWeight: 600,
                  padding: 0,
                }}
              >
                sign in again
              </button>
              {' '}to continue.
            </div>
          )}

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
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
            disabled={isVerifying || !otpCode}
            style={{
              background: (isVerifying || !otpCode) ? '#95a5a6' : 'linear-gradient(135deg, #049484 0%, #037368 100%)',
              opacity: (isVerifying || !otpCode) ? 0.6 : 1,
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
        </div>
      </div>
    </div>
  );
}
