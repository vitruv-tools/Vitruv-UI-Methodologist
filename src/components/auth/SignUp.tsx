import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { SignUpCredentials } from '../../services/auth';
import { AuthLayout, AuthErrorBanner } from './AuthLayout';
import { PasswordInput } from './PasswordInput';

interface SignUpProps {
  onSignUpSuccess: (user: any) => void;
  onSwitchToSignIn: () => void;
}

// ── Password-strength helpers ─────────────────────────────────────────────────

const calculatePasswordStrength = (password: string): number => {
  let score = 0;
  if (password.length >= 8 && password.length <= 256) score++;
  if (/\p{Lu}/u.test(password)) score++;
  if (/\p{Ll}/u.test(password)) score++;
  if (/\p{Nd}/u.test(password)) score++;
  if (/[^\p{L}\p{Nd}\s]/u.test(password)) score++;
  return score; // 0–5
};

const passwordStrengthLabel = (score: number): string => {
  switch (score) {
    case 0: case 1: return 'Very Weak';
    case 2: return 'Weak';
    case 3: return 'Medium';
    case 4: return 'Strong';
    case 5: return 'Very Strong';
    default: return '';
  }
};

const getPasswordBarColor = (score: number): string => {
  switch (score) {
    case 0: case 1: return '#dc2626';
    case 2: return '#f59e0b';
    case 3: return '#eab308';
    case 4: return '#1f9f92';
    case 5: return '#037368';
    default: return '#dc2626';
  }
};

// ── PasswordRequirements ──────────────────────────────────────────────────────

interface PasswordRequirementsProps {
  isPasswordValid: boolean;
  hasMinLength: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({
  isPasswordValid, hasMinLength, hasLowercase, hasUppercase, hasNumber, hasSymbol,
}) => {
  if (isPasswordValid) return null;
  const req = (met: boolean, label: string) => (
    <li className={`password-requirement ${met ? 'ok' : 'fail'}`}>
      <span className="password-requirement-icon">{met ? '✔' : '✖'}</span>
      <span>{label}</span>
    </li>
  );
  return (
    <div className="password-requirements">
      <div className="password-requirements-title">Password must:</div>
      <ul className="password-requirements-list">
        {req(hasMinLength,  'Be at least 8 characters long')}
        {req(hasLowercase,  'Have at least one lower case character')}
        {req(hasUppercase,  'Have at least one capital letter')}
        {req(hasNumber,     'Have at least one number')}
        {req(hasSymbol,     'Have at least one special character')}
      </ul>
    </div>
  );
};

// ── SignUp ────────────────────────────────────────────────────────────────────

export function SignUp({ onSignUpSuccess, onSwitchToSignIn }: Readonly<SignUpProps>) {
  const { signUp } = useAuth();
  const [formData, setFormData] = useState<SignUpCredentials>({
    username: '', email: '', password: '',
    firstName: '', lastName: '', roleType: 'user',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const passwordScore    = calculatePasswordStrength(formData.password);
  const passwordBarColor = getPasswordBarColor(passwordScore);

  const hasMinLength = formData.password.length >= 8 && formData.password.length <= 256;
  const hasUppercase = /\p{Lu}/u.test(formData.password);
  const hasLowercase = /\p{Ll}/u.test(formData.password);
  const hasNumber    = /\p{Nd}/u.test(formData.password);
  const hasSymbol    = /[^\p{L}\p{Nd}\s]/u.test(formData.password);

  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSymbol;
  const isConfirmValid  = !!confirmPassword && confirmPassword === formData.password;
  const isFormFilled    =
    !!formData.username && !!formData.email && !!formData.password &&
    !!confirmPassword   && !!formData.firstName && !!formData.lastName;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const validateForm = (): boolean => {
    const { username, email, firstName, lastName } = formData;
    if (!firstName || firstName.trim().length < 2) {
      setError('First name is required (at least 2 characters)'); return false;
    }
    if (!lastName || lastName.trim().length < 2) {
      setError('Last name is required (at least 2 characters)'); return false;
    }
    if (!username || username.trim().length < 4) {
      setError('Username is too short'); return false;
    }
    if (!email.includes('@')) {
      setError('Email is invalid'); return false;
    }
    if (!isPasswordValid) {
      setError('The password needs to be at least 8 characters long.'); return false;
    }
    if (!isConfirmValid) {
      setError("Confirm password is empty or doesn't match"); return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    setError(null);
    try {
      await signUp(formData);
      setIsSuccess(true);
      setTimeout(() => onSignUpSuccess(formData), 2000);
    } catch (err: any) {
      const msg: string = err.message || 'Sign up failed. Please try again.';
      const isConflict =
        msg.toLowerCase().includes('already exists') ||
        msg.toLowerCase().includes('already registered');
      setError(isConflict
        ? `${msg}\n\n💡 What to do:\n• Click "Sign In" below if you already have an account\n• Use a different email address if you want to create a new account`
        : msg,
      );
      setIsLoading(false);
    }
  };

  let submitLabel: React.ReactNode = 'Create Account';
  if (isSuccess) {
    submitLabel = <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><span>Redirecting...</span></span>;
  } else if (isLoading) {
    submitLabel = 'Creating Account...';
  }

  return (
    <AuthLayout>
      <div className="mock-auth-header">
        <h1>Create Account</h1>
        <p>Join Vitruv and start modeling</p>
      </div>

      <form onSubmit={handleSubmit} className="mock-auth-form">
        <AuthErrorBanner message={error} />

        {isSuccess && (
          <div style={{ padding: '16px', background: 'linear-gradient(135deg, #d5f4e6 0%, #c8f0df 100%)', border: '2px solid #10b981', borderRadius: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>✅</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#065f46', marginBottom: 2 }}>Account Created Successfully!</div>
                <div style={{ fontSize: 13, color: '#047857', lineHeight: 1.4 }}>
                  A verification code has been sent to <strong>{formData.email}</strong>.<br />
                  Redirecting you to email verification...
                </div>
              </div>
            </div>
          </div>
        )}

        <input type="hidden" name="roleType" value={formData.roleType} />

        {/* First & Last Name */}
        <div className="form-row">
          <div className="mock-form-group">
            <label htmlFor="firstName">First Name *</label>
            <input id="firstName" name="firstName" value={formData.firstName}
              onChange={handleInputChange} placeholder="First name"
              disabled={isLoading || isSuccess} required />
          </div>
          <div className="mock-form-group">
            <label htmlFor="lastName">Last Name *</label>
            <input id="lastName" name="lastName" value={formData.lastName}
              onChange={handleInputChange} placeholder="Last name"
              disabled={isLoading || isSuccess} required />
          </div>
        </div>

        {/* Username */}
        <div className="mock-form-group">
          <label htmlFor="username">Username *</label>
          <input id="username" name="username" value={formData.username}
            onChange={handleInputChange} placeholder="Choose a username"
            disabled={isLoading || isSuccess} required />
        </div>

        {/* Email */}
        <div className="mock-form-group">
          <label htmlFor="email">Email *</label>
          <input id="email" name="email" type="email" value={formData.email}
            onChange={handleInputChange} placeholder="Enter your email"
            disabled={isLoading || isSuccess} required />
        </div>

        {/* Password */}
        <div className="mock-form-group">
          <label htmlFor="password">Password *</label>
          <PasswordInput
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="Create a strong password"
            disabled={isLoading || isSuccess}
            required
          />

          {formData.password && (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 6, width: '100%', background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(passwordScore / 5) * 100}%`, background: passwordBarColor, transition: '0.3s' }} />
              </div>
              <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: passwordBarColor }}>
                {passwordStrengthLabel(passwordScore)}
              </div>
              <PasswordRequirements
                isPasswordValid={isPasswordValid}
                hasMinLength={hasMinLength} hasLowercase={hasLowercase}
                hasUppercase={hasUppercase} hasNumber={hasNumber} hasSymbol={hasSymbol}
              />
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="mock-form-group">
          <label htmlFor="confirmPassword">Confirm Password *</label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(null); }}
            placeholder="Confirm your password"
            disabled={isLoading || isSuccess}
            required
          />
        </div>

        <button type="submit" className="mock-submit-button"
          disabled={isLoading || !isFormFilled || isSuccess}>
          {submitLabel}
        </button>
      </form>

      {/* Switch to Sign In */}
      <div className="mock-auth-footer">
        <p>
          Already have an account?{' '}
          <button type="button" className="mock-signup-link" onClick={onSwitchToSignIn} disabled={isLoading || isSuccess}>
            Sign In
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
