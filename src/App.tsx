import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage, FastLoginCallback, KeycloakRedirect } from './components/auth';
import { HomePage } from './pages/HomePage';
import { EditorTest } from './pages/EditorTest';
import { OtpVerificationPage } from './pages/OtpVerificationPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
// useAuth is used in ProtectedRoute
import { CanvasPage } from './pages/CanvasPage';
import './App.css';

function ProtectedRoute({ children }: Readonly<{ children: React.ReactNode }>) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: 'var(--v-text-muted)',
      }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Only users with explicit verified status can access protected pages
  if (user?.emailVerified !== true) {
    return <Navigate to="/verify-otp" replace state={{ autoResend: true }} />;
  }

  return <>{children}</>;
}


function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/auth" element={<KeycloakRedirect />} />
          <Route path="/login/callback" element={<FastLoginCallback />} />
          <Route path="/verify-otp" element={<OtpVerificationPage />} />
          <Route path="/" element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } />
          <Route path="/canvas/:id" element={
            <ProtectedRoute>
              <CanvasPage />
            </ProtectedRoute>
          } />
          <Route path="/mml" element={<Navigate to="/" replace />} />
          <Route path="/project" element={<Navigate to="/" replace />} />
          <Route path="/editor" element={<Navigate to="/" replace />} />
          {/*Editor Test Route*/}
          <Route path="/editor-test" element={<EditorTest />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
