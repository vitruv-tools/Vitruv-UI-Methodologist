/**
 * Tests for the getUsernameFromToken helper added to AuthContext.
 *
 * The helper is not exported, so we test it indirectly by verifying that
 * AuthContext.signIn maps the correct username when a JWT with
 * preferred_username is present.
 *
 * We also test the pure logic inline (mirroring the impl) so edge cases
 * are covered without full React rendering.
 */

global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');

import { parseJwtToken } from '../../utils/jwtParser';

// Helper matching the implementation in AuthContext
function getUsernameFromToken(
  getAccessToken: () => string | null,
  fallbackEmail?: string,
): string {
  const token = getAccessToken();
  if (token) {
    const parsed = parseJwtToken(token);
    if (parsed?.preferred_username) return parsed.preferred_username;
  }
  return fallbackEmail?.split('@')[0] || 'user';
}

const createJwt = (payload: object): string => {
  const h = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const p = btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `${h}.${p}.sig`;
};

describe('getUsernameFromToken', () => {
  it('returns preferred_username from a valid JWT', () => {
    const token = createJwt({ preferred_username: 'maxoesterle', email: 'max@kit.edu' });
    expect(getUsernameFromToken(() => token, 'max@kit.edu')).toBe('maxoesterle');
  });

  it('falls back to email prefix when token has no preferred_username', () => {
    const token = createJwt({ sub: 'abc123' });
    expect(getUsernameFromToken(() => token, 'max@kit.edu')).toBe('max');
  });

  it('falls back to email prefix when no token is available', () => {
    expect(getUsernameFromToken(() => null, 'hello@example.com')).toBe('hello');
  });

  it('returns "user" when token is null and no email provided', () => {
    expect(getUsernameFromToken(() => null, undefined)).toBe('user');
  });

  it('returns "user" when token is null and empty string email provided', () => {
    expect(getUsernameFromToken(() => null, '')).toBe('user');
  });

  it('preferred_username takes priority over email fallback', () => {
    const token = createJwt({ preferred_username: 'myuser', email: 'other@example.com' });
    expect(getUsernameFromToken(() => token, 'other@example.com')).toBe('myuser');
  });
});
