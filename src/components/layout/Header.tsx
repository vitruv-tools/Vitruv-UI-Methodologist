import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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

interface PasswordValidation {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  hasOnlyAllowedChars: boolean;
  isPasswordValid: boolean;
}

// Sub-components for reduced complexity

interface ValidationItemProps {
  isValid: boolean;
  text: string;
}

const ValidationItem: React.FC<ValidationItemProps> = ({ isValid, text }) => (
  <li style={{
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: isValid ? '#16a34a' : '#dc2626',
  }}>
    <span style={{ fontWeight: 700, fontSize: 16, minWidth: 16 }}>
      {isValid ? '✓' : '×'}
    </span>
    <span>{text}</span>
  </li>
);

interface PasswordRequirementsProps {
  validation: PasswordValidation;
  showRequirements: boolean;
}

const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ validation, showRequirements }) => {
  if (!showRequirements) return null;

  return (
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
        <ValidationItem isValid={validation.hasOnlyAllowedChars} text="Use only letters, numbers, and symbols: @ $ ! % ? &" />
        <ValidationItem isValid={validation.hasMinLength} text="Be at least 8 characters" />
        <ValidationItem isValid={validation.hasLowercase} text="Have at least one lowercase letter" />
        <ValidationItem isValid={validation.hasUppercase} text="Have at least one uppercase letter" />
        <ValidationItem isValid={validation.hasNumber} text="Have at least one number" />
        <ValidationItem isValid={validation.hasSymbol} text="Have at least one symbol (@ $ ! % ? &)" />
      </ul>
    </div>
  );
};

interface UserAvatarProps {
  initials: string;
  size: number;
  isLoading: boolean;
  onClick?: () => void;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ initials, size, isLoading, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

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
    cursor: onClick ? 'pointer' : 'default',
    userSelect: 'none' as const,
    transition: 'all 0.2s ease',
    boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.1)',
    fontSize: size > 40 ? 16 : 14,
  };

  return (
    <div
      style={avatarStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isLoading ? '...' : initials}
    </div>
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
    boxShadow: isPrimary && isHovered ? '0 2px 6px rgba(4, 148, 132, 0.3)' : isPrimary ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
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

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  showError?: boolean;
  errorMessage?: string;
  successMessage?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

const PasswordInput: React.FC<PasswordInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  showError,
  errorMessage,
  successMessage,
  onKeyDown,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputId = React.useId();

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    border: showError ? '2px solid #dc2626' : '2px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 14,
    boxSizing: 'border-box' as const,
    outline: 'none',
    transition: 'all 0.2s ease',
    background: isFocused ? '#ffffff' : '#f9fafb',
    boxShadow: isFocused ? '0 0 0 3px rgba(4, 148, 132, 0.1)' : 'none',
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <label htmlFor={inputId} style={{
        display: 'block',
        marginBottom: 10,
        fontSize: 14,
        fontWeight: 600,
        color: '#1f2937',
        letterSpacing: '0.2px',
      }}>
        {label}
      </label>
      <input
        id={inputId}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={inputStyle}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={onKeyDown}
      />
      {errorMessage && (
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
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
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
          <span>{successMessage}</span>
        </div>
      )}
    </div>
  );
};

interface MessageBoxProps {
  message: string;
  type: 'error' | 'success';
}

const MessageBox: React.FC<MessageBoxProps> = ({ message, type }) => {
  const isError = type === 'error';
  const style = {
    padding: '14px 16px',
    background: isError ? '#fef2f2' : '#d5f4e6',
    border: `2px solid ${isError ? '#fecaca' : '#a9dfbf'}`,
    borderRadius: 8,
    color: isError ? '#991b1b' : '#166534',
    fontSize: 13,
    marginBottom: 20,
    fontWeight: 500,
    lineHeight: 1.5,
  };

  return <div style={style}>{message}</div>;
};

interface ModalButtonProps {
  onClick: () => void;
  label: string;
  variant: 'cancel' | 'submit';
  disabled?: boolean;
  isLoading?: boolean;
  loadingLabel?: string;
}

const ModalButton: React.FC<ModalButtonProps> = ({
  onClick,
  label,
  variant,
  disabled,
  isLoading,
  loadingLabel,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isDisabled = disabled || isLoading;
  const isCancel = variant === 'cancel';

  const baseStyle = {
    padding: isCancel ? '12px 24px' : '12px 28px',
    borderRadius: 8,
    border: isCancel ? '2px solid #e5e7eb' : '2px solid #037368',
    background: isCancel
      ? '#ffffff'
      : isDisabled
      ? '#95a5a6'
      : 'linear-gradient(135deg, #049484 0%, #037368 100%)',
    color: isCancel ? '#374151' : '#ffffff',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    fontWeight: isCancel ? 600 : 700,
    fontSize: 14,
    transition: 'all 0.2s ease',
    boxShadow: !isCancel && !isDisabled ? '0 2px 8px rgba(4, 148, 132, 0.25)' : 'none',
    opacity: isDisabled && !isCancel ? 0.6 : isDisabled ? 0.5 : 1,
    transform: !isCancel && isHovered && !isDisabled ? 'translateY(-1px)' : 'translateY(0)',
  };

  const handleMouseEnter = () => {
    if (!isDisabled) setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      style={baseStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isLoading ? loadingLabel : label}
    </button>
  );
};

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  newPassword: string;
  confirmPassword: string;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  validation: PasswordValidation;
  isConfirmValid: boolean;
  isChanging: boolean;
  error: string;
  success: string;
  onSubmit: () => void;
  canSubmit: boolean;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  newPassword,
  confirmPassword,
  onNewPasswordChange,
  onConfirmPasswordChange,
  validation,
  isConfirmValid,
  isChanging,
  error,
  success,
  onSubmit,
  canSubmit,
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = () => {
    if (!isChanging) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isChanging) {
      onClose();
    }
  };

  return (
    <div
      role="presentation"
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
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
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
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div style={{
          background: 'linear-gradient(135deg, #049484 0%, #037368 100%)',
          padding: '28px 32px',
          color: '#ffffff',
          borderBottom: '3px solid #037368',
        }}>
          <h2 id="change-password-title" style={{
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
          <PasswordInput
            label="New Password"
            value={newPassword}
            onChange={onNewPasswordChange}
            placeholder="Enter new password"
            disabled={isChanging}
          />
          <PasswordRequirements
            validation={validation}
            showRequirements={!!newPassword && !validation.isPasswordValid}
          />

          <PasswordInput
            label="Confirm Password"
            value={confirmPassword}
            onChange={onConfirmPasswordChange}
            placeholder="Re-enter new password"
            disabled={isChanging}
            showError={!!confirmPassword && !isConfirmValid}
            errorMessage={confirmPassword && !isConfirmValid ? 'Passwords do not match' : undefined}
            successMessage={confirmPassword && isConfirmValid ? 'Passwords match' : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) {
                onSubmit();
              }
            }}
          />

          {error && <MessageBox message={error} type="error" />}
          {success && <MessageBox message={success} type="success" />}

          <div style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end',
            paddingTop: 4,
          }}>
            <ModalButton
              onClick={onClose}
              label="Cancel"
              variant="cancel"
              disabled={isChanging}
            />
            <ModalButton
              onClick={onSubmit}
              label="Change Password"
              variant="submit"
              disabled={!canSubmit}
              isLoading={isChanging}
              loadingLabel="Changing Password..."
            />
          </div>
        </div>
      </div>
    </div>
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

const validatePassword = (password: string): PasswordValidation => {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[@$!%?&]/.test(password);
  const hasOnlyAllowedChars = password === '' || /^[A-Za-z0-9@$!%?&]+$/.test(password);
  
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && 
    hasNumber && hasSymbol && hasOnlyAllowedChars;

  return {
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSymbol,
    hasOnlyAllowedChars,
    isPasswordValid,
  };
};

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

  const passwordValidation = useMemo(() => validatePassword(newPassword), [newPassword]);
  const isConfirmValid = useMemo(() => 
    !!confirmPassword && confirmPassword === newPassword, 
    [confirmPassword, newPassword]
  );
  const canSubmitPassword = useMemo(() => 
    !isChangingPassword && passwordValidation.isPasswordValid && isConfirmValid,
    [isChangingPassword, passwordValidation.isPasswordValid, isConfirmValid]
  );

  // Callbacks with useCallback
  const resetPasswordModal = useCallback(() => {
    setIsChangePasswordOpen(false);
    setPasswordError('');
    setPasswordSuccess('');
    setNewPassword('');
    setConfirmPassword('');
  }, []);

  const handleChangePassword = useCallback(async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordValidation.isPasswordValid) {
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
        resetPasswordModal();
      }, 2000);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  }, [newPassword, passwordValidation.isPasswordValid, isConfirmValid, resetPasswordModal]);

  const handleLogout = useCallback(() => {
    setIsMenuOpen(false);
    onLogout?.();
  }, [onLogout]);

  const openChangePassword = useCallback(() => {
    setIsMenuOpen(false);
    setIsChangePasswordOpen(true);
  }, []);

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
        isOpen={isChangePasswordOpen}
        onClose={resetPasswordModal}
        newPassword={newPassword}
        confirmPassword={confirmPassword}
        onNewPasswordChange={(value) => {
          setNewPassword(value);
          setPasswordError('');
        }}
        onConfirmPasswordChange={(value) => {
          setConfirmPassword(value);
          setPasswordError('');
        }}
        validation={passwordValidation}
        isConfirmValid={isConfirmValid}
        isChanging={isChangingPassword}
        error={passwordError}
        success={passwordSuccess}
        onSubmit={handleChangePassword}
        canSubmit={canSubmitPassword}
      />
    </header>
  );
}