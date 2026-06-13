/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import {
  authGoogle,
  authMe,
  clearToken,
  getToken,
  setToken,
  updateAuthMe,
  type AuthUser
} from '../lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (idToken: string) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
  updateProfile: (data: { displayName: string; photoUrl?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, validate stored token
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    authMe()
      .then(setUser)
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (idToken: string) => {
    const { token, user: authUser } = await authGoogle(idToken);
    setToken(token);
    setUser(authUser);
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const updated = await authMe();
      setUser(updated);
    } catch {
      clearToken();
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (data: { displayName: string; photoUrl?: string }) => {
    const updated = await updateAuthMe(data);
    setUser(updated);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, refreshUser, updateProfile }),
    [loading, refreshUser, signIn, signOut, updateProfile, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
