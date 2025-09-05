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
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  name?: string;
}

export class AuthService {
  private static readonly API_BASE_URL = 'https://api-stage.cyruswallet.io';
  private static readonly LOCAL_API_BASE_URL = 'http://localhost:9811';
  private static readonly CLIENT_ID = 'exit-normal-customer-mobile-app';
  private static readonly GRANT_TYPE = 'password';

  static async signUp(credentials: SignUpCredentials): Promise<SignUpResponse> {
    const response = await fetch(`${this.LOCAL_API_BASE_URL}/api/v1/users/sign-up`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: SignUpResponse = await response.json();
    return data;
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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
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
    
    if (!refreshToken) {
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
      
      const accessExpiresAt = Date.now() + (data.expires_in * 1000);
      const refreshExpiresAt = Date.now() + (data.refresh_expires_in * 1000);
      localStorage.setItem('auth.access_expires_at', accessExpiresAt.toString());
      localStorage.setItem('auth.refresh_expires_at', refreshExpiresAt.toString());

      return data;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      this.signOut();
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
  }

  static isAuthenticated(): boolean {
    const accessToken = localStorage.getItem('auth.access_token');
    const accessExpiresAt = localStorage.getItem('auth.access_expires_at');
    
    if (!accessToken || !accessExpiresAt) {
      return false;
    }

    const now = Date.now();
    const expirationTime = parseInt(accessExpiresAt, 10);
    
    if (now >= expirationTime) {
      this.refreshToken().catch(() => {
        this.signOut();
      });
      return false;
    }

    return true;
  }

  static async ensureValidToken(): Promise<string | null> {
    const accessToken = localStorage.getItem('auth.access_token');
    const accessExpiresAt = localStorage.getItem('auth.access_expires_at');
    
    if (!accessToken || !accessExpiresAt) {
      return null;
    }

    const now = Date.now();
    const expirationTime = parseInt(accessExpiresAt, 10);
    
    if (now >= expirationTime) {
      try {
        const refreshResult = await this.refreshToken();
        if (refreshResult) {
          return refreshResult.access_token;
        }
      } catch (error) {
        console.error('Failed to refresh token:', error);
        this.signOut();
        return null;
      }
      return null;
    }

    return accessToken;
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
