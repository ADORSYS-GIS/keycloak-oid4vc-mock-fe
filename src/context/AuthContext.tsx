import { createContext, useContext } from "react";

export interface UserProfile {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  id?: string;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  userProfile: UserProfile | null;
  login: () => void;
  logout: () => void;
  getToken: () => string | undefined;
  hasRole: (role: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
