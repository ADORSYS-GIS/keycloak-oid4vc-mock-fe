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
