import {
  useEffect,
  useState,
  type ReactNode,
  useCallback,
  useRef,
} from "react";
import keycloak from "../config/keycloak.config";
import { AuthContext, type UserProfile } from "./AuthContext";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const isKeycloakInitialized = useRef(false);

  const logout = useCallback(() => {
    keycloak.logout({
      redirectUri: window.location.origin + "/",
    });
  }, []);

  const loadUserProfile = useCallback(async () => {
    try {
      console.log("Loading user profile...");
      const profile = await keycloak.loadUserProfile();
      console.log("User profile loaded:", profile);
      setUserProfile(profile);
    } catch (error) {
      console.error("Failed to load user profile:", error);
    }
  }, []);

  const initKeycloak = useCallback(async () => {
    try {
      console.log("Initializing Keycloak...");
      const authenticated = await keycloak.init({
        onLoad: "check-sso",
        pkceMethod: "S256",
        checkLoginIframe: false,
        enableLogging: true,
        // Explicitly set redirect URI to current URL
        redirectUri: window.location.origin + window.location.pathname,
      });

      console.log("Authenticated via init:", authenticated);
      setIsAuthenticated(authenticated);

      if (authenticated) {
        await loadUserProfile();

        setInterval(() => {
          keycloak.updateToken(70).catch(() => {
            console.error("Failed to refresh token");
            logout();
          });
        }, 60000);
      }
    } catch (error) {
      console.error("Failed to initialize Keycloak:", error);
    } finally {
      setIsLoading(false);
      console.log("Keycloak initialization finished.");
    }
  }, [loadUserProfile, logout]);

  useEffect(() => {
    if (isKeycloakInitialized.current) {
      return;
    }
    isKeycloakInitialized.current = true;
    initKeycloak();
  }, [initKeycloak]);

  const login = useCallback(() => {
    console.log("Login called, redirecting to Keycloak...");
    // Explicitly provide redirect URI
    keycloak.login({
      redirectUri: window.location.origin + "/",
    });
  }, []);

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
