import { useCallback, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import { validatePassword } from '../components/ui/ChangePasswordModal';
import { extractApiErrorMessage } from '../utils/apiErrorMessage';

export function useChangePassword() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const validation = useMemo(() => validatePassword(newPassword), [newPassword]);
  const isConfirmValid = useMemo(
    () => !!confirmPassword && confirmPassword === newPassword,
    [confirmPassword, newPassword],
  );
  const isCurrentPasswordValid = useMemo(() => currentPassword.trim().length > 0, [currentPassword]);
  const canSubmit = useMemo(
    () => !isChanging && isCurrentPasswordValid && validation.isPasswordValid && isConfirmValid,
    [isChanging, isCurrentPasswordValid, validation.isPasswordValid, isConfirmValid],
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setError('');
    setSuccess('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, []);

  const open = useCallback(() => {
    setError('');
    setSuccess('');
    setIsOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    setError('');
    setSuccess('');

    if (!isCurrentPasswordValid) {
      setError('Current password is required');
      return;
    }

    if (!validation.isPasswordValid) {
      setError('The password does not meet all security requirements.');
      return;
    }

    if (!isConfirmValid) {
      setError('Passwords do not match');
      return;
    }

    setIsChanging(true);
    try {
      const response = await apiService.changePassword(currentPassword, newPassword);
      setSuccess(response?.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => close(), 2000);
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Failed to change password'));
    } finally {
      setIsChanging(false);
    }
  }, [currentPassword, isCurrentPasswordValid, newPassword, validation.isPasswordValid, isConfirmValid, close]);

  return {
    isOpen,
    open,
    close,
    currentPassword,
    newPassword,
    confirmPassword,
    setCurrentPassword: (value: string) => {
      setCurrentPassword(value);
      setError('');
    },
    setNewPassword: (value: string) => {
      setNewPassword(value);
      setError('');
    },
    setConfirmPassword: (value: string) => {
      setConfirmPassword(value);
      setError('');
    },
    validation,
    isConfirmValid,
    isChanging,
    error,
    success,
    canSubmit,
    handleSubmit,
  };
}
