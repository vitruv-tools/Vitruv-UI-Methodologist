import React, { useEffect, useRef, useState } from 'react';
import { User } from '../../services/auth';
import { apiService } from '../../services/api';

interface HeaderProps {
  title?: string;
  user?: User | null;
  onLogout?: () => void;
}

interface ApiUserData {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

export function Header({ title = 'Methodologist Dashboard', user, onLogout }: Readonly<HeaderProps>) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [apiUser, setApiUser] = useState<ApiUserData | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const getInitials = (fullName?: string, email?: string) => {
    if (fullName && fullName.trim().length > 0) {
      const parts = fullName.trim().split(/\s+/);
      const first = parts[0]?.[0] ?? '';
      const last = parts.length > 1 ? parts.at(-1)?.[0] ?? '' : '';
      return (first + last).toUpperCase() || 'U';
    }
    if (email) {
      const namePart = email.split('@')[0] ?? '';
      const first = namePart[0] ?? '';
      const last = namePart.at(-1) ?? '';
      return (first + last).toUpperCase() || 'U';
    }
    return 'U';
  };

  // Get display name from API user or fallback to prop user
  const getDisplayName = () => {
    if (apiUser) {
      return `${apiUser.firstName} ${apiUser.lastName}`.trim() || apiUser.email;
    }
    return user?.name || `${user?.givenName || ''} ${user?.familyName || ''}`.trim() || user?.email || 'User';
  };

  // Get display email
  const getDisplayEmail = () => {
    return apiUser?.email || user?.email || '';
  };

  // Get initials for display
  const getDisplayInitials = () => {
    if (apiUser) {
      return getInitials(`${apiUser.firstName} ${apiUser.lastName}`, apiUser.email);
    }
    return getInitials(user?.name, user?.email);
  };

  // Fetch user info from API
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setIsLoadingUser(true);
        const response = await apiService.getUserInfo();
        setApiUser(response.data);
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      } finally {
        setIsLoadingUser(false);
      }
    };

    fetchUserInfo();
  }, []);

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
      zIndex: 1000,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h1>

      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            title={getDisplayName() || 'User menu'}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#ffffff',
              color: '#34495e',
              border: '2px solid #bdc3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              letterSpacing: 0.5,
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              fontSize: 14,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#7f8c8d';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#bdc3c7';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            }}
          >
            {isLoadingUser ? '...' : getDisplayInitials()}
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 44,
                right: 0,
                width: 300,
                background: '#ffffff',
                color: '#2c3e50',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
                padding: 0,
                zIndex: 1001,
                border: '1px solid #e8e8e8',
                overflow: 'hidden',
                animation: 'slideDown 0.2s ease-out',
              }}
            >
              {/* User Info Section */}
              <div style={{
                background: '#f8f9fa',
                padding: '20px',
                color: '#2c3e50',
                borderBottom: '1px solid #e8e8e8',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: '#ffffff',
                      color: '#34495e',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: 16,
                      border: '2px solid #bdc3c7',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    {isLoadingUser ? '...' : getDisplayInitials()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 16, marginBottom: 4, color: '#2c3e50' }}>
                      {isLoadingUser ? 'Loading...' : getDisplayName()}
                    </span>
                    {!isLoadingUser && getDisplayEmail() && (
                      <span style={{ fontSize: 13, color: '#7f8c8d', marginBottom: 2 }}>
                        {getDisplayEmail()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Badge */}
                {user?.emailVerified !== undefined && (
                  <div style={{
                    marginTop: 12,
                    padding: '6px 12px',
                    background: user.emailVerified ? '#d5f4e6' : '#fadbd8',
                    color: user.emailVerified ? '#27ae60' : '#e74c3c',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 500,
                    border: `1px solid ${user.emailVerified ? '#a9dfbf' : '#f1948a'}`,
                    display: 'inline-block',
                  }}>
                    {user.emailVerified ? '✓ Email Verified' : '⚠ Email Not Verified'}
                  </div>
                )}
              </div>

              {/* Menu Actions */}
              <div style={{ padding: '16px' }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (onLogout) {
                        onLogout();
                      }
                    }}
                    style={{
                      width: '100%',
                      background: '#e74c3c',
                      color: '#ffffff',
                      border: '1px solid #c0392b',
                      borderRadius: 4,
                      padding: '12px 16px',
                      cursor: 'pointer',
                      fontWeight: 500,
                      fontSize: 14,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#c0392b';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#e74c3c';
                    }}
                  >
                    <span style={{ fontSize: 16 }}>↪</span>{' '}
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}