import React from 'react';
import { Header } from '../components/layout/Header';
import { SidebarTabs } from '../components';
import { useAuth } from '../contexts/AuthContext';

export const HomePage: React.FC = () => {
  const { user, signOut } = useAuth();

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden' }}>
      <aside style={{ width: 350, borderRight: '1px solid #e5e7eb' }}>
        <SidebarTabs width={350} />
      </aside>
      <div style={{ flex: 1, position: 'relative' }}>
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
            <img src={'/assets/vitruvius1.png'} alt="Vitruvius" style={{ width: 600, height: 600, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
          </div>
        </div>
      </div>
    </div>
  );
};


