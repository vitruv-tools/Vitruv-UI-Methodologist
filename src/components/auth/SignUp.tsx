import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { SignUpCredentials } from '../../services/auth';

interface SignUpProps {
  onSignUpSuccess: (user: any) => void;
  onSwitchToSignIn: () => void;
}

// Password strength helper (matching backend regex)
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
      return "#1f9f92"; // matching your primary teal
    case 5:
      return "#037368"; // dark teal
    default:
      return "#dc2626";
  }
};

interface PasswordRequirementsProps {
  isPasswordValid: boolean;
  hasMinLength: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({
  isPasswordValid,
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
        <li className={`password-requirement ${hasMinLength ? "ok" : "fail"}`}>
          <span className="password-requirement-icon">{hasMinLength ? "✔" : "✖"}</span>
          <span>Be at least 8 characters long</span>
        </li>
        <li className={`password-requirement ${hasLowercase ? "ok" : "fail"}`}>
          <span className="password-requirement-icon">{hasLowercase ? "✔" : "✖"}</span>
          <span>Have at least one lower case character</span>
        </li>
        <li className={`password-requirement ${hasUppercase ? "ok" : "fail"}`}>
          <span className="password-requirement-icon">{hasUppercase ? "✔" : "✖"}</span>
          <span>Have at least one capital letter</span>
        </li>
        <li className={`password-requirement ${hasNumber ? "ok" : "fail"}`}>
          <span className="password-requirement-icon">{hasNumber ? "✔" : "✖"}</span>
          <span>Have at least one number</span>
        </li>
        <li className={`password-requirement ${hasSymbol ? "ok" : "fail"}`}>
          <span className="password-requirement-icon">{hasSymbol ? "✔" : "✖"}</span>
          <span>Have at least one special character</span>
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
  const [isSuccess, setIsSuccess] = useState(false);

  const passwordScore = calculatePasswordStrength(formData.password);
  const passwordBarColor = getPasswordBarColor(passwordScore);

  const hasMinLength = formData.password.length >= 8 && formData.password.length <= 256;
  const hasUppercase = /\p{Lu}/u.test(formData.password);
  const hasLowercase = /\p{Ll}/u.test(formData.password);
  const hasNumber = /\p{Nd}/u.test(formData.password);
  const hasSymbol = /[^\p{L}\p{Nd}\s]/u.test(formData.password);

  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSymbol;
  const isConfirmValid = !!confirmPassword && confirmPassword === formData.password;

  const isFormFilled =
    !!formData.username &&
    !!formData.email &&
    !!formData.password &&
    !!confirmPassword &&
    !!formData.firstName &&
    !!formData.lastName;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError(null);
  };

  const validateForm = (): boolean => {
    const { username, email, firstName, lastName } = formData;

    if (!firstName || firstName.trim().length < 2) {
      setError("First name is required (at least 2 characters)");
      return false;
    }
    if (!lastName || lastName.trim().length < 2) {
      setError("Last name is required (at least 2 characters)");
      return false;
    }
    if (!username || username.trim().length < 4) {
      setError("Username is too short");
      return false;
    }
    if (!email.includes('@')) {
      setError("Email is invalid");
      return false;
    }
    if (!isPasswordValid) {
      setError("The password needs to be at least 8 characters long.");
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
      setIsSuccess(true);

      setTimeout(() => {
        onSignUpSuccess(formData);
      }, 2000);
    } catch (err: any) {
      const errorMsg = err.message || "Sign up failed. Please try again.";

      if (errorMsg.toLowerCase().includes('already exists') || errorMsg.toLowerCase().includes('already registered')) {
        setError(
          `${errorMsg}\n\n` +
          `💡 What to do:\n` +
          `• Click "Sign In" below if you already have an account\n` +
          `• Use a different email address if you want to create a new account`
        );
      } else {
        setError(errorMsg);
      }
      setIsLoading(false);
    }
  };

  let submitButtonContent: React.ReactNode = "Create Account";
  if (isSuccess) {
    submitButtonContent = (
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span>Redirecting...</span>
      </span>
    );
  } else if (isLoading) {
    submitButtonContent = "Creating Account...";
  }

  return (
    <div className="unified-auth-container">
      <style>{`
        /* Gesamter Viewport mit Video-Hintergrund */
        .unified-auth-container {
          position: relative; /* Ermöglicht die absolute Positionierung des Videos */
          display: flex;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          background-color: #f7f9fa; /* Fallback, falls das Video lädt */
        }

        /* 🎥 Hintergrundvideo-Styling mit leichtem Blur-Effekt */
        .auth-bg-video {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover; /* Verhindert Verzerrungen des Videos */
          z-index: 1;        /* Liegt ganz unten */
          pointer-events: none; /* Verhindert Interaktionen mit dem Video */
          
          /* 🛠️ HIER IST DER BLUR-EFFEKT: */
          filter: blur(3px);    /* Erhöhe oder verringere die Pixel für mehr/weniger Unschärfe */
          transform: scale(1.12) translateY(32px); /* Leicht vergrößern, um weiße Ränder durch den Weichzeichner zu schlucken */
        }

        /* Linker Bereich für die schwebende Grafik (Z-Index erhöht) */
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

        /* Rechter Bereich für das Formular (Z-Index erhöht) */
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

        /* Die weiße Registrierungskarte */
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
        
        /* Grid für First Name & Last Name */
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
        
        .mock-submit-button:disabled {
          background: #cbd5e1;
          color: #94a3b8;
          box-shadow: none;
          cursor: not-allowed;
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

        /* Passwort Anforderungen UI */
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
        .password-requirement.ok { color: #1f9f92; }
        .password-requirement.fail { color: #94a3b8; }
        .password-requirement-icon { font-size: 10px; }
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

          <div className="mock-auth-header">
            <h1>Create Account</h1>
            <p>Join Vitruv and start modeling</p>
          </div>

          <form onSubmit={handleSubmit} className="mock-auth-form">
            {error && (
              <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
                ⚠️ {error}
              </div>
            )}

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

            {/* First & Last Name Row */}
            <div className="form-row">
              <div className="mock-form-group">
                <label htmlFor="firstName">First Name *</label>
                <input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="First name"
                  disabled={isLoading || isSuccess}
                  required
                />
              </div>

              <div className="mock-form-group">
                <label htmlFor="lastName">Last Name *</label>
                <input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Last name"
                  disabled={isLoading || isSuccess}
                  required
                />
              </div>
            </div>

            {/* Username */}
            <div className="mock-form-group">
              <label htmlFor="username">Username *</label>
              <input
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Choose a username"
                disabled={isLoading || isSuccess}
                required
              />
            </div>

            {/* Email */}
            <div className="mock-form-group">
              <label htmlFor="email">Email *</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
                disabled={isLoading || isSuccess}
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
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Create a strong password"
                disabled={isLoading || isSuccess}
                required
              />

              {/* PASSWORD STRENGTH METER */}
              {formData.password && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ height: 6, width: "100%", background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(passwordScore / 5) * 100}%`, background: passwordBarColor, transition: "0.3s" }} />
                  </div>

                  <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: passwordBarColor }}>
                    {passwordStrengthLabel(passwordScore)}
                  </div>

                  <PasswordRequirements
                    isPasswordValid={isPasswordValid}
                    hasMinLength={hasMinLength}
                    hasLowercase={hasLowercase}
                    hasUppercase={hasUppercase}
                    hasNumber={hasNumber}
                    hasSymbol={hasSymbol}
                  />
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="mock-form-group">
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
                disabled={isLoading || isSuccess}
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="mock-submit-button"
              disabled={isLoading || !isFormFilled || isSuccess}
            >
              {submitButtonContent}
            </button>
          </form>

          {/* Footer Switching Link */}
          <div className="mock-auth-footer">
            <p>
              Already have an account?{" "}
              <button type="button" className="mock-signup-link" onClick={onSwitchToSignIn} disabled={isLoading || isSuccess}>
                Sign In
              </button>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}