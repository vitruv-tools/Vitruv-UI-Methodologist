import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignIn, SignUp } from './index';

export function AuthPage() {
  const [isSignIn, setIsSignIn] = useState(true);
  const navigate = useNavigate();

  const handleSignInSuccess = (user: any) => {
    // Check if user needs email verification

    if (user?.emailVerified === true) {
      // User is verified, redirect directly to workspace
      navigate('/mml', { replace: true });
    } else {
      // User is not verified (or status is unknown), redirect to OTP verification
      navigate('/verify-otp', { replace: true, state: { autoResend: true } });
    }
  };

  const handleSignUpSuccess = (user: any) => {
    // Redirect to OTP verification page after successful registration
    navigate('/verify-otp', { replace: true });
  };

  const handleSwitchToSignUp = () => {
    setIsSignIn(false);
  };

  const handleSwitchToSignIn = () => {
    setIsSignIn(true);
  };

  return (
    <div className="auth-page">
      {isSignIn ? (
        <SignIn
          onSignInSuccess={handleSignInSuccess}
          onSwitchToSignUp={handleSwitchToSignUp}
        />
      ) : (
        <SignUp
          onSignUpSuccess={handleSignUpSuccess}
          onSwitchToSignIn={handleSwitchToSignIn}
        />
      )}
    </div>
  );
}
