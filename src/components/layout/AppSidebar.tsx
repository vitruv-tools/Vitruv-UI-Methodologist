import React, { useRef } from 'react';
import { BoundChangePasswordModal } from '../ui/BoundChangePasswordModal';
import { useChangePassword } from '../../hooks/useChangePassword';
import { useDismissOnOutsideClick } from '../../hooks/useDismissOnOutsideClick';
import { getUserInitials } from '../../utils/userInitials';

export type SidebarView = 'library' | 'projects' | 'settings';

interface AppSidebarProps {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  userName?: string;
  userRole?: string;
  userEmail?: string;
  onHelp?: () => void;
  onSettings?: () => void;
  onLogout?: () => void;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const HomeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const LibraryIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const HelpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ── NavItem ───────────────────────────────────────────────────────────────────

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick }) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none',
        background: active ? 'rgba(4,148,132,0.15)' : hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        color: active ? '#ffffff' : hovered ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)',
        fontSize: 14, fontWeight: active ? 600 : 400,
        cursor: 'pointer', textAlign: 'left',
        transition: 'all 0.15s ease', letterSpacing: '0.01em',
      }}
    >
      <span style={{ color: active ? '#4ecdc4' : 'inherit', flexShrink: 0 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
};

// ── MenuDivider ───────────────────────────────────────────────────────────────

const MenuDivider = () => (
  <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
);

// ── MenuItem ──────────────────────────────────────────────────────────────────

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  danger?: boolean;
  onClick?: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, sublabel, danger = false, onClick }) => {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '8px 12px',
        border: 'none', borderRadius: 6,
        background: hov
          ? danger ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.07)'
          : 'transparent',
        color: danger
          ? hov ? '#f87171' : 'rgba(248,113,113,0.75)'
          : hov ? '#ffffff' : 'rgba(255,255,255,0.7)',
        cursor: 'pointer', textAlign: 'left',
        transition: 'all 0.12s ease',
      }}
    >
      <span style={{ flexShrink: 0, opacity: 0.85 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {sublabel && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{sublabel}</div>
        )}
      </div>
    </button>
  );
};

// ── AppSidebar ────────────────────────────────────────────────────────────────

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeView, onViewChange,
  userName = 'User', userRole = 'Methodologist', userEmail,
  onHelp, onSettings, onLogout,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [userHovered, setUserHovered] = React.useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const changePassword = useChangePassword();

  useDismissOnOutsideClick(menuRef, menuOpen, () => setMenuOpen(false));

  return (
    <aside style={{
      width: 220, height: '100vh',
      background: '#0B1720',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      borderRight: '1px solid rgba(255,255,255,0.06)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Sidebar background image */}
      <img
        src="/assets/sidebar-bg.png"
        alt=""
        aria-hidden
        style={{
          position: 'absolute', top: 160, left: '50%',
          transform: 'translateX(-50%)',
          width: '150%', bottom: 52,
          objectFit: 'fill', objectPosition: 'top center',
          opacity: 0.80, pointerEvents: 'none', userSelect: 'none',
        }}
      />

      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src="/assets/vitruvius1.png" alt="Vitruvius" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
          <span style={{
            color: '#ffffff', fontWeight: 700, fontSize: 18,
            letterSpacing: '-0.01em', marginTop: 3,
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          }}>
            Vitruvius
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ padding: '12px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <NavItem icon={<HomeIcon />} label="Dashboard / Projects" active={activeView === 'projects'} onClick={() => onViewChange('projects')} />
        <NavItem icon={<LibraryIcon />} label="Model library" active={activeView === 'library'} onClick={() => onViewChange('library')} />
      </nav>

      {/* ── Bottom section ── */}
      <div
        ref={menuRef}
        style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}
      >
        {/* ── Context menu (pops upward) ── */}
        {menuOpen && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 8px)', left: 8, right: 8,
            background: '#131e2b',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            boxShadow: '0 -8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)',
            padding: '6px',
            zIndex: 100,
          }}>
            {/* User header inside menu */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              marginBottom: 4,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'linear-gradient(135deg, #049484, #06b89e)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {getUserInitials(userName, userEmail)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {userName}
                </div>
                {userEmail && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                    {userEmail}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#4ecdc4', marginTop: userEmail ? 0 : 1 }}>{userRole}</div>
              </div>
            </div>

            {/* Account actions */}
            <MenuItem icon={<UserIcon />} label="My Profile" sublabel="View & edit your profile" onClick={() => { setMenuOpen(false); }} />
            <MenuItem icon={<LockIcon />} label="Change Password" onClick={() => { setMenuOpen(false); changePassword.open(); }} />
            <MenuItem icon={<BellIcon />} label="Notifications" sublabel="Manage alerts" onClick={() => { setMenuOpen(false); }} />

            <MenuDivider />

            <MenuItem icon={<SettingsIcon />} label="Settings" sublabel="App preferences" onClick={() => { setMenuOpen(false); onSettings?.(); }} />
            <MenuItem icon={<HelpIcon />} label="Help & Support" onClick={() => { setMenuOpen(false); onHelp?.(); }} />
            <MenuItem icon={<ShieldIcon />} label="Privacy & Security" onClick={() => { setMenuOpen(false); }} />

            <MenuDivider />

            <MenuItem icon={<LogoutIcon />} label="Log out" danger onClick={() => { setMenuOpen(false); onLogout?.(); }} />
          </div>
        )}

        {/* Border above user card */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 12px 12px' }}>
          {/* User card */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            onMouseEnter={() => setUserHovered(true)}
            onMouseLeave={() => setUserHovered(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '8px 6px', borderRadius: 8, border: 'none',
              background: menuOpen
                ? 'rgba(4,148,132,0.12)'
                : userHovered ? 'rgba(255,255,255,0.06)' : 'transparent',
              cursor: 'pointer', transition: 'background 0.15s ease', textAlign: 'left',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #049484, #06b89e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {getUserInitials(userName, userEmail)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userName}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                {userRole}
              </div>
            </div>
            <span style={{ color: menuOpen ? '#4ecdc4' : 'rgba(255,255,255,0.35)', flexShrink: 0, transition: 'color 0.15s' }}>
              {menuOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </span>
          </button>
        </div>
      </div>

      <BoundChangePasswordModal controller={changePassword} />
    </aside>
  );
};
