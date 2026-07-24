import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangePasswordModal, validatePassword } from '../../../components/ui/ChangePasswordModal';

describe('validatePassword', () => {
  it('accepts a password that meets all rules', () => {
    const result = validatePassword('Secure1!');
    expect(result.isPasswordValid).toBe(true);
    expect(result.hasMinLength).toBe(true);
    expect(result.hasUppercase).toBe(true);
    expect(result.hasLowercase).toBe(true);
    expect(result.hasNumber).toBe(true);
    expect(result.hasSymbol).toBe(true);
  });

  it('rejects passwords missing requirements', () => {
    expect(validatePassword('short').isPasswordValid).toBe(false);
    expect(validatePassword('alllowercase1!').hasUppercase).toBe(false);
    expect(validatePassword('ALLUPPERCASE1!').hasLowercase).toBe(false);
    expect(validatePassword('NoNumbers!').hasNumber).toBe(false);
    expect(validatePassword('NoSymbols1a').hasSymbol).toBe(false);
  });
});

describe('ChangePasswordModal', () => {
  it('toggles password field visibility independently', async () => {
    render(
      <ChangePasswordModal
        isOpen
        onClose={jest.fn()}
        newPassword="Secure1!"
        confirmPassword="Secure1!"
        onNewPasswordChange={jest.fn()}
        onConfirmPasswordChange={jest.fn()}
        validation={validatePassword('Secure1!')}
        isConfirmValid
        isChanging={false}
        error=""
        success=""
        onSubmit={jest.fn()}
        canSubmit
      />,
    );

    const newPasswordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const showPasswordButtons = screen.getAllByRole('button', { name: 'Show password' });

    expect(newPasswordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');

    await userEvent.click(showPasswordButtons[0]);

    expect(newPasswordInput).toHaveAttribute('type', 'text');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });
});
