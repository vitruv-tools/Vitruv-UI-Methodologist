/**
 * JWT Token Parser Utility
 * Parses JWT access tokens to extract user information
 */

export interface ParsedTokenData {
  scope: string;
  email_verified: boolean;
  name: string;
  preferred_username: string;
  given_name: string;
  family_name: string;
  email: string;
  // Additional fields that might be present in the token
  [key: string]: any;
}

/**
 * Parses a JWT token and extracts the payload data
 * @param token - The JWT access token
 * @returns Parsed token data or null if parsing fails
 */
export function parseJwtToken(token: string): ParsedTokenData | null {
  try {
    // JWT tokens have three parts separated by dots: header.payload.signature
    const parts = token.split('.');
    
    if (parts.length !== 3) {
      console.error('Invalid JWT token format');
      return null;
    }

    // Decode the payload (second part)
    const payload = parts[1];
    
    // Add padding if needed for base64 decoding
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    
    // Decode base64url to base64, then decode
    const base64Payload = paddedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = atob(base64Payload);
    
    // Parse the JSON payload
    const parsedData = JSON.parse(decodedPayload);
    
    return parsedData as ParsedTokenData;
  } catch (error) {
    console.error('Failed to parse JWT token:', error);
    return null;
  }
}

/**
 * Extracts user information from parsed token data
 * @param tokenData - Parsed JWT token data
 * @returns User information object
 */
export function extractUserFromToken(tokenData: ParsedTokenData) {
  return {
    name: tokenData.name || `${tokenData.given_name || ''} ${tokenData.family_name || ''}`.trim(),
    email: tokenData.email,
    username: tokenData.preferred_username,
    givenName: tokenData.given_name,
    familyName: tokenData.family_name,
    emailVerified: tokenData.email_verified,
    scope: tokenData.scope
  };
}
