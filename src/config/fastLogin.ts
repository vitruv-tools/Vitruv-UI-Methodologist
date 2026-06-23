import { config } from './environment';

const REALM = 'methodologist';
const CLIENT_ID = 'normal-customer-mobile-app';

export const FAST_LOGIN_IDP = {
  KIT: 'kit',
  FELS: 'fels',
} as const;

export type FastLoginIdp = (typeof FAST_LOGIN_IDP)[keyof typeof FAST_LOGIN_IDP];
export const FAST_LOGIN_REDIRECT_STORAGE_KEY = 'fast_login_redirect_uri';

/** Frontend route that receives the OAuth authorization code from Keycloak. */
export const FAST_LOGIN_CALLBACK_PATH = '/login/callback';

/**
 * Keycloak / OIDC base URL (no trailing slash).
 * Defaults to REACT_APP_API_BASE_URL when KEYCLOAK base is not set separately.
 */
export function getKeycloakBaseUrl(): string {
  const base =
    process.env.REACT_APP_KEYCLOAK_BASE_URL || config.apiBaseUrl;
  return base.replace(/\/$/, '');
}

/**
 * OAuth redirect URI registered with Keycloak for the fast-login client.
 * Must match exactly what is configured in Keycloak and used in the auth request.
 */
export function getFastLoginRedirectUri(): string {
  const configured = process.env.REACT_APP_FAST_LOGIN_REDIRECT_URL?.trim();
  if (configured) {
    return configured;
  }
  if (globalThis.location !== undefined) {
    return `${globalThis.location.origin}${FAST_LOGIN_CALLBACK_PATH}`;
  }
  return `http://localhost:3000${FAST_LOGIN_CALLBACK_PATH}`;
}

export function saveFastLoginRedirectUri(redirectUri: string): void {
  try {
    sessionStorage.setItem(FAST_LOGIN_REDIRECT_STORAGE_KEY, redirectUri);
  } catch (error) {
    console.warn('[Fast Login] Unable to persist redirect_uri in sessionStorage', error);
  }
}

export function getSavedFastLoginRedirectUri(): string | null {
  try {
    return sessionStorage.getItem(FAST_LOGIN_REDIRECT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getFastLoginAuthorizationUrl(
  idpHint: FastLoginIdp = FAST_LOGIN_IDP.KIT,
): string {
  const baseUrl = getKeycloakBaseUrl();
  const redirectUri = getFastLoginRedirectUri();
  saveFastLoginRedirectUri(redirectUri);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: 'openid',
    redirect_uri: redirectUri,
    kc_idp_hint: idpHint,
  });

  const url = `${baseUrl}/auth/realms/${REALM}/protocol/openid-connect/auth?${params.toString()}`;

  console.log('[Fast Login] Authorization URL built', {
    redirectUri,
    realm: REALM,
    clientId: CLIENT_ID,
    idpHint,
  });
  return url;
}

/**
 * Token endpoint — same /auth/ context path prefix as the auth endpoint.
 */
export function getFastLoginTokenUrl(): string {
  return `${getKeycloakBaseUrl()}/auth/realms/${REALM}/protocol/openid-connect/token`;
}

export const fastLoginConstants = {
  realm: REALM,
  clientId: CLIENT_ID,
  idpHints: FAST_LOGIN_IDP,
} as const;
