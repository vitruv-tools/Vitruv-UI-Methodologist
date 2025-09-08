import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthService, User, SignUpCredentials } from '../services/auth';
import { useTokenRefresh } from '../hooks/useTokenRefresh';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (userData: SignUpCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { refreshToken } = useTokenRefresh();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (AuthService.isAuthenticated()) {
          const currentUser = AuthService.getCurrentUser();
          if (currentUser) {
            setUser(currentUser);
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        await AuthService.signOut();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      const authResponse = await AuthService.signIn({ username, password });
      console.log('Auth response:', authResponse);
      
      const newUser: User = {
        id: Date.now().toString(),
        username,
        email: username.includes('@') ? username : undefined,
        name: username.split('@')[0],
      };
      
      AuthService.setCurrentUser(newUser);
      setUser(newUser);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signUp = async (userData: SignUpCredentials) => {
    try {
      const signUpResponse = await AuthService.signUp(userData);
      
      const newUser: User = {
        id: Date.now().toString(),
        username: userData.username,
        email: userData.email,
        name: `${userData.firstName} ${userData.lastName}`.trim() || userData.username,
      };
      
      AuthService.setCurrentUser(newUser);
      setUser(newUser);
      
      console.log('Sign up successful:', signUpResponse.message);
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await AuthService.signOut();
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      setUser(null);
    }
  };

  const handleRefreshToken = async () => {
    try {
      return await refreshToken();
    } catch (error) {
      console.error('Token refresh failed:', error);
      await signOut();
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    signIn,
    signUp,
    signOut,
    refreshToken: handleRefreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
