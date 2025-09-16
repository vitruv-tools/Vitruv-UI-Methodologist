import React from 'react';
import { Header } from '../components/layout/Header';
import { useAuth } from '../contexts/AuthContext';

export const HomePage: React.FC = () => {
  const { user, signOut } = useAuth();

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <Header user={user} onLogout={signOut} />
      <div style={{
        position: 'absolute',
        top: 48,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f7f9fb'
      }}>
        <div style={{ textAlign: 'center' }}>
          <img src={'/assets/22098030.png'} alt="KIT Logo" style={{ width: 140, height: 140, objectFit: 'contain', display: 'block', margin: '0 auto 16px auto' }} />
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2c3e50', letterSpacing: 0.3 }}>
            Welcome to Vitruvius
          </div>
        </div>
      </div>
    </div>
  );
};


