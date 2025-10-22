import { useEffect, useState, type ReactNode } from 'react';
import keycloak from '../config/keycloak.config';
import { AuthContext, type UserProfile } from './AuthContext';

let isKeycloakInitialized = false;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (isKeycloakInitialized) {
      return;
    }
    isKeycloakInitialized = true;
    initKeycloak();
  }, []);

  const initKeycloak = async () => {
    try {
      console.log('Initializing Keycloak...');
      const authenticated = await keycloak.init({
        pkceMethod: 'S256',
        enableLogging: true,
      });

      console.log('Authenticated via init:', authenticated);
      setIsAuthenticated(authenticated);

      if (authenticated) {
        await loadUserProfile();
        
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
  };

  const loadUserProfile = async () => {
    try {
      console.log('Loading user profile...');
      const profile = await keycloak.loadUserProfile();
      console.log('User profile loaded:', profile);
      setUserProfile(profile);
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  };

  const login = () => {
    console.log('Login called, redirecting to Keycloak...');
    keycloak.login();
  };

  const logout = () => {
    keycloak.logout();
  };

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