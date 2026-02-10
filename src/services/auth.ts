import { config } from '../config/environment';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
  session_state: string;
  scope: string;
  'not-before-policy': number;
}

export interface SignInCredentials {
  username: string;
  password: string;
}

export interface SignUpCredentials {
  email: string;
  roleType: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface SignUpResponse {
  data: any;
  message: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  token_type?: string;
  session_state?: string;
  scope?: string;
  'not-before-policy'?: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  emailVerified?: boolean;
  scope?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  data: any;
  message: string;
}

export class AuthService {
  private static readonly API_BASE_URL = config.apiBaseUrl;
  private static readonly LOCAL_API_BASE_URL = config.apiBaseUrl;
  private static readonly CLIENT_ID = 'exit-normal-customer-mobile-app';
  private static readonly GRANT_TYPE = 'password';

  private static async extractErrorMessage(response: Response): Promise<string> {
    let errorText = '';
    try {
      errorText = await response.text();
    } catch { }
    
    let errorMessage = errorText;
    try {
      const parsed = JSON.parse(errorText);
      errorMessage = parsed?.message || parsed?.error || parsed?.error_description || errorText;
      
      // Log detailed error information for debugging
      console.error('API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        parsed,
        rawText: errorText
      });
    } catch { }
    
    return errorMessage || response.statusText || 'Request failed';
  }

  private static storeAuthTokens(tokenData: any): void {
    if (!tokenData.access_token) {
      console.warn('No authentication tokens found in sign-up response. User may need to sign in separately.');
      return;
    }

    localStorage.setItem('auth.access_token', tokenData.access_token);
    
    if (tokenData.refresh_token) {
      localStorage.setItem('auth.refresh_token', tokenData.refresh_token);
    }
    if (tokenData.expires_in) {
      localStorage.setItem('auth.expires_in', tokenData.expires_in.toString());
      const accessExpiresAt = Date.now() + (tokenData.expires_in * 1000);
      localStorage.setItem('auth.access_expires_at', accessExpiresAt.toString());
    }
    if (tokenData.refresh_expires_in) {
      localStorage.setItem('auth.refresh_expires_in', tokenData.refresh_expires_in.toString());
      const refreshExpiresAt = Date.now() + (tokenData.refresh_expires_in * 1000);
      localStorage.setItem('auth.refresh_expires_at', refreshExpiresAt.toString());
    }
    if (tokenData.token_type) {
      localStorage.setItem('auth.token_type', tokenData.token_type);
    }
    if (tokenData.session_state) {
      localStorage.setItem('auth.session_state', tokenData.session_state);
    }
    if (tokenData.scope) {
      localStorage.setItem('auth.scope', tokenData.scope);
    }
    if (tokenData['not-before-policy'] !== undefined) {
      localStorage.setItem('auth.not_before_policy', tokenData['not-before-policy'].toString());
    }
    
    console.log('Sign-up tokens stored successfully');
  }

  private static hasStoredAuthToken(): boolean {
    return !!localStorage.getItem('auth.access_token');
  }

  private static async autoSignInAfterSignUp(credentials: SignUpCredentials): Promise<void> {
    // Some backends create the user without returning tokens on sign-up.
    // In that case, sign in immediately so OTP endpoints can be called.
    if (this.hasStoredAuthToken()) {
      return;
    }

    try {
      await this.signIn({
        username: credentials.username,
        password: credentials.password,
      });
      return;
    } catch (usernameSignInError) {
      console.warn('Auto sign-in with username failed after sign-up:', usernameSignInError);
    }

    try {
      await this.signIn({
        username: credentials.email,
        password: credentials.password,
      });
    } catch (emailSignInError) {
      console.warn('Auto sign-in with email failed after sign-up:', emailSignInError);
      // Keep sign-up successful but signal to UI that sign-in is required.
      throw new Error('Account created, but sign-in is required before email verification. Please sign in and continue.');
    }
  }

  static async signUp(credentials: SignUpCredentials): Promise<SignUpResponse> {
    console.log('Sign up request payload:', {
      ...credentials,
      password: '[REDACTED]',
      passwordLength: credentials.password.length,
      usernameLength: credentials.username.length,
      emailValid: credentials.email.includes('@')
    });

    try {
      const response = await fetch(`${this.LOCAL_API_BASE_URL}/api/v1/users/sign-up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      console.log('Sign up response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorMessage = await this.extractErrorMessage(response);
        console.error('Sign up failed:', {
          status: response.status,
          statusText: response.statusText,
          errorMessage,
          url: `${this.LOCAL_API_BASE_URL}/api/v1/users/sign-up`,
          requestData: {
            username: credentials.username,
            email: credentials.email,
            roleType: credentials.roleType,
            hasFirstName: !!credentials.firstName,
            hasLastName: !!credentials.lastName
          }
        });
        
        // Provide user-friendly error messages
        const normalizedError = errorMessage.toLowerCase();
        const usernameAlreadyUsed =
          normalizedError.includes('username') &&
          (normalizedError.includes('already') ||
            normalizedError.includes('exists') ||
            normalizedError.includes('used') ||
            normalizedError.includes('taken') ||
            normalizedError.includes('duplicate'));
        const emailAlreadyUsed =
          normalizedError.includes('email') &&
          (normalizedError.includes('already') ||
            normalizedError.includes('exists') ||
            normalizedError.includes('used') ||
            normalizedError.includes('taken') ||
            normalizedError.includes('duplicate'));

        // Some backends return 500 even for duplicates, so check message first.
        if (usernameAlreadyUsed) {
          throw new Error('Username is already used. Please choose another username.');
        }
        if (emailAlreadyUsed) {
          throw new Error('Email is already used. Please use another email or sign in.');
        }

        if (response.status === 409) {
          throw new Error('This username or email is already registered. Please use a different one or sign in instead.');
        } else if (response.status === 500) {
          throw new Error('Server error occurred. Please try again later or contact support if the problem persists.');
        } else if (response.status === 400) {
          throw new Error(errorMessage || 'Invalid registration data. Please check your information and try again.');
        }
        
        throw new Error(errorMessage);
      }

      const responseData: SignUpResponse = await response.json();
      console.log('Sign up successful, storing tokens...');
      const tokenData = responseData.access_token ? responseData : (responseData.data || {});
      this.storeAuthTokens(tokenData);
      await this.autoSignInAfterSignUp(credentials);
      
      return responseData;
    } catch (error: any) {
      // Catch network errors or JSON parsing errors
      console.error('Sign up request failed:', {
        error: error.message,
        errorType: error.name,
        credentials: {
          username: credentials.username,
          email: credentials.email,
          roleType: credentials.roleType
        }
      });
      
      // Re-throw the error if it's already been processed
      if (error.message && error.message !== 'Failed to fetch') {
        throw error;
      }
      
      // Network error
      throw new Error('Network error: Unable to connect to the server. Please check your connection and try again.');
    }
  }

  static async forgotPassword(request: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    console.log('Forgot password request for email:', request.email);

    const response = await fetch(`${this.LOCAL_API_BASE_URL}/api/v1/users/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    console.log('Forgot password response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorMessage = await this.extractErrorMessage(response);
      console.error('Forgot password failed:', {
        status: response.status,
        statusText: response.statusText,
        errorMessage,
        url: `${this.LOCAL_API_BASE_URL}/api/v1/users/forgot-password`
      });
      throw new Error(errorMessage);
    }

    const responseData: ForgotPasswordResponse = await response.json();
    console.log('Forgot password request successful:', responseData.message);
    
    return responseData;
  }

  static async signIn(credentials: SignInCredentials): Promise<AuthResponse> {
    const response = await fetch(`${this.LOCAL_API_BASE_URL}/api/v1/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch { }
      let errorMessage = errorText;
      try {
        const parsed = JSON.parse(errorText);
        errorMessage = parsed?.message || parsed?.error || errorText;
      } catch { }
      const fallback = response.statusText || 'Request failed';
      throw new Error(errorMessage || fallback);
    }

    const data: AuthResponse = await response.json();

    localStorage.setItem('auth.access_token', data.access_token);
    localStorage.setItem('auth.refresh_token', data.refresh_token);
    localStorage.setItem('auth.expires_in', data.expires_in.toString());
    localStorage.setItem('auth.refresh_expires_in', data.refresh_expires_in.toString());
    localStorage.setItem('auth.token_type', data.token_type);
    localStorage.setItem('auth.session_state', data.session_state);
    localStorage.setItem('auth.scope', data.scope);
    localStorage.setItem('auth.not_before_policy', data['not-before-policy'].toString());

    const accessExpiresAt = Date.now() + (data.expires_in * 1000);
    const refreshExpiresAt = Date.now() + (data.refresh_expires_in * 1000);
    localStorage.setItem('auth.access_expires_at', accessExpiresAt.toString());
    localStorage.setItem('auth.refresh_expires_at', refreshExpiresAt.toString());

    return data;
  }

  static async refreshToken(): Promise<AuthResponse | null> {
    const refreshToken = localStorage.getItem('auth.refresh_token');
    const refreshExpiresAt = localStorage.getItem('auth.refresh_expires_at');

    if (!refreshToken || !refreshExpiresAt) {
      return null;
    }

    const now = Date.now();
    const refreshExpiry = Number.parseInt(refreshExpiresAt, 10);
    if (Number.isFinite(refreshExpiry) && now >= refreshExpiry) {
      await this.signOut();
      return null;
    }

    try {
      const requestBody: RefreshTokenRequest = { refreshToken };

      const response = await fetch(`${this.LOCAL_API_BASE_URL}/api/v1/users/access-token/by-refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: AuthResponse = await response.json();

      localStorage.setItem('auth.access_token', data.access_token);
      localStorage.setItem('auth.refresh_token', data.refresh_token);
      localStorage.setItem('auth.expires_in', data.expires_in.toString());
      localStorage.setItem('auth.refresh_expires_in', data.refresh_expires_in.toString());
      localStorage.setItem('auth.token_type', data.token_type);
      localStorage.setItem('auth.session_state', data.session_state);
      localStorage.setItem('auth.scope', data.scope);
      localStorage.setItem('auth.not_before_policy', data['not-before-policy'].toString());

      const accessExpiresAt = Date.now() + data.expires_in * 1000;
      const newRefreshExpiresAt = Date.now() + data.refresh_expires_in * 1000;
      localStorage.setItem('auth.access_expires_at', accessExpiresAt.toString());
      localStorage.setItem('auth.refresh_expires_at', newRefreshExpiresAt.toString());

      return data;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      await this.signOut();
      return null;
    }
  }

  static async signOut(): Promise<void> {
    localStorage.removeItem('auth.access_token');
    localStorage.removeItem('auth.refresh_token');
    localStorage.removeItem('auth.expires_in');
    localStorage.removeItem('auth.refresh_expires_in');
    localStorage.removeItem('auth.token_type');
    localStorage.removeItem('auth.session_state');
    localStorage.removeItem('auth.scope');
    localStorage.removeItem('auth.not_before_policy');
    localStorage.removeItem('auth.access_expires_at');
    localStorage.removeItem('auth.refresh_expires_at');
    localStorage.removeItem('auth.user');
    try {
      globalThis.dispatchEvent(new Event('auth:signout'));
    } catch { }
  }

  static isAuthenticated(): boolean {
    const now = Date.now();
    const accessToken = localStorage.getItem('auth.access_token');
    const accessExpiresAt = localStorage.getItem('auth.access_expires_at');
    const refreshToken = localStorage.getItem('auth.refresh_token');
    const refreshExpiresAt = localStorage.getItem('auth.refresh_expires_at');

    const accessValid = !!accessToken && !!accessExpiresAt && now < Number.parseInt(accessExpiresAt, 10);
    const refreshValid = !!refreshToken && !!refreshExpiresAt && now < Number.parseInt(refreshExpiresAt, 10);

    return accessValid || refreshValid;
  }

  static async ensureValidToken(): Promise<string | null> {
    const now = Date.now();
    const accessToken = localStorage.getItem('auth.access_token');
    const accessExpiresAt = localStorage.getItem('auth.access_expires_at');
    const refreshToken = localStorage.getItem('auth.refresh_token');
    const refreshExpiresAt = localStorage.getItem('auth.refresh_expires_at');

    const accessValid = !!accessToken && !!accessExpiresAt && now < Number.parseInt(accessExpiresAt, 10);
    if (accessValid) {
      return accessToken;
    }

    const refreshValid = !!refreshToken && !!refreshExpiresAt && now < Number.parseInt(refreshExpiresAt, 10);
    if (!refreshValid) {
      await this.signOut();
      return null;
    }

    try {
      const refreshResult = await this.refreshToken();
      if (refreshResult?.access_token) {
        return refreshResult.access_token;
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
    }
    await this.signOut();
    return null;
  }

  static getAccessToken(): string | null {
    if (!this.isAuthenticated()) {
      return null;
    }
    return localStorage.getItem('auth.access_token');
  }

  static getCurrentUser(): User | null {
    const userData = localStorage.getItem('auth.user');
    if (!userData) {
      return null;
    }

    try {
      return JSON.parse(userData);
    } catch {
      return null;
    }
  }

  static setCurrentUser(user: User): void {
    localStorage.setItem('auth.user', JSON.stringify(user));
  }

  // Removed unused legacy signIn method
}
