import React from 'react';
import ReactDOM from 'react-dom';
import { User } from '../../services/auth';
import { ProfileView } from './ProfileView';
import { modalBackdropStyle, modalDialogShellStyle, useModalBodyLock } from './modalUtils';

export interface ProfileModalProps {
  user: User | null;
  onClose: () => void;
  onNameSaved: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ user, onClose, onNameSaved }) => {
  useModalBodyLock(true);

  return ReactDOM.createPortal(
    <dialog
      open
      aria-label="Profile"
      onCancel={e => {
        e.preventDefault();
        onClose();
      }}
      style={{
        ...modalDialogShellStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <button
        type="button"
        aria-label="Close profile"
        onClick={onClose}
        style={{
          ...modalBackdropStyle,
          position: 'absolute',
          backgroundColor: 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: 'min(760px, 94vw)',
          maxHeight: '88vh',
          background: 'var(--v-surface)',
          borderRadius: 12,
          boxShadow: 'var(--v-card-shadow)',
          border: '1px solid var(--v-card-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 10,
            width: 30, height: 30, borderRadius: 6,
            background: 'transparent',
            border: '1.5px solid var(--v-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 13, color: 'var(--v-text-muted)',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--v-chrome-hover)';
            e.currentTarget.style.color = 'var(--v-text)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--v-text-muted)';
          }}
          title="Close"
        >
          ✕
        </button>
        <div style={{ overflowY: 'auto', flex: 1, background: 'var(--v-page-bg)' }}>
          <ProfileView
            user={user}
            userRole="Methodologist"
            onNameSaved={onNameSaved}
          />
        </div>
      </div>
    </dialog>,
    document.body,
  );
};
