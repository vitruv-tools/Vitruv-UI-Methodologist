import React, { useEffect, useState } from 'react';
import { useModalBodyLock } from './modalUtils';

export interface PasswordValidation {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  isPasswordValid: boolean;
}

export const validatePassword = (password: string): PasswordValidation => {
  const hasMinLength = password.length >= 8 && password.length <= 256;
  const hasUppercase = /\p{Lu}/u.test(password);
  const hasLowercase = /\p{Ll}/u.test(password);
  const hasNumber = /\p{Nd}/u.test(password);
  const hasSymbol = /[^\p{L}\p{Nd}\s]/u.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSymbol;
  return { hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSymbol, isPasswordValid };
};

const ValidationItem: React.FC<{ isValid: boolean; text: string }> = ({ isValid, text }) => (
  <li style={{ display: 'flex', alignItems: 'center', gap: 6, color: isValid ? '#16a34a' : '#dc2626' }}>
    <span style={{ fontWeight: 700, fontSize: 16, minWidth: 16 }}>{isValid ? '✓' : '×'}</span>
    <span>{text}</span>
  </li>
);

const PasswordRequirements: React.FC<{ validation: PasswordValidation; showRequirements: boolean }> = ({
  validation,
  showRequirements,
}) => {
  if (!showRequirements) return null;
  return (
    <div style={{ marginTop: 12, padding: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Password must:</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <ValidationItem isValid={validation.hasMinLength} text="Be at least 8 characters long" />
        <ValidationItem isValid={validation.hasLowercase} text="Have at least one lowercase letter" />
        <ValidationItem isValid={validation.hasUppercase} text="Have at least one uppercase letter" />
        <ValidationItem isValid={validation.hasNumber} text="Have at least one number" />
        <ValidationItem isValid={validation.hasSymbol} text="Have at least one special character" />
      </ul>
    </div>
  );
};

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M1 1l22 22" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
  </svg>
);

const PasswordInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  showError?: boolean;
  errorMessage?: string;
  successMessage?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}> = ({ label, value, onChange, placeholder, disabled, showError, errorMessage, successMessage, onKeyDown }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isToggleHovered, setIsToggleHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const inputId = React.useId();
  return (
    <div style={{ marginBottom: 20 }}>
      <label htmlFor={inputId} style={{ display: 'block', marginBottom: 10, fontSize: 14, fontWeight: 600, color: '#1f2937' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={inputId}
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: '100%', padding: '12px 48px 12px 14px',
            border: showError ? '2px solid #dc2626' : '2px solid #e5e7eb',
            borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none',
            background: isFocused ? '#ffffff' : '#f9fafb',
            boxShadow: isFocused ? '0 0 0 3px rgba(4, 148, 132, 0.1)' : 'none',
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          onClick={() => setIsVisible(prev => !prev)}
          onMouseEnter={() => setIsToggleHovered(true)}
          onMouseLeave={() => setIsToggleHovered(false)}
          disabled={disabled}
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          aria-pressed={isVisible}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 32,
            height: 32,
            border: 'none',
            borderRadius: 6,
            background: isToggleHovered && !disabled ? '#f0fdfa' : 'transparent',
            color: isToggleHovered && !disabled ? '#1f9f92' : '#64748b',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {isVisible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {errorMessage && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontWeight: 700 }}>×</span>
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontWeight: 700 }}>✓</span>
          <span>{successMessage}</span>
        </div>
      )}
    </div>
  );
};

const MessageBox: React.FC<{ message: string; type: 'error' | 'success' }> = ({ message, type }) => {
  const isError = type === 'error';
  return (
    <div style={{
      padding: '14px 16px',
      background: isError ? '#fef2f2' : '#d5f4e6',
      border: `2px solid ${isError ? '#fecaca' : '#a9dfbf'}`,
      borderRadius: 8,
      color: isError ? '#991b1b' : '#166534',
      fontSize: 13,
      marginBottom: 20,
      fontWeight: 500,
    }}>
      {message}
    </div>
  );
};

const ModalButton: React.FC<{
  onClick: () => void;
  label: string;
  variant: 'cancel' | 'submit';
  disabled?: boolean;
  isLoading?: boolean;
  loadingLabel?: string;
}> = ({ onClick, label, variant, disabled, isLoading, loadingLabel }) => {
  const [hov, setHov] = useState(false);
  const isCancel = variant === 'cancel';
  const isDisabled = Boolean(disabled || isLoading);
  let background: string;
  if (isCancel) {
    background = '#fff';
  } else if (isDisabled) {
    background = '#95a5a6';
  } else {
    background = 'linear-gradient(135deg, #049484 0%, #037368 100%)';
  }
  let opacity: number;
  if (!isDisabled) {
    opacity = 1;
  } else if (isCancel) {
    opacity = 0.5;
  } else {
    opacity = 0.6;
  }
  return (
    <button type="button"
      onClick={onClick}
      disabled={isDisabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: isCancel ? '12px 24px' : '12px 28px',
        borderRadius: 8,
        border: isCancel ? '2px solid #e5e7eb' : '2px solid #037368',
        background,
        color: isCancel ? '#374151' : '#fff',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        fontWeight: isCancel ? 600 : 700,
        fontSize: 14,
        opacity,
        transform: !isCancel && hov && !isDisabled ? 'translateY(-1px)' : 'none',
      }}
    >
      {isLoading ? loadingLabel : label}
    </button>
  );
};

export interface ChangePasswordModalProps {
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

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
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
  useModalBodyLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isChanging) onClose();
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isChanging, onClose]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', zIndex: 10000 }}>
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => { if (!isChanging) onClose(); }}
        style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(12px)', border: 'none', padding: 0, margin: 0,
          cursor: isChanging ? 'default' : 'pointer',
        }}
      />
      <dialog
        open
        aria-labelledby="change-password-title"
        style={{
          background: '#fff', borderRadius: 16, padding: 0, width: '90%', maxWidth: 480,
          boxShadow: '0 24px 72px rgba(0,0,0,0.3)', overflow: 'hidden', position: 'relative', zIndex: 1,
          border: 'none', margin: 0,
        }}
      >
        <div style={{ background: 'linear-gradient(135deg, #049484 0%, #037368 100%)', padding: '28px 32px', color: '#fff' }}>
          <h2 id="change-password-title" style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Change Password</h2>
          <p style={{ margin: '10px 0 0', fontSize: 14, opacity: 0.95 }}>
            Please create a strong password that meets all security requirements to protect your account.
          </p>
        </div>
        <div style={{ padding: 32 }}>
          <PasswordInput label="New Password" value={newPassword} onChange={onNewPasswordChange} placeholder="Enter new password" disabled={isChanging} />
          <PasswordRequirements validation={validation} showRequirements={!!newPassword && !validation.isPasswordValid} />
          <PasswordInput
            label="Confirm Password"
            value={confirmPassword}
            onChange={onConfirmPasswordChange}
            placeholder="Re-enter new password"
            disabled={isChanging}
            showError={!!confirmPassword && !isConfirmValid}
            errorMessage={confirmPassword && !isConfirmValid ? 'Passwords do not match' : undefined}
            successMessage={confirmPassword && isConfirmValid ? 'Passwords match' : undefined}
            onKeyDown={e => { if (e.key === 'Enter' && canSubmit) onSubmit(); }}
          />
          {error && <MessageBox message={error} type="error" />}
          {success && <MessageBox message={success} type="success" />}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <ModalButton onClick={onClose} label="Cancel" variant="cancel" disabled={isChanging} />
            <ModalButton onClick={onSubmit} label="Change Password" variant="submit" disabled={!canSubmit} isLoading={isChanging} loadingLabel="Changing Password..." />
          </div>
        </div>
      </dialog>
    </div>
  );
};
