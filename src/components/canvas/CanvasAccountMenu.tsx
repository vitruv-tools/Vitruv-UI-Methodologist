import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AuthService } from '../../services/auth';
import { USER_PROFILE_DESCRIPTION, USER_PROFILE_LABEL } from '../../constants/accountLabels';
import { ProfileModal } from '../ui/ProfileModal';
import { CanvasUserAvatar, CanvasUserAvatarButton } from './CanvasUserAvatar';

export interface CanvasAccountDisplay {
  initials: string;
  displayName: string;
  avatarBackground: string;
  ringColor?: string;
}

interface CanvasAccountMenuProps {
  account: CanvasAccountDisplay;
  dismissalBoundaryRef: React.RefObject<HTMLDivElement | null>;
  siblingMenuOpen: boolean;
  onCloseSiblingMenu: () => void;
}

function getProfileMenuItemBackground(hovered: boolean, danger?: boolean): string {
  if (!hovered) return 'transparent';
  if (danger) return '#fef2f2';
  return '#f8fafc';
}

const ProfileMenuItem: React.FC<{
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  danger?: boolean;
  onClick?: () => void;
}> = ({ label, sublabel, icon, danger, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '8px 10px', border: 'none', borderRadius: 6,
        background: getProfileMenuItemBackground(hov, danger),
        color: danger ? '#dc2626' : '#0f172a',
        fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ display: 'flex', flexShrink: 0, color: danger ? 'inherit' : '#475569' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div>{label}</div>
        {sublabel && (
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400, marginTop: 1 }}>{sublabel}</div>
        )}
      </div>
    </button>
  );
};

const UserProfileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export const CanvasAccountMenu: React.FC<CanvasAccountMenuProps> = ({
  account,
  dismissalBoundaryRef,
  siblingMenuOpen,
  onCloseSiblingMenu,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { user, refreshCurrentUser } = useAuth();

  useEffect(() => {
    if (siblingMenuOpen && showProfileMenu) {
      setShowProfileMenu(false);
    }
    if (!siblingMenuOpen && !showProfileMenu) return;

    const handler = (event: MouseEvent) => {
      if (
        dismissalBoundaryRef.current
        && !dismissalBoundaryRef.current.contains(event.target as unknown as HTMLElement)
      ) {
        onCloseSiblingMenu();
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dismissalBoundaryRef, onCloseSiblingMenu, showProfileMenu, siblingMenuOpen]);

  const toggleProfileMenu = useCallback(() => {
    setShowProfileMenu(current => !current);
    onCloseSiblingMenu();
  }, [onCloseSiblingMenu]);

  return (
    <>
      <div style={{ position: 'relative', padding: '0 4px' }}>
        <CanvasUserAvatarButton
          initials={account.initials}
          bg={account.avatarBackground}
          size={28}
          ring={account.ringColor}
          title="My account"
          onClick={toggleProfileMenu}
        />

        {showProfileMenu && !siblingMenuOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: '#ffffff',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.07)',
            padding: '6px',
            zIndex: 500,
            minWidth: 180,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px 12px',
              borderBottom: '1px solid #f1f5f9',
              marginBottom: 4,
            }}>
              <CanvasUserAvatar
                initials={account.initials}
                bg={account.avatarBackground}
                size={36}
                ring={account.ringColor}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                  {account.displayName}
                </div>
                <div style={{ fontSize: 11, color: '#049484', fontWeight: 600, marginTop: 1 }}>Methodologist</div>
              </div>
            </div>

            <ProfileMenuItem
              label={USER_PROFILE_LABEL}
              sublabel={USER_PROFILE_DESCRIPTION}
              icon={<UserProfileIcon />}
              onClick={() => { setShowProfileMenu(false); setShowProfileModal(true); }}
            />
            <ProfileMenuItem
              label="Log out"
              icon={<LogoutIcon />}
              danger
              onClick={() => { setShowProfileMenu(false); AuthService.signOut().then(() => { globalThis.location.href = '/login'; }); }}
            />
          </div>
        )}
      </div>

      {showProfileModal && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfileModal(false)}
          onNameSaved={refreshCurrentUser}
        />
      )}
    </>
  );
};
