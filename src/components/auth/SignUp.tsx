import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { SignUpCredentials } from '../../services/auth';
import './Auth.css';

interface SignUpProps {
  onSignUpSuccess: (user: any) => void;
  onSwitchToSignIn: () => void;
}

// Password strength helper
const calculatePasswordStrength = (password: string): number => {
  let score = 0;

  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[@$!%?&]/.test(password)) score++;

  return score; // 0–5
};

const passwordStrengthLabel = (score: number): string => {
  switch (score) {
    case 0:
    case 1:
      return "Very Weak";
    case 2:
      return "Weak";
    case 3:
      return "Medium";
    case 4:
      return "Strong";
    case 5:
      return "Very Strong";
    default:
      return "";
  }
};

const getPasswordBarColor = (score: number): string => {
  switch (score) {
    case 0:
    case 1:
      return "#dc2626"; // red
    case 2:
      return "#f59e0b"; // orange
    case 3:
      return "#eab308"; // yellow
    case 4:
      return "#10b981"; // green
    case 5:
      return "#16a34a"; // dark green
    default:
      return "#dc2626";
  }
};

interface PasswordRequirementsProps {
  isPasswordValid: boolean;
  hasOnlyAllowedChars: boolean;
  hasMinLength: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({
  isPasswordValid,
  hasOnlyAllowedChars,
  hasMinLength,
  hasLowercase,
  hasUppercase,
  hasNumber,
  hasSymbol,
}) => {
  if (isPasswordValid) {
    return null;
  }

  return (
    <div className="password-requirements">
      <div className="password-requirements-title">
        Password must:
      </div>
      <ul className="password-requirements-list">
        <li
          className={`password-requirement ${
            hasOnlyAllowedChars ? "ok" : "fail"
          }`}
        >
          <span className="password-requirement-icon">
            {hasOnlyAllowedChars ? "✔" : "✖"}
          </span>
          <span>
            Use only letters, numbers, and these symbols: @ $ ! % ? &
          </span>
        </li>
        <li
          className={`password-requirement ${
            hasMinLength ? "ok" : "fail"
          }`}
        >
          <span className="password-requirement-icon">
            {hasMinLength ? "✔" : "✖"}
          </span>
          <span>Be at least 8 characters</span>
        </li>
        <li
          className={`password-requirement ${
            hasLowercase ? "ok" : "fail"
          }`}
        >
          <span className="password-requirement-icon">
            {hasLowercase ? "✔" : "✖"}
          </span>
          <span>Have at least one lower case character</span>
        </li>
        <li
          className={`password-requirement ${
            hasUppercase ? "ok" : "fail"
          }`}
        >
          <span className="password-requirement-icon">
            {hasUppercase ? "✔" : "✖"}
          </span>
          <span>Have at least one capital letter</span>
        </li>
        <li
          className={`password-requirement ${
            hasNumber ? "ok" : "fail"
          }`}
        >
          <span className="password-requirement-icon">
            {hasNumber ? "✔" : "✖"}
          </span>
          <span>Have at least one number</span>
        </li>
        <li
          className={`password-requirement ${
            hasSymbol ? "ok" : "fail"
          }`}
        >
          <span className="password-requirement-icon">
            {hasSymbol ? "✔" : "✖"}
          </span>
          <span>Have at least one symbol (@ $ ! % ? &)</span>
        </li>
      </ul>
    </div>
  );
};

export function SignUp({ onSignUpSuccess, onSwitchToSignIn }: Readonly<SignUpProps>) {
  const { signUp } = useAuth();
  const [formData, setFormData] = useState<SignUpCredentials>({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    roleType: 'user',
  });

  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordScore = calculatePasswordStrength(formData.password);
  const passwordBarColor = getPasswordBarColor(passwordScore);

  // Live password requirement checks for helper UI
  const hasMinLength = formData.password.length >= 8;
  const hasUppercase = /[A-Z]/.test(formData.password);
  const hasLowercase = /[a-z]/.test(formData.password);
  const hasNumber = /\d/.test(formData.password);
  const hasSymbol = /[@$!%?&]/.test(formData.password);
  const hasOnlyAllowedChars =
    formData.password === '' || /^[A-Za-z0-9@$!%?&]+$/.test(formData.password);

  const isPasswordValid =
    hasMinLength &&
    hasUppercase &&
    hasLowercase &&
    hasNumber &&
    hasSymbol &&
    hasOnlyAllowedChars;
  const isConfirmValid =
    !!confirmPassword && confirmPassword === formData.password;

  // Button enabled once all mandatory fields are filled;
  // validity is still checked on submit with clear error messages.
  const isFormFilled =
    !!formData.username &&
    !!formData.email &&
    !!formData.password &&
    !!confirmPassword;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError(null);
  };

  const validateForm = (): boolean => {
    const { username, email } = formData;

    if (!username || username.trim().length < 4) {
      setError("Username is too short");
      return false;
    }

    if (!email.includes('@')) {
      setError("Email is invalid");
      return false;
    }

    // Password + confirm are enforced by live checklist and disabled button,
    // but we still show a clear message when user tries to submit.
    if (!isPasswordValid) {
      setError("Password does not meet all requirements");
      return false;
    }

    if (!isConfirmValid) {
      setError("Confirm password is empty or doesn't match");
      return false;
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
      onSignUpSuccess(formData);
    } catch (err: any) {
      setError(err.message || "Sign up failed. Please try again.");
    } finally {
      setIsLoading(false);
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
            <h1>Create Account</h1>
            <p>Join Vitruv and start modeling</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && (
                <div className="error-message">
                  <span className="error-icon">⚠️</span>
                  {error.split("\n").map((line) => (
                      <div key={line}>{line}</div>
                  ))}
                </div>
            )}

            <input type="hidden" name="roleType" value={formData.roleType} />

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="First name"
                    disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Last name"
                    disabled={isLoading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="username">Username *</label>
              <input
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Choose a username"
                  disabled={isLoading}
                  required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  disabled={isLoading}
                  required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Create a strong password"
                  disabled={isLoading}
                  required
              />

              {/* PASSWORD STRENGTH METER + REQUIREMENTS */}
              {formData.password && (
                  <div style={{ marginTop: 6 }}>
                    <div
                        style={{
                          height: 6,
                          width: "100%",
                          background: "#e5e7eb",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                    >
                      <div
                          style={{
                            height: "100%",
                            width: `${(passwordScore / 5) * 100}%`,
                            background: passwordBarColor,
                            transition: "0.3s",
                          }}
                      />
                    </div>

                    <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          color: passwordBarColor,
                        }}
                    >
                      {passwordStrengthLabel(passwordScore)}
                    </div>

                    <PasswordRequirements
                      isPasswordValid={isPasswordValid}
                      hasOnlyAllowedChars={hasOnlyAllowedChars}
                      hasMinLength={hasMinLength}
                      hasLowercase={hasLowercase}
                      hasUppercase={hasUppercase}
                      hasNumber={hasNumber}
                      hasSymbol={hasSymbol}
                    />
                  </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Confirm your password"
                  disabled={isLoading}
                  required
              />
            </div>

            <button
                type="submit"
                className="auth-button primary"
                disabled={isLoading || !isFormFilled}
            >
              {isLoading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Already have an account?{" "}
              <button className="link-button" onClick={onSwitchToSignIn} disabled={isLoading}>
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
  );
}