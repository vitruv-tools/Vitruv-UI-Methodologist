import React, { useState } from 'react';
import { SignInCredentials } from '../../services/auth';
import { useAuth } from '../../contexts/AuthContext';
import './Auth.css';

interface SignInProps {
  onSignInSuccess: (user: any) => void;
  onSwitchToSignUp: () => void;
}

export function SignIn({ onSignInSuccess, onSwitchToSignUp }: SignInProps) {
  const { signIn } = useAuth();
  const [credentials, setCredentials] = useState<SignInCredentials>({
    username: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await signIn(credentials.username, credentials.password);
      
      // Call success callback
      onSignInSuccess({ username: credentials.username });
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'Sign in failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
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

        <div className="auth-divider">
          <span>or</span>
        </div>

        <div className="demo-credentials">
          <p className="demo-title">API Endpoint</p>
          <div className="demo-info">
            <p>This application connects to the backend API at:</p>
            <p><code>http://localhost:9811/api/v1/users/login</code></p>
            <p>Make sure your backend server is running on port 9811.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
