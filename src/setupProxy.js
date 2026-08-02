const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('node:path');

// Read .env.local directly because REACT_APP_* vars may not be in
// process.env at the time setupProxy.js is first executed by CRA.
function loadEnvVar(name) {
  if (process.env[name]) return process.env[name];
  const fs = require('node:fs');
  const envFile = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envFile)) return undefined;
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eq = trimmed.indexOf('=');
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key === name) return val;
  }
  return undefined;
}

/**
 * Proxies Keycloak token requests in local dev to avoid browser CORS blocks
 * when exchanging the authorization code from fast login.
 */
module.exports = function setupProxy(app) {
  const keycloakBase = (
    loadEnvVar('REACT_APP_KEYCLOAK_BASE_URL') ||
    loadEnvVar('REACT_APP_API_BASE_URL') ||
    ''
  ).replace(/\/$/, '');

  if (!keycloakBase) {
    console.warn('[setupProxy] REACT_APP_API_BASE_URL not found — Keycloak proxy disabled');
    return;
  }

  const proxyOptions = {
    target: keycloakBase,
    changeOrigin: true,
    secure: true,
  };

  app.use('/realms', createProxyMiddleware(proxyOptions));
  app.use('/auth/realms', createProxyMiddleware(proxyOptions));

  console.log('[setupProxy] Keycloak proxy registered:', keycloakBase);
};
