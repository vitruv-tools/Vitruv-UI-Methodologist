import {
  getFastLoginRedirectUri,
  getFastLoginAuthorizationUrl,
  getFastLoginTokenUrl,
  getSavedFastLoginRedirectUri,
  saveFastLoginRedirectUri,
  FAST_LOGIN_REDIRECT_STORAGE_KEY,
  FAST_LOGIN_CALLBACK_PATH,
} from '../../config/fastLogin';

describe('fastLogin config', () => {
  beforeEach(() => {
    sessionStorage.clear();
    delete (process.env as any).REACT_APP_FAST_LOGIN_REDIRECT_URL;
    delete (process.env as any).REACT_APP_KEYCLOAK_BASE_URL;
  });

  // ── getFastLoginRedirectUri ──────────────────────────────────────────────

  it('returns REACT_APP_FAST_LOGIN_REDIRECT_URL when set', () => {
    process.env.REACT_APP_FAST_LOGIN_REDIRECT_URL = 'https://example.com/callback';
    expect(getFastLoginRedirectUri()).toBe('https://example.com/callback');
  });

  it('returns origin + callback path when env var is not set', () => {
    expect(getFastLoginRedirectUri()).toBe(
      `${globalThis.location.origin}${FAST_LOGIN_CALLBACK_PATH}`,
    );
  });

  // ── saveFastLoginRedirectUri / getSavedFastLoginRedirectUri ──────────────

  it('saves and retrieves redirect URI from sessionStorage', () => {
    saveFastLoginRedirectUri('http://localhost:3000/auth/callback');
    expect(getSavedFastLoginRedirectUri()).toBe('http://localhost:3000/auth/callback');
  });

  it('returns null when nothing is saved', () => {
    expect(getSavedFastLoginRedirectUri()).toBeNull();
  });

  it('saveFastLoginRedirectUri uses the correct sessionStorage key', () => {
    saveFastLoginRedirectUri('http://test.com/cb');
    expect(sessionStorage.getItem(FAST_LOGIN_REDIRECT_STORAGE_KEY)).toBe('http://test.com/cb');
  });

  // ── getFastLoginAuthorizationUrl ─────────────────────────────────────────

  it('builds authorization URL with required OIDC params', () => {
    const url = new URL(getFastLoginAuthorizationUrl());
    expect(url.pathname).toContain('/auth/realms/methodologist/protocol/openid-connect/auth');
    expect(url.searchParams.get('client_id')).toBe('normal-customer-mobile-app');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid');
    expect(url.searchParams.get('kc_idp_hint')).toBe('kit');
    expect(url.searchParams.get('redirect_uri')).toBeTruthy();
  });

  it('saves redirect_uri to sessionStorage when building authorization URL', () => {
    getFastLoginAuthorizationUrl();
    expect(sessionStorage.getItem(FAST_LOGIN_REDIRECT_STORAGE_KEY)).toBeTruthy();
  });

  // ── getFastLoginTokenUrl ─────────────────────────────────────────────────

  it('returns token URL containing the correct realm and /auth/ prefix', () => {
    const url = getFastLoginTokenUrl();
    expect(url).toContain('/auth/realms/methodologist/protocol/openid-connect/token');
  });

  it('token URL uses REACT_APP_KEYCLOAK_BASE_URL when set', () => {
    process.env.REACT_APP_KEYCLOAK_BASE_URL = 'https://keycloak.example.com';
    const url = getFastLoginTokenUrl();
    expect(url).toMatch(/^https:\/\/keycloak\.example\.com/);
  });
});
