import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { AuthService, User, SignUpCredentials } from '../services/auth';
import { apiService } from '../services/api';
import { useTokenRefresh } from '../hooks/useTokenRefresh';
import { parseJwtToken, extractUserFromToken } from '../utils/jwtParser';

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

export function calculatePasswordStrength(password: string): number {
    let score = 0;

    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[@$!%*?&]/.test(password)) score++;

    return score;
}

export function getPasswordStrengthLabel(score: number): string {
    if (score <= 1) return 'Very weak';
    if (score === 2) return 'Weak';
    if (score === 3) return 'Medium';
    if (score === 4) return 'Strong';
    return 'Very strong';
}

function getUserFromAccessToken(): User | null {
    const accessToken = AuthService.getAccessToken();
    if (!accessToken) return null;

    const tokenData = parseJwtToken(accessToken);
    if (!tokenData) return null;

    const extractedUser = extractUserFromToken(tokenData);
    return {
        id: Date.now().toString(),
        username: extractedUser.username || 'user',
        email: extractedUser.email,
        name: extractedUser.name,
        givenName: extractedUser.givenName,
        familyName: extractedUser.familyName,
        emailVerified: extractedUser.emailVerified,
        scope: extractedUser.scope,
    };
}

export function AuthProvider({ children }: Readonly<AuthProviderProps>) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { refreshToken } = useTokenRefresh();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                if (!AuthService.isAuthenticated()) return;

                const currentUser = AuthService.getCurrentUser();
                if (currentUser) {
                    setUser(currentUser);
                    return;
                }

                const fetchedUser = await fetchUserFromApi();
                if (fetchedUser) {
                    AuthService.setCurrentUser(fetchedUser);
                    setUser(fetchedUser);
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                await AuthService.signOut();
            } finally {
                setIsLoading(false);
            }
        };

        const fetchUserFromApi = async (): Promise<User | null> => {
            try {
                const { data } = await apiService.getUserInfo();
                return {
                    id: String(data.id),
                    username: data.email?.split('@')[0] || 'user',
                    email: data.email,
                    name: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() || data.email,
                    givenName: data.firstName,
                    familyName: data.lastName,
                };
            } catch {
                return getUserFromAccessToken();
            }
        };

        checkAuth();
        const onSignOut = () => setUser(null);
        globalThis.addEventListener('auth:signout', onSignOut);
        return () => {
            globalThis.removeEventListener('auth:signout', onSignOut);
        };
    }, []);

    const signIn = async (username: string, password: string) => {
        try {
            const authResponse = await AuthService.signIn({ username, password });

            try {
                const { data } = await apiService.getUserInfo();
                const mapped: User = {
                    id: String(data.id),
                    username: data.email?.split('@')[0] || username,
                    email: data.email,
                    name: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() || data.email || username,
                    givenName: data.firstName,
                    familyName: data.lastName,
                };
                AuthService.setCurrentUser(mapped);
                setUser(mapped);
                return;
            } catch {
                const tokenData = parseJwtToken(authResponse.access_token);
                let newUser: User;
                if (tokenData) {
                    const extractedUser = extractUserFromToken(tokenData);
                    newUser = {
                        id: Date.now().toString(),
                        username: extractedUser.username || username,
                        email: extractedUser.email,
                        name: extractedUser.name,
                        givenName: extractedUser.givenName,
                        familyName: extractedUser.familyName,
                        emailVerified: extractedUser.emailVerified,
                        scope: extractedUser.scope,
                    };
                } else {
                    newUser = {
                        id: Date.now().toString(),
                        username,
                        email: username.includes('@') ? username : undefined,
                        name: username.split('@')[0],
                    };
                }
                AuthService.setCurrentUser(newUser);
                setUser(newUser);
            }
        } catch (error) {
            console.error('Sign in error:', error);
            throw error;
        }
    };

    // 🔐 SIGN UP with:
    // - Username required and length ≥ 4
    // - Password detailed validation (with explicit allowed symbols)
    const signUp = async (userData: SignUpCredentials) => {
        try {
            // Username validation
            if (!userData.username || userData.username.trim().length < 4) {
                throw new Error('Username must be at least 4 characters long.');
            }

            const password = userData.password;
            const errors: string[] = [];

            if (password.length < 8) {
                errors.push('• At least 8 characters');
            }
            if (!/[A-Z]/.test(password)) {
                errors.push('• One uppercase letter (A–Z)');
            }
            if (!/[a-z]/.test(password)) {
                errors.push('• One lowercase letter (a–z)');
            }
            if (!/\d/.test(password)) {
                errors.push('• One number (0–9)');
            }
            if (!/[@$!%*?&]/.test(password)) {
                errors.push('• One special symbol (choose from: @  $  !  %  *  ?  &)');
            }

            if (errors.length > 0) {
                const strengthScore = calculatePasswordStrength(password);
                const strengthLabel = getPasswordStrengthLabel(strengthScore);

                throw new Error(
                    `Password is not strong enough (current: ${strengthLabel}).\n` +
                    'Please make sure it includes:\n' +
                    errors.join('\n')
                );
            }

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
        } catch (error: any) {
            console.error('Sign up error:', error);
            if (error instanceof Error) throw error;
            throw new Error('Sign up failed');
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

    const value: AuthContextType = useMemo(() => ({
        user,
        isAuthenticated: !!user,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshToken: handleRefreshToken,
    }), [user, isLoading, signIn, signUp, signOut, handleRefreshToken]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}