# Authentication Routing Migration Guide

## Overview

The authentication routing has been refactored to separate concerns between user login and admin authentication flows.

## Changes Made

### Route Separation

Previously, `/auth` was used for the internal login page. This has been split into two distinct routes:

| Route | Purpose | Component |
|-------|---------|-----------|
| `/login` | Internal application login page (sign-in/sign-up) | `AuthPage` |
| `/auth` | Keycloak redirect for admin authentication | `KeycloakRedirect` |

### Benefits

1. **Clear Separation of Concerns**: User login and admin authentication are now distinct
2. **Semantic URLs**: Routes clearly indicate their purpose
3. **Easier Maintenance**: Changes to one auth flow don't affect the other
4. **Future-Proof**: Ready for Keycloak integration without breaking existing functionality

## Files Modified

1. **`src/App.tsx`**
   - Updated `ProtectedRoute` to redirect to `/login` instead of `/auth`
   - Changed route path from `/auth` to `/login` for `AuthPage`
   - Added new `/auth` route for `KeycloakRedirect` component

2. **`src/components/auth/KeycloakRedirect.tsx`** (new file)
   - Created component for handling Keycloak admin authentication
   - Includes placeholder for actual Keycloak redirect logic
   - Shows loading state while redirecting

3. **`src/components/auth/index.ts`**
   - Added export for `KeycloakRedirect` component

4. **`src/components/index.ts`**
   - Added export for `KeycloakRedirect` component

5. **`AUTHENTICATION.md`**
   - Updated documentation to reflect new routing structure
   - Added section explaining authentication routes

## Migration Notes

### For Developers

No action is required for existing code. The routing changes are internal and don't affect:
- Authentication hooks (`useAuth`)
- API service methods
- Token management
- Component logic

### For Users

- Users will automatically be redirected to `/login` when not authenticated
- The login page URL has changed from `/auth` to `/login`
- Bookmarks or direct links to `/auth` will now show the Keycloak redirect page

### For Admins

The `/auth` route is now reserved for Keycloak-based admin authentication. To implement:

1. Configure environment variables for Keycloak:
   ```env
   REACT_APP_KEYCLOAK_URL=https://your-keycloak-server.com
   REACT_APP_KEYCLOAK_CLIENT_ID=your-client-id
   REACT_APP_KEYCLOAK_REALM=your-realm
   ```

2. Update `KeycloakRedirect.tsx` with actual redirect logic (see TODO comments in the component)

3. Implement callback handler for Keycloak responses if needed

## Testing

To verify the changes:

1. **User Login Flow**:
   - Navigate to `/login`
   - Verify sign-in/sign-up forms are displayed
   - Test authentication flow

2. **Protected Routes**:
   - Access any protected route while logged out
   - Verify redirect to `/login` occurs
   - Verify redirect back to original route after login

3. **Keycloak Redirect**:
   - Navigate to `/auth`
   - Verify Keycloak redirect page is displayed
   - (After implementation) Verify redirect to Keycloak occurs

## Rollback

If rollback is needed, revert the following:

1. Change `/login` route back to `/auth` in `App.tsx`
2. Update `ProtectedRoute` redirect from `/login` to `/auth`
3. Remove the new `/auth` route for `KeycloakRedirect`
4. Remove `KeycloakRedirect.tsx` and its exports

## Future Enhancements

1. Implement full Keycloak integration in `KeycloakRedirect` component
2. Add callback route (e.g., `/auth/callback`) for Keycloak responses
3. Add role-based routing to automatically direct users vs. admins
4. Add SSO support for additional identity providers
