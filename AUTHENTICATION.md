# Authentication System Documentation

This document describes the authentication system implemented in the Vitruv UI Methodologist application.

## Overview

The authentication system provides:
- User sign-up and sign-in functionality
- Automatic token refresh
- Secure API requests with authentication
- Token management and storage

## API Endpoints

### Sign Up
- **URL**: `POST http://localhost:9811/api/v1/users/sign-up`
- **Request Body**:
  ```json
  {
    "email": "string",
    "roleType": "user",
    "username": "string",
    "firstName": "string",
    "lastName": "string",
    "password": "string"
  }
  ```
- **Response**:
  ```json
  {
    "data": {},
    "message": "string"
  }
  ```

### Sign In
- **URL**: `POST http://localhost:9811/api/v1/users/login`
- **Request Body**:
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Response**:
  ```json
  {
    "access_token": "string",
    "refresh_token": "string",
    "expires_in": 0,
    "refresh_expires_in": 0,
    "token_type": "string",
    "session_state": "string",
    "scope": "string",
    "not-before-policy": 0
  }
  ```

### Token Refresh
- **URL**: `POST http://localhost:9811/api/v1/users/access-token/by-refresh-token`
- **Request Body**:
  ```json
  {
    "refreshToken": "string"
  }
  ```
- **Response**: Same as sign-in response

## Usage

### Basic Authentication

```typescript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { signIn, signUp, signOut, user, isAuthenticated } = useAuth();

  const handleSignIn = async () => {
    try {
      await signIn('username', 'password');
      console.log('Signed in successfully');
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  };

  const handleSignUp = async () => {
    try {
      await signUp({
        username: 'newuser',
        email: 'user@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        roleType: 'user'
      });
      console.log('Signed up successfully');
    } catch (error) {
      console.error('Sign up failed:', error);
    }
  };

  return (
    <div>
      {isAuthenticated ? (
        <div>
          <p>Welcome, {user?.username}!</p>
          <button onClick={signOut}>Sign Out</button>
        </div>
      ) : (
        <div>
          <button onClick={handleSignIn}>Sign In</button>
          <button onClick={handleSignUp}>Sign Up</button>
        </div>
      )}
    </div>
  );
}
```

### Making Authenticated API Requests

```typescript
import { apiService, userApi, projectApi } from '../services/api';

// Using the authenticated service directly
const getData = async () => {
  try {
    const response = await apiService.authenticatedRequest('/api/v1/some-endpoint');
    console.log(response);
  } catch (error) {
    console.error('API request failed:', error);
  }
};

// Using predefined API methods
const getUserProfile = async () => {
  try {
    const profile = await userApi.getProfile();
    console.log(profile);
  } catch (error) {
    console.error('Failed to get profile:', error);
  }
};

const createNewProject = async () => {
  try {
    const project = await projectApi.createProject({
      name: 'My Project',
      description: 'A new project'
    });
    console.log('Project created:', project);
  } catch (error) {
    console.error('Failed to create project:', error);
  }
};
```

### Token Refresh

The system automatically handles token refresh, but you can also manually refresh tokens:

```typescript
import { useAuth } from '../contexts/AuthContext';

function TokenRefreshExample() {
  const { refreshToken } = useAuth();

  const handleManualRefresh = async () => {
    try {
      const result = await refreshToken();
      console.log('Token refreshed:', result);
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  };

  return (
    <button onClick={handleManualRefresh}>
      Refresh Token
    </button>
  );
}
```

### Using the Token Refresh Hook

```typescript
import { useTokenRefresh } from '../hooks/useTokenRefresh';

function TokenManagement() {
  const { refreshToken, getValidToken } = useTokenRefresh();

  const handleGetValidToken = async () => {
    try {
      const token = await getValidToken();
      if (token) {
        console.log('Valid token:', token);
      } else {
        console.log('No valid token available');
      }
    } catch (error) {
      console.error('Failed to get valid token:', error);
    }
  };

  return (
    <div>
      <button onClick={handleGetValidToken}>Get Valid Token</button>
    </div>
  );
}
```

## Automatic Features

### Token Expiration Handling
- The system automatically detects when access tokens expire
- Automatically attempts to refresh tokens before they expire
- If refresh fails, the user is automatically signed out

### Automatic Token Refresh
- Tokens are checked every minute
- Refresh is attempted 5 minutes before expiration
- Failed refreshes trigger automatic sign-out

### Secure API Requests
- All authenticated requests automatically include the current token
- Failed requests due to invalid tokens automatically retry after refresh
- Seamless token refresh without user intervention

## Configuration

### Backend URL
The backend URL is configured in `src/services/auth.ts`:
```typescript
private static readonly LOCAL_API_BASE_URL = 'http://localhost:9811';
```

### Token Storage
Tokens are stored in localStorage with the following keys:
- `auth.access_token` - Current access token
- `auth.refresh_token` - Current refresh token
- `auth.expires_in` - Access token expiration time
- `auth.refresh_expires_in` - Refresh token expiration time
- `auth.token_type` - Token type (usually "Bearer")
- `auth.session_state` - Session state
- `auth.scope` - Token scope
- `auth.not_before_policy` - Not before policy timestamp

## Error Handling

The system provides comprehensive error handling:
- Network errors are caught and displayed to users
- Authentication failures trigger appropriate error messages
- Token refresh failures result in automatic sign-out
- API errors include detailed error messages from the backend

## Security Features

- Tokens are automatically refreshed before expiration
- Failed authentication attempts are handled gracefully
- Secure token storage in localStorage
- Automatic cleanup of expired tokens
- Protection against token reuse attacks

## Testing

To test the authentication system:

1. Ensure your backend server is running on `localhost:9811`
2. Use the sign-up form to create a new account
3. Use the sign-in form to authenticate
4. Check the browser's developer tools to see stored tokens
5. Test API calls that require authentication
6. Wait for token expiration to test automatic refresh

## Troubleshooting

### Common Issues

1. **Backend Connection Failed**
   - Ensure your backend server is running on port 9811
   - Check that the API endpoints are accessible

2. **Token Refresh Fails**
   - Check that refresh tokens are valid
   - Verify the refresh endpoint is working
   - Check browser console for detailed error messages

3. **Authentication State Lost**
   - Check localStorage for stored tokens
   - Verify token expiration times
   - Check for JavaScript errors in the console

### Debug Mode

Enable debug logging by checking the browser console. The system logs:
- Authentication attempts
- Token refresh operations
- API request details
- Error information

## Migration from Legacy System

If you're migrating from the old authentication system:

1. Update your components to use the new `useAuth` hook
2. Replace direct API calls with the new `apiService`
3. Update any hardcoded authentication logic
4. Test the new token refresh functionality

The legacy authentication methods are still available in `AuthService.signInLegacy()` for backward compatibility.
