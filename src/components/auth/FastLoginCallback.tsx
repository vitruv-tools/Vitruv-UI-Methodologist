import React from 'react';
import { Link } from 'react-router-dom';
import { useFastLoginCallback } from '../../hooks/useFastLoginCallback';
import './Auth.css';

/**
 * OAuth callback page for Fast Login (/auth/callback?code=...).
 */
export function FastLoginCallback() {
  const { isProcessing, error } = useFastLoginCallback();

  if (error) {
    return (
      <div className="auth-container" style={{ backgroundColor: '#f0f0f0' }}>
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-header">
            <h1>Fast Login Failed</h1>
            <p>We could not complete sign-in with your institution account.</p>
          </div>
          <div className="error-message" style={{ marginBottom: '20px' }}>
            <span className="error-icon">⚠️</span>
            {error}
          </div>
          <Link to="/login" className="auth-button primary" style={{ textDecoration: 'none' }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '18px',
          color: '#666',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
        <div>Completing Fast Login...</div>
        <div style={{ fontSize: '14px', color: '#999' }}>
          Exchanging authorization code for your session.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '16px',
        color: '#666',
      }}
    >
      Processing...
    </div>
  );
}
