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
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.07)',
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
            border: '1.5px solid rgba(0,0,0,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 13, color: '#64748b',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#f1f5f9';
            e.currentTarget.style.borderColor = 'rgba(0,0,0,0.18)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(0,0,0,0.10)';
          }}
          title="Close"
        >
          ✕
        </button>
        <div style={{ overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
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
