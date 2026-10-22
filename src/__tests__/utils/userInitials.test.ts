import { getUserInitials } from '../../utils/userInitials';

describe('getUserInitials', () => {
  it('uses first and last name parts', () => {
    expect(getUserInitials('Ada Lovelace')).toBe('AL');
  });

  it('falls back to email local part', () => {
    expect(getUserInitials(undefined, 'ada@example.com')).toBe('AA');
  });

  it('returns U when no inputs', () => {
    expect(getUserInitials()).toBe('U');
  });
});
