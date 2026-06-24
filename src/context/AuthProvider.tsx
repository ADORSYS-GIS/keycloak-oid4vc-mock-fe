import { useEffect, useState, type ReactNode, useCallback, useRef } from 'react';
import keycloak from '../config/keycloak.config';
import { AuthContext, type UserProfile } from './AuthContext';

let keycloakInitPromise: Promise<boolean> | undefined;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const configuredAppBaseUrl = import.meta.env.VITE_APP_BASE_URL as string | undefined;
  const appBaseUrl = configuredAppBaseUrl
    ? configuredAppBaseUrl.replace(/\/?$/, '/')
    : `${window.location.origin}${import.meta.env.BASE_URL}`;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const isKeycloakInitialized = useRef(false);

  const logout = useCallback(() => {
    keycloak.logout({
      redirectUri: appBaseUrl,
    });
  }, [appBaseUrl]);

  const loadUserProfile = useCallback(() => {
    const token = keycloak.tokenParsed as Record<string, unknown> | undefined;

    if (!token) {
      setUserProfile(null);
      return;
    }

    const profile: UserProfile = {
      id: typeof token.sub === 'string' ? token.sub : undefined,
      username: typeof token.preferred_username === 'string' ? token.preferred_username : undefined,
      firstName: typeof token.given_name === 'string' ? token.given_name : undefined,
      lastName: typeof token.family_name === 'string' ? token.family_name : undefined,
      email: typeof token.email === 'string' ? token.email : undefined,
    };

    console.log('User profile loaded from token claims:', profile);
    setUserProfile(profile);
  }, []);

  const initKeycloak = useCallback(async () => {
    try {
      console.log('Initializing Keycloak...');
      keycloakInitPromise ??= keycloak
        .init({
          onLoad: 'check-sso',
          pkceMethod: 'S256',
          checkLoginIframe: false,
          enableLogging: true,
          redirectUri: appBaseUrl,
        })
        .catch((error) => {
          keycloakInitPromise = undefined;
          throw error;
        });

      const authenticated = await keycloakInitPromise;

      console.log('Authenticated via init:', authenticated);
      setIsAuthenticated(authenticated);

      if (authenticated) {
        loadUserProfile();

        setInterval(() => {
          keycloak.updateToken(70).catch(() => {
            console.error('Failed to refresh token');
            logout();
          });
        }, 60000);
      }
    } catch (error) {
      console.error('Failed to initialize Keycloak:', error);
    } finally {
      setIsLoading(false);
      console.log('Keycloak initialization finished.');
    }
  }, [appBaseUrl, loadUserProfile, logout]);

  useEffect(() => {
    if (isKeycloakInitialized.current) {
      return;
    }
    isKeycloakInitialized.current = true;
    initKeycloak();
  }, [initKeycloak]);

  const login = useCallback(() => {
    console.log('Login called, redirecting to Keycloak...');
    keycloak.login({
      redirectUri: appBaseUrl,
    });
  }, [appBaseUrl]);

  const getToken = (): string | undefined => {
    return keycloak.token;
  };

  const hasRole = (role: string): boolean => {
    return keycloak.realmAccess?.roles?.includes(role) || false;
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        userProfile,
        login,
        logout,
        getToken,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
