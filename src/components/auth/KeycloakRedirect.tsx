import React, { useEffect } from 'react';

/**
 * KeycloakRedirect component handles redirecting administrators to Keycloak
 * for authentication. This is separate from the standard user login flow.
 */
export function KeycloakRedirect() {
  useEffect(() => {
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
