import React, { useEffect, useRef, useState } from 'react';
import { User } from '../../services/auth';

interface HeaderProps {
  onSave?: () => void;
  onSaveAs?: () => void;
  onLoad?: () => void;
  onNew?: () => void;
  title?: string;
  user?: User | null;
  onLogout?: () => void;
}

export function Header({ title = 'Vitruvius Modeler', user, onLogout }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const getInitials = (fullName?: string, email?: string) => {
    if (fullName && fullName.trim().length > 0) {
      const parts = fullName.trim().split(/\s+/);
      const first = parts[0]?.[0] ?? '';
      const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
      return (first + last).toUpperCase() || 'U';
    }
    if (email) {
      const namePart = email.split('@')[0] ?? '';
      const first = namePart[0] ?? '';
      const last = namePart[namePart.length - 1] ?? '';
      return (first + last).toUpperCase() || 'U';
    }
    return 'U';
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <header className="header-responsive" style={{
      height: 48,
      background: '#2c3e50',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* User Avatar */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            title={user?.name || user?.email || 'User menu'}
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: '#34495e',
              color: '#ecf0f1',
              border: '1px solid rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              letterSpacing: 0.5,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {getInitials(user?.name, user?.email)}
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 38,
                right: 0,
                width: 240,
                background: '#ffffff',
                color: '#2c3e50',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                padding: 12,
                zIndex: 30,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#ecf0f1',
                    color: '#2c3e50',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                >
                  {getInitials(user?.name, user?.email)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>{user?.name || 'User'}</span>
                  {user?.email && (
                    <span style={{ fontSize: 12, color: '#7f8c8d' }}>{user.email}</span>
                  )}
                </div>
              </div>
              <div style={{ height: 1, background: '#ecf0f1', margin: '8px 0' }} />
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  if (onLogout) {
                    onLogout();
                  } else {
                    // Fallback behavior if no onLogout provided
                    console.log('Logout clicked');
                  }
                }}
                style={{
                  width: '100%',
                  background: '#e74c3c',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}