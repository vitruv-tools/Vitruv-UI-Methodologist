import React, { useState } from 'react';
import { SignIn, SignUp } from './index';

export function AuthPage() {
  const [isSignIn, setIsSignIn] = useState(true);

  const handleSignInSuccess = (user: any) => {
    // Check if user needs email verification
    console.log('Sign in successful, user:', user);
    
    if (user?.emailVerified === false) {
      // User is not verified, redirect to OTP verification
      console.log('User email not verified, redirecting to OTP verification');
      globalThis.location.href = '/verify-otp';
    } else {
      // User is verified or verification status unknown, redirect to main app
      console.log('User email verified, redirecting to home');
      globalThis.location.href = '/';
    }
  };

  const handleSignUpSuccess = (user: any) => {
    // Redirect to OTP verification page after successful registration
    globalThis.location.href = '/verify-otp';
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
