import { parseJwtToken, extractUserFromToken, ParsedTokenData } from '../../utils/jwtParser';
global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');

// Helper to create a valid base64url-encoded JWT token
const createJwtToken = (payload: object): string => {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const encodedPayload = btoa(JSON.stringify(payload))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `${header}.${encodedPayload}.signature`;
};

const samplePayload: ParsedTokenData = {
  scope: 'openid profile email',
  email_verified: true,
  name: 'Max Mustermann',
  preferred_username: 'max.mustermann',
  given_name: 'Max',
  family_name: 'Mustermann',
  email: 'max@example.com',
};

describe('parseJwtToken', () => {

  describe('valid tokens', () => {
    it('should parse a valid JWT token and return payload data', () => {
      const token = createJwtToken(samplePayload);
      const result = parseJwtToken(token);
      expect(result).not.toBeNull();
      expect(result?.email).toBe('max@example.com');
      expect(result?.name).toBe('Max Mustermann');
    });

    it('should return all fields from the payload', () => {
      const token = createJwtToken(samplePayload);
      const result = parseJwtToken(token);
      expect(result?.scope).toBe('openid profile email');
      expect(result?.email_verified).toBe(true);
      expect(result?.preferred_username).toBe('max.mustermann');
      expect(result?.given_name).toBe('Max');
      expect(result?.family_name).toBe('Mustermann');
    });

    it('should handle additional custom fields in the payload', () => {
      const payloadWithExtras = { ...samplePayload, custom_role: 'admin', tenant_id: '123' };
      const token = createJwtToken(payloadWithExtras);
      const result = parseJwtToken(token);
      expect(result?.custom_role).toBe('admin');
      expect(result?.tenant_id).toBe('123');
    });

    it('should handle base64url characters (- and _) correctly', () => {
      // Payload that produces base64 with + and / (which become - and _ in base64url)
      const payload = { data: 'some data that might produce special chars >>>' };
      const token = createJwtToken(payload);
      const result = parseJwtToken(token);
      expect(result).not.toBeNull();
    });
  });

  describe('invalid tokens', () => {
    it('should return null for a token with wrong number of parts', () => {
      const result = parseJwtToken('only.two');
      expect(result).toBeNull();
    });

    it('should return null for a token with too many parts', () => {
      const result = parseJwtToken('a.b.c.d');
      expect(result).toBeNull();
    });

    it('should return null for an empty string', () => {
      const result = parseJwtToken('');
      expect(result).toBeNull();
    });

    it('should return null for a token with invalid base64 payload', () => {
      const result = parseJwtToken('header.!!!invalid!!!.signature');
      expect(result).toBeNull();
    });

    it('should return null for a token with non-JSON payload', () => {
      const invalidPayload = btoa('not json at all');
      const result = parseJwtToken(`header.${invalidPayload}.signature`);
      expect(result).toBeNull();
    });
  });

});

describe('extractUserFromToken', () => {

  it('should extract all user fields correctly', () => {
    const user = extractUserFromToken(samplePayload);
    expect(user.name).toBe('Max Mustermann');
    expect(user.email).toBe('max@example.com');
    expect(user.username).toBe('max.mustermann');
    expect(user.givenName).toBe('Max');
    expect(user.familyName).toBe('Mustermann');
    expect(user.emailVerified).toBe(true);
    expect(user.scope).toBe('openid profile email');
  });

  it('should use name field when present', () => {
    const user = extractUserFromToken({ ...samplePayload, name: 'Full Name' });
    expect(user.name).toBe('Full Name');
  });

  it('should fall back to given_name + family_name when name is missing', () => {
    const payloadWithoutName = { ...samplePayload, name: '' };
    const user = extractUserFromToken(payloadWithoutName);
    expect(user.name).toBe('Max Mustermann');
  });

  it('should handle missing given_name gracefully', () => {
    const payload = { ...samplePayload, name: '', given_name: '' };
    const user = extractUserFromToken(payload);
    expect(user.name).toBe('Mustermann');
  });

  it('should handle missing family_name gracefully', () => {
    const payload = { ...samplePayload, name: '', family_name: '' };
    const user = extractUserFromToken(payload);
    expect(user.name).toBe('Max');
  });

  it('should return empty string for name when all name fields are missing', () => {
    const payload = { ...samplePayload, name: '', given_name: '', family_name: '' };
    const user = extractUserFromToken(payload);
    expect(user.name).toBe('');
  });

  it('should return false for emailVerified when not verified', () => {
    const payload = { ...samplePayload, email_verified: false };
    const user = extractUserFromToken(payload);
    expect(user.emailVerified).toBe(false);
  });

});