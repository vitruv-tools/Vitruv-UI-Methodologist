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
  if (/[@$!%*?&]/.test(password)) score++;

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

export function SignUp({ onSignUpSuccess, onSwitchToSignIn }: SignUpProps) {
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

  const passwordBarColor =
      passwordScore <= 1
          ? "#dc2626"
          : passwordScore === 2
              ? "#f59e0b"
              : passwordScore === 3
                  ? "#eab308"
                  : passwordScore === 4
                      ? "#10b981"
                      : "#16a34a";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError(null);
  };

  const validateForm = (): boolean => {
    const { username, email, password } = formData;

    if (!username || username.trim().length < 4) {
      setError("Username must be at least 4 characters long");
      return false;
    }

    if (!email.includes('@')) {
      setError("Please enter a valid email address");
      return false;
    }

    const requirements = [];

    if (password.length < 8) requirements.push("• At least 8 characters");
    if (!/[A-Z]/.test(password)) requirements.push("• One uppercase letter (A–Z)");
    if (!/[a-z]/.test(password)) requirements.push("• One lowercase letter (a–z)");
    if (!/\d/.test(password)) requirements.push("• One number (0–9)");
    if (!/[@$!%*?&]/.test(password)) requirements.push("• One symbol (@ $ ! % * ? &)");

    if (requirements.length > 0) {
      setError("Password is not strong enough:\n" + requirements.join("\n"));
      return false;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
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
                  {error.split("\n").map((line, idx) => (
                      <div key={idx}>{line}</div>
                  ))}
                </div>
            )}

            <input type="hidden" name="roleType" value={formData.roleType} />

            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="First name"
                    disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label>Last Name</label>
                <input
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Last name"
                    disabled={isLoading}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Username *</label>
              <input
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Choose a username"
                  disabled={isLoading}
                  required
              />
            </div>

            <div className="form-group">
              <label>Email *</label>
              <input
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
              <label>Password *</label>
              <input
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Create a strong password"
                  disabled={isLoading}
                  required
              />

              {/* PASSWORD STRENGTH METER */}
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
                  </div>
              )}
            </div>

            <div className="form-group">
              <label>Confirm Password *</label>
              <input
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  disabled={isLoading}
                  required
              />
            </div>

            <button
                type="submit"
                className="auth-button primary"
                disabled={isLoading}
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