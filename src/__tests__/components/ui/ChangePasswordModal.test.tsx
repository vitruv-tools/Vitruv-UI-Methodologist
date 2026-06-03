import { validatePassword } from '../../../components/ui/ChangePasswordModal';

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
