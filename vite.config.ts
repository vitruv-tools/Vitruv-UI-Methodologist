/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  // Keep the REACT_APP_ prefix from Create React App so .env files and deployment
  // settings stay unchanged. Values come from .env, .env.[mode], .env.local and the shell.
  const env = loadEnv(mode, process.cwd(), 'REACT_APP_');

  // Proxy Keycloak token requests in local dev to avoid browser CORS blocks
  // when exchanging the authorization code from fast login.
  const keycloakBase = (env.REACT_APP_KEYCLOAK_BASE_URL || env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');
  const keycloakProxy = { target: keycloakBase, changeOrigin: true, secure: true };

  return {
    plugins: [react()],
    // The source reads process.env.REACT_APP_* (CRA style). Inline those values at build
    // time; tests skip this so they can still change process.env at runtime.
    define:
      mode === 'test'
        ? {}
        : {
            'process.env': JSON.stringify({
              ...env,
              NODE_ENV: mode === 'development' ? 'development' : 'production',
              PUBLIC_URL: '',
            }),
          },
    server: {
      port: 3000,
      proxy: keycloakBase
        ? { '/realms': keycloakProxy, '/auth/realms': keycloakProxy }
        : undefined,
    },
    preview: {
      port: 3000,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/setupTests.ts'],
      include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
      // Matches CRA's Jest default (resetMocks: true).
      mockReset: true,
      alias: [
        { find: /^.*monaco-editor.*$/, replacement: path.resolve(import.meta.dirname, 'src/__mocks__/monaco-editor.ts') },
      ],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        reportsDirectory: 'coverage',
        include: ['src/**/*.{js,jsx,ts,tsx}'],
      },
    },
  };
});
