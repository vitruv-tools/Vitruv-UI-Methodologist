import React, {createContext, useContext, useState, useEffect, ReactNode} from 'react';
import {AuthService, User, SignUpCredentials} from '../services/auth';
import {apiService} from '../services/api';
import {useTokenRefresh} from '../hooks/useTokenRefresh';
import {parseJwtToken, extractUserFromToken} from '../utils/jwtParser';

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

export function AuthProvider({children}: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const {refreshToken} = useTokenRefresh();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                if (AuthService.isAuthenticated()) {
                    const currentUser = AuthService.getCurrentUser();
                    if (currentUser) {
                        setUser(currentUser);
                    } else {
                        try {
                            const {data} = await apiService.getUserInfo();
                            const mapped: User = {
                                id: String(data.id),
                                username: data.email?.split('@')[0] || 'user',
                                email: data.email,
                                name: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() || data.email,
                                givenName: data.firstName,
                                familyName: data.lastName,
                            };
                            AuthService.setCurrentUser(mapped);
                            setUser(mapped);
                        } catch (e) {
                            const accessToken = AuthService.getAccessToken();
                            if (accessToken) {
                                const tokenData = parseJwtToken(accessToken);
                                if (tokenData) {
                                    const extractedUser = extractUserFromToken(tokenData);
                                    const userFromToken: User = {
                                        id: Date.now().toString(),
                                        username: extractedUser.username || 'user',
                                        email: extractedUser.email,
                                        name: extractedUser.name,
                                        givenName: extractedUser.givenName,
                                        familyName: extractedUser.familyName,
                                        emailVerified: extractedUser.emailVerified,
                                        scope: extractedUser.scope,
                                    };
                                    AuthService.setCurrentUser(userFromToken);
                                    setUser(userFromToken);
                                }
                            }
                        }
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
        const onSignOut = () => setUser(null);
        window.addEventListener('auth:signout', onSignOut);
        return () => {
            window.removeEventListener('auth:signout', onSignOut);
        };
    }, []);

    const signIn = async (username: string, password: string) => {
        try {
            const authResponse = await AuthService.signIn({username, password});

            try {
                const {data} = await apiService.getUserInfo();
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
            } catch (e) {
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
    // - Password regex validation
    const signUp = async (userData: SignUpCredentials) => {
        try {
            // Username validation
            if (!userData.username || userData.username.trim().length < 4) {
                throw new Error('Username must be at least 4 characters long.');
            }

            // Password regex validation
            const passwordRegex =
                /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

            if (!passwordRegex.test(userData.password)) {
                throw new Error(
                    'Password must contain uppercase, lowercase, number, special character, and be at least 8 characters.'
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