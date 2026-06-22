import React, { useEffect, useState } from 'react';
import { User } from '../../services/auth';
import { apiService } from '../../services/api';
import { USER_PROFILE_LABEL, USER_PROFILE_PAGE_SUBTITLE } from '../../constants/accountLabels';
import { getUserInitials } from '../../utils/userInitials';
import { BoundChangePasswordModal } from './BoundChangePasswordModal';
import { useChangePassword } from '../../hooks/useChangePassword';

interface ProfileViewProps {
  user: User | null;
  userRole?: string;
  onNameSaved?: () => void;
}

// ── tiny icons ────────────────────────────────────────────────────────────────

const EditIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const LockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ── ReadField ─────────────────────────────────────────────────────────────────

const ReadField: React.FC<{ label: string; value?: string; placeholder?: string }> = ({ label, value, placeholder }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      {label}
    </label>
    <div style={{
      padding: '10px 14px',
      background: value ? '#ffffff' : '#f9fafb',
      border: '1.5px solid rgba(0,0,0,0.08)',
      borderRadius: 9,
      fontSize: 14,
      color: value ? '#111827' : '#9ca3af',
    }}>
      {value || placeholder || '—'}
    </div>
  </div>
);

// ── EditInput ─────────────────────────────────────────────────────────────────

const EditInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      {label}
    </label>
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: '10px 14px',
        background: '#ffffff',
        border: '1.5px solid #049484',
        borderRadius: 9,
        fontSize: 14,
        color: '#111827',
        outline: 'none',
        boxShadow: '0 0 0 3px rgba(4,148,132,0.12)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        width: '100%',
        boxSizing: 'border-box',
      }}
    />
  </div>
);

// ── ProfileView ───────────────────────────────────────────────────────────────

export const ProfileView: React.FC<ProfileViewProps> = ({ user, userRole = 'Methodologist', onNameSaved }) => {
  const changePassword = useChangePassword();

  // profile data fetched from backend
  const [profileId,      setProfileId]      = useState<string>(user?.id ?? '');
  const [committedFirst, setCommittedFirst] = useState(user?.givenName  ?? '');
  const [committedLast,  setCommittedLast]  = useState(user?.familyName ?? '');
  const [email,          setEmail]          = useState(user?.email ?? '');
  const [verified,       setVerified]       = useState(user?.emailVerified);
  const [loadError,      setLoadError]      = useState<string | null>(null);

  const [editing,   setEditing]   = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved,     setSaved]     = useState(false);
  const verificationStatus =
  verified === true
    ? '✓ Verified'
    : verified === false
      ? '✗ Not verified'
      : undefined;
  // Load fresh data from backend on mount
  useEffect(() => {
    apiService.getUserInfo()
      .then(({ data }) => {
        setProfileId(String(data.id));
        setCommittedFirst(data.firstName ?? '');
        setCommittedLast(data.lastName  ?? '');
        setEmail(data.email ?? '');
        setVerified(data.emailVerified ?? data.verified ?? undefined);
      })
      .catch(() => setLoadError('Could not load profile data.'));
  }, []);

  if (!user) return null;

  const displayName = [committedFirst, committedLast].filter(Boolean).join(' ') || user.username;
  const initials    = getUserInitials(displayName, email || user.email);

  const handleEditOpen = () => {
    setFirstName(committedFirst);
    setLastName(committedLast);
    setSaveError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await apiService.updateUserName(profileId, firstName.trim(), lastName.trim());
      setCommittedFirst(firstName.trim());
      setCommittedLast(lastName.trim());
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
      onNameSaved?.();
    } catch (err: any) {
      setSaveError(err?.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSaveError(null);
    setEditing(false);
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '44px 48px 48px' }}>
      <div style={{ maxWidth: 680 }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Account
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {USER_PROFILE_LABEL}
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#6b7280' }}>
            {USER_PROFILE_PAGE_SUBTITLE}
          </p>
          {loadError && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 9,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              fontSize: 13, color: '#dc2626',
            }}>
              {loadError}
            </div>
          )}
        </div>

        {/* Avatar card */}
        <div style={{
          background: 'rgba(255,255,255,0.88)',
          border: '1.5px solid rgba(0,0,0,0.07)',
          borderRadius: 14,
          padding: '24px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          marginBottom: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #049484, #06b89e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{displayName}</div>
            <div style={{ fontSize: 13, color: '#049484', fontWeight: 600, marginTop: 2 }}>{userRole}</div>
            {email && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{email}</div>}
          </div>
        </div>

        {/* Name edit card */}
        <div style={{
          background: 'rgba(255,255,255,0.88)',
          border: '1.5px solid rgba(0,0,0,0.07)',
          borderRadius: 14,
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          marginBottom: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}>
          {/* Card header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Account Details</div>
            {!editing && (
              <button
                onClick={handleEditOpen}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: '1.5px solid rgba(0,0,0,0.10)',
                  borderRadius: 8, padding: '6px 12px',
                  fontSize: 13, fontWeight: 600, color: '#374151',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#049484';
                  e.currentTarget.style.color = '#049484';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.10)';
                  e.currentTarget.style.color = '#374151';
                }}
              >
                <EditIcon /> Edit name
              </button>
            )}
          </div>

          {/* Fields */}
          {editing ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <EditInput label="First Name" value={firstName} onChange={setFirstName} placeholder="First name" />
                <EditInput label="Last Name"  value={lastName}  onChange={setLastName}  placeholder="Last name" />
              </div>

              {saveError && (
                <div style={{
                  padding: '10px 14px', borderRadius: 9,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                  fontSize: 13, color: '#dc2626',
                }}>
                  {saveError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: '#049484', border: 'none', borderRadius: 9,
                    padding: '9px 18px', fontSize: 13, fontWeight: 700,
                    color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s',
                  }}
                >
                  <CheckIcon /> {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: '1.5px solid rgba(0,0,0,0.10)',
                    borderRadius: 9, padding: '9px 16px',
                    fontSize: 13, fontWeight: 600, color: '#6b7280',
                    cursor: 'pointer',
                  }}
                >
                  <XIcon /> Cancel
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <ReadField label="First Name" value={committedFirst || undefined} placeholder="Not set" />
              <ReadField label="Last Name"  value={committedLast  || undefined} placeholder="Not set" />
            </div>
          )}

          {/* Read-only fields */}
<ReadField label="Email"    value={email}         placeholder="Not set" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <ReadField label="Role"    value={userRole} />
            <ReadField
              label="Email Verified"
              value={verificationStatus}
              placeholder="Unknown"
            />
          </div>
        </div>

        {/* Success banner */}
        {saved && (
          <div style={{
            marginBottom: 16,
            padding: '10px 16px', borderRadius: 9,
            background: 'rgba(4,148,132,0.10)', border: '1px solid rgba(4,148,132,0.30)',
            fontSize: 13, fontWeight: 600, color: '#049484',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <CheckIcon /> Name updated successfully.
          </div>
        )}

        {/* Change password card */}
        <div style={{
          background: 'rgba(255,255,255,0.88)',
          border: '1.5px solid rgba(0,0,0,0.07)',
          borderRadius: 14,
          padding: '20px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Password</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
              Min. 8 characters · uppercase · lowercase · digit · special character
            </div>
          </div>
          <button
            onClick={changePassword.open}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'none', border: '1.5px solid rgba(0,0,0,0.10)',
              borderRadius: 9, padding: '9px 16px',
              fontSize: 13, fontWeight: 600, color: '#374151',
              cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#049484';
              e.currentTarget.style.color = '#049484';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(0,0,0,0.10)';
              e.currentTarget.style.color = '#374151';
            }}
          >
            <LockIcon /> Change password
          </button>
        </div>

      </div>

      <BoundChangePasswordModal controller={changePassword} />
    </div>
  );
};
