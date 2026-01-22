import React, { useEffect } from 'react';

/**
 * KeycloakRedirect component handles redirecting administrators to Keycloak
 * for authentication. This is separate from the standard user login flow.
 */
export function KeycloakRedirect() {
  useEffect(() => {
    // TODO: Implement Keycloak redirect logic
    // This will redirect admins to the Keycloak authentication server
    // Example implementation:
    // const keycloakUrl = process.env.REACT_APP_KEYCLOAK_URL;
    // const clientId = process.env.REACT_APP_KEYCLOAK_CLIENT_ID;
    // const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
    // window.location.href = `${keycloakUrl}/auth/realms/master/protocol/openid-connect/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
  }, []);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '18px',
      color: '#666',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div>Redirecting to Keycloak authentication...</div>
      <div style={{ fontSize: '14px', color: '#999' }}>
        If you are not redirected automatically, please contact your administrator.
      </div>
    </div>
  );
}
