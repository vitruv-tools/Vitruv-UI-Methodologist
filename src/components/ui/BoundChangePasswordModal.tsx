import React from 'react';
import { ChangePasswordModal } from './ChangePasswordModal';
import { useChangePassword } from '../../hooks/useChangePassword';

type ChangePasswordController = ReturnType<typeof useChangePassword>;

interface BoundChangePasswordModalProps {
  controller: ChangePasswordController;
}

/** Renders ChangePasswordModal from useChangePassword() — avoids duplicating prop wiring. */
export const BoundChangePasswordModal: React.FC<BoundChangePasswordModalProps> = ({ controller: c }) => (
  <ChangePasswordModal
    isOpen={c.isOpen}
    onClose={c.close}
    currentPassword={c.currentPassword}
    newPassword={c.newPassword}
    confirmPassword={c.confirmPassword}
    onCurrentPasswordChange={c.setCurrentPassword}
    onNewPasswordChange={c.setNewPassword}
    onConfirmPasswordChange={c.setConfirmPassword}
    validation={c.validation}
    isConfirmValid={c.isConfirmValid}
    isChanging={c.isChanging}
    error={c.error}
    success={c.success}
    onSubmit={c.handleSubmit}
    canSubmit={c.canSubmit}
  />
);
