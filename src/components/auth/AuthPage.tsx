import React, { useState } from 'react';
import { SignIn, SignUp } from './index';

export function AuthPage() {
  const [isSignIn, setIsSignIn] = useState(true);

  const handleSignInSuccess = (user: any) => {
    // Redirect to main app - this will be handled by the router
    globalThis.location.href = '/';
  };

  const handleSignUpSuccess = (user: any) => {
    // Redirect to main app - this will be handled by the router
    globalThis.location.href = '/';
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
