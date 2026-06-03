import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { User } from '../../services/auth';
import { apiService } from '../../services/api';
import { ChangePasswordModal } from '../ui/ChangePasswordModal';
import { useChangePassword } from '../../hooks/useChangePassword';

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

interface UserAvatarProps {
  initials: string;
  size: number;
  isLoading: boolean;
  onClick?: () => void;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ initials, size, isLoading, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isClickable = typeof onClick === 'function';

  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: '#ffffff',
    color: '#34495e',
    border: '2px solid ' + (isHovered ? '#7f8c8d' : '#bdc3c7'),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    letterSpacing: 0.5,
    cursor: isClickable ? 'pointer' : 'default',
    userSelect: 'none' as const,
    transition: 'all 0.2s ease',
    boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.1)',
    fontSize: size > 40 ? 16 : 14,
    padding: 0,
    outline: 'none',
    appearance: 'none' as const,
  };

  return (
    <button
      type="button"
      style={avatarStyle}
      onClick={onClick}
      disabled={!isClickable}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isLoading ? '...' : initials}
    </button>
  );
};

interface StatusBadgeProps {
  isVerified: boolean | undefined;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ isVerified }) => {
  if (isVerified === undefined) return null;

  const badgeStyle = {
    marginTop: 12,
    padding: '6px 12px',
    background: isVerified ? '#d5f4e6' : '#fadbd8',
    color: isVerified ? '#27ae60' : '#e74c3c',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 500,
    border: `1px solid ${isVerified ? '#a9dfbf' : '#f1948a'}`,
    display: 'inline-block',
  };

  return (
    <div style={badgeStyle}>
      {isVerified ? '✓ Email Verified' : '⚠ Email Not Verified'}
    </div>
  );
};

interface ActionButtonProps {
  onClick: () => void;
  icon: string;
  label: string;
  variant?: 'primary' | 'danger';
  disabled?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ onClick, icon, label, variant = 'primary', disabled }) => {
  const [isHovered, setIsHovered] = useState(false);

  const isPrimary = variant === 'primary';
  let boxShadow = 'none';
  if (isPrimary) {
    boxShadow = isHovered ? '0 2px 6px rgba(4, 148, 132, 0.3)' : '0 1px 3px rgba(0,0,0,0.1)';
  }

  const baseStyle = {
    width: '100%',
    background: isPrimary ? '#049484' : '#e74c3c',
    color: '#ffffff',
    border: `1px solid ${isPrimary ? '#037368' : '#c0392b'}`,
    borderRadius: isPrimary ? 6 : 4,
    padding: '12px 16px',
    cursor: disabled ? 'not-allowed' as const : 'pointer' as const,
    fontWeight: isPrimary ? 600 : 500,
    fontSize: 14,
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textAlign: 'left' as const,
    boxShadow,
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={baseStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>{' '}
      {label}
    </button>
  );
};

// Helper functions
const getInitials = (fullName?: string, email?: string): string => {
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

export function Header({ title = 'Methodologist Dashboard', user, onLogout }: Readonly<HeaderProps>) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [apiUser, setApiUser] = useState<ApiUserData | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const changePassword = useChangePassword();
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Computed values with useMemo
  const displayName = useMemo(() => {
    if (apiUser) {
      return `${apiUser.firstName} ${apiUser.lastName}`.trim() || apiUser.email;
    }
    return user?.name || `${user?.givenName || ''} ${user?.familyName || ''}`.trim() || user?.email || 'User';
  }, [apiUser, user]);

  const displayEmail = useMemo(() => {
    return apiUser?.email || user?.email || '';
  }, [apiUser, user]);

  const displayInitials = useMemo(() => {
    if (apiUser) {
      return getInitials(`${apiUser.firstName} ${apiUser.lastName}`, apiUser.email);
    }
    return getInitials(user?.name, user?.email);
  }, [apiUser, user]);

  const handleLogout = useCallback(() => {
    setIsMenuOpen(false);
    onLogout?.();
  }, [onLogout]);

  const openChangePassword = useCallback(() => {
    setIsMenuOpen(false);
    changePassword.open();
  }, [changePassword.open]);

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
      background: 'linear-gradient(135deg, #049484 0%, #037368 100%)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      boxShadow: '0 2px 8px rgba(4, 148, 132, 0.25)',
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
          <UserAvatar
            initials={displayInitials}
            size={36}
            isLoading={isLoadingUser}
            onClick={() => setIsMenuOpen((open) => !open)}
          />

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
                  <UserAvatar initials={displayInitials} size={48} isLoading={isLoadingUser} />
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 16, marginBottom: 4, color: '#2c3e50' }}>
                      {isLoadingUser ? 'Loading...' : displayName}
                    </span>
                    {!isLoadingUser && displayEmail && (
                      <span style={{ fontSize: 13, color: '#7f8c8d', marginBottom: 2 }}>
                        {displayEmail}
                      </span>
                    )}
                  </div>
                </div>
                <StatusBadge isVerified={user?.emailVerified} />
              </div>

              {/* Menu Actions */}
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <ActionButton onClick={openChangePassword} icon="🔒" label="Change Password" variant="primary" />
                  <ActionButton onClick={handleLogout} icon="↪" label="Sign Out" variant="danger" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ChangePasswordModal
        isOpen={changePassword.isOpen}
        onClose={changePassword.close}
        newPassword={changePassword.newPassword}
        confirmPassword={changePassword.confirmPassword}
        onNewPasswordChange={changePassword.setNewPassword}
        onConfirmPasswordChange={changePassword.setConfirmPassword}
        validation={changePassword.validation}
        isConfirmValid={changePassword.isConfirmValid}
        isChanging={changePassword.isChanging}
        error={changePassword.error}
        success={changePassword.success}
        onSubmit={changePassword.handleSubmit}
        canSubmit={changePassword.canSubmit}
      />
    </header>
  );
}