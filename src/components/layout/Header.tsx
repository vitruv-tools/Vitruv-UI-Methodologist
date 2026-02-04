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
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
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

  // Password validation rules (same as registration)
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSymbol = /[@$!%?&]/.test(newPassword);
  const hasOnlyAllowedChars =
    newPassword === '' || /^[A-Za-z0-9@$!%?&]+$/.test(newPassword);

  const isPasswordValid =
    hasMinLength &&
    hasUppercase &&
    hasLowercase &&
    hasNumber &&
    hasSymbol &&
    hasOnlyAllowedChars;

  const isConfirmValid = !!confirmPassword && confirmPassword === newPassword;

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!newPassword || !confirmPassword) {
      setPasswordError('Both password fields are required');
      return;
    }

    if (!hasOnlyAllowedChars) {
      setPasswordError('Password contains invalid characters. Only letters, numbers, and symbols @ $ ! % ? & are allowed');
      return;
    }

    if (!hasMinLength) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    if (!hasUppercase) {
      setPasswordError('Password must contain at least one uppercase letter');
      return;
    }

    if (!hasLowercase) {
      setPasswordError('Password must contain at least one lowercase letter');
      return;
    }

    if (!hasNumber) {
      setPasswordError('Password must contain at least one number');
      return;
    }

    if (!hasSymbol) {
      setPasswordError('Password must contain at least one symbol (@ $ ! % ? &)');
      return;
    }

    if (!isPasswordValid) {
      setPasswordError('Password does not meet all requirements');
      return;
    }

    if (!isConfirmValid) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await apiService.changePassword(newPassword);
      setPasswordSuccess(response.message || 'Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsChangePasswordOpen(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

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
                      setIsChangePasswordOpen(true);
                    }}
                    style={{
                      width: '100%',
                      background: '#049484',
                      color: '#ffffff',
                      border: '1px solid #037368',
                      borderRadius: 6,
                      padding: '12px 16px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 14,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      textAlign: 'left',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#037368';
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(4, 148, 132, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#049484';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                    }}
                  >
                    <span style={{ fontSize: 16 }}>🔒</span>
                    Change Password
                  </button>
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

      {/* Change Password Modal */}
      {isChangePasswordOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => {
            if (!isChangingPassword) {
              setIsChangePasswordOpen(false);
              setPasswordError('');
              setPasswordSuccess('');
              setNewPassword('');
              setConfirmPassword('');
            }
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: 0,
              width: '90%',
              maxWidth: 480,
              boxShadow: '0 24px 72px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
              animation: 'slideUp 0.3s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with gradient */}
            <div style={{
              background: 'linear-gradient(135deg, #049484 0%, #037368 100%)',
              padding: '28px 32px',
              color: '#ffffff',
              borderBottom: '3px solid #037368',
            }}>
              <h2 style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: '-0.5px',
                lineHeight: 1.3,
              }}>
                Change Password
              </h2>
              <p style={{
                margin: '10px 0 0 0',
                fontSize: 14,
                opacity: 0.95,
                fontWeight: 400,
                lineHeight: 1.5,
              }}>
                Please create a strong password that meets all security requirements to protect your account.
              </p>
            </div>

            {/* Form Content */}
            <div style={{ padding: '32px' }}>

              <div style={{ marginBottom: 20 }}>
                <label style={{
                  display: 'block',
                  marginBottom: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#1f2937',
                  letterSpacing: '0.2px',
                }}>
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordError('');
                  }}
                  placeholder="Enter new password"
                  disabled={isChangingPassword}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 14,
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    background: '#f9fafb',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#049484';
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(4, 148, 132, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />

                {/* Password Requirements Checklist */}
                {newPassword && !isPasswordValid && (
                  <div style={{
                    marginTop: 12,
                    padding: '12px',
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                  }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#374151',
                      marginBottom: 8,
                    }}>
                      Password must:
                    </div>
                    <ul style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      fontSize: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}>
                      <li style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: hasOnlyAllowedChars ? '#16a34a' : '#dc2626',
                      }}>
                        <span style={{ fontWeight: 700, fontSize: 16, minWidth: 16 }}>
                          {hasOnlyAllowedChars ? '✓' : '×'}
                        </span>
                        <span>Use only letters, numbers, and symbols: @ $ ! % ? &</span>
                      </li>
                      <li style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: hasMinLength ? '#16a34a' : '#dc2626',
                      }}>
                        <span style={{ fontWeight: 700, fontSize: 16, minWidth: 16 }}>
                          {hasMinLength ? '✓' : '×'}
                        </span>
                        <span>Be at least 8 characters</span>
                      </li>
                      <li style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: hasLowercase ? '#16a34a' : '#dc2626',
                      }}>
                        <span style={{ fontWeight: 700, fontSize: 16, minWidth: 16 }}>
                          {hasLowercase ? '✓' : '×'}
                        </span>
                        <span>Have at least one lowercase letter</span>
                      </li>
                      <li style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: hasUppercase ? '#16a34a' : '#dc2626',
                      }}>
                        <span style={{ fontWeight: 700, fontSize: 16, minWidth: 16 }}>
                          {hasUppercase ? '✓' : '×'}
                        </span>
                        <span>Have at least one uppercase letter</span>
                      </li>
                      <li style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: hasNumber ? '#16a34a' : '#dc2626',
                      }}>
                        <span style={{ fontWeight: 700, fontSize: 16, minWidth: 16 }}>
                          {hasNumber ? '✓' : '×'}
                        </span>
                        <span>Have at least one number</span>
                      </li>
                      <li style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: hasSymbol ? '#16a34a' : '#dc2626',
                      }}>
                        <span style={{ fontWeight: 700, fontSize: 16, minWidth: 16 }}>
                          {hasSymbol ? '✓' : '×'}
                        </span>
                        <span>Have at least one symbol (@ $ ! % ? &)</span>
                      </li>
                    </ul>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{
                  display: 'block',
                  marginBottom: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#1f2937',
                  letterSpacing: '0.2px',
                }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordError('');
                  }}
                  placeholder="Re-enter new password"
                  disabled={isChangingPassword}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: confirmPassword && !isConfirmValid ? '2px solid #dc2626' : '2px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 14,
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    background: '#f9fafb',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#049484';
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(4, 148, 132, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = confirmPassword && !isConfirmValid ? '#dc2626' : '#e5e7eb';
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isChangingPassword && isPasswordValid && isConfirmValid) {
                      handleChangePassword();
                    }
                  }}
                />
                {confirmPassword && !isConfirmValid && (
                  <div style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontWeight: 500,
                  }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>×</span>
                    <span>Passwords do not match</span>
                  </div>
                )}
                {confirmPassword && isConfirmValid && (
                  <div style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontWeight: 500,
                  }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>✓</span>
                    <span>Passwords match</span>
                  </div>
                )}
              </div>

              {passwordError && (
                <div style={{
                  padding: '14px 16px',
                  background: '#fef2f2',
                  border: '2px solid #fecaca',
                  borderRadius: 8,
                  color: '#991b1b',
                  fontSize: 13,
                  marginBottom: 20,
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}>
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div style={{
                  padding: '14px 16px',
                  background: '#d5f4e6',
                  border: '2px solid #a9dfbf',
                  borderRadius: 8,
                  color: '#166534',
                  fontSize: 13,
                  marginBottom: 20,
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}>
                  {passwordSuccess}
                </div>
              )}

              <div style={{
                display: 'flex',
                gap: 12,
                justifyContent: 'flex-end',
                paddingTop: 4,
              }}>
                <button
                  onClick={() => {
                    setIsChangePasswordOpen(false);
                    setPasswordError('');
                    setPasswordSuccess('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  disabled={isChangingPassword}
                  style={{
                    padding: '12px 24px',
                    borderRadius: 8,
                    border: '2px solid #e5e7eb',
                    background: '#ffffff',
                    color: '#374151',
                    cursor: isChangingPassword ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                    transition: 'all 0.2s ease',
                    opacity: isChangingPassword ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isChangingPassword) {
                      e.currentTarget.style.background = '#f9fafb';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isChangingPassword) {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !isPasswordValid || !isConfirmValid}
                  style={{
                    padding: '12px 28px',
                    borderRadius: 8,
                    border: '2px solid #037368',
                    background: (isChangingPassword || !isPasswordValid || !isConfirmValid) ? '#95a5a6' : 'linear-gradient(135deg, #049484 0%, #037368 100%)',
                    color: '#ffffff',
                    cursor: (isChangingPassword || !isPasswordValid || !isConfirmValid) ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: 14,
                    transition: 'all 0.2s ease',
                    boxShadow: (isChangingPassword || !isPasswordValid || !isConfirmValid) ? 'none' : '0 2px 8px rgba(4, 148, 132, 0.25)',
                    opacity: (isChangingPassword || !isPasswordValid || !isConfirmValid) ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isChangingPassword && isPasswordValid && isConfirmValid) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(4, 148, 132, 0.35)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isChangingPassword && isPasswordValid && isConfirmValid) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(4, 148, 132, 0.25)';
                    }
                  }}
                >
                  {isChangingPassword ? 'Changing Password...' : 'Change Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}