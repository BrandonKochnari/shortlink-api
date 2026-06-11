import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AuthUser, getCurrentUser, loginUser, registerUser } from "../api/auth";

const TOKEN_STORAGE_KEY = "access_token";

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(Boolean(token));

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const saveSession = useCallback(async (nextToken: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    setToken(nextToken);
    const currentUser = await getCurrentUser(nextToken);
    setUser(currentUser);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await loginUser(email, password);
      await saveSession(response.access_token);
    },
    [saveSession],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      await registerUser(email, password);
      await login(email, password);
    },
    [login],
  );

  useEffect(() => {
    if (!token) {
      setIsInitializing(false);
      return;
    }

    let isMounted = true;
    setIsInitializing(true);

    getCurrentUser(token)
      .then((currentUser) => {
        if (isMounted) {
          setUser(currentUser);
        }
      })
      .catch(() => {
        if (isMounted) {
          clearSession();
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsInitializing(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [clearSession, token]);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      isInitializing,
      login,
      register,
      logout: clearSession,
    }),
    [clearSession, isInitializing, login, register, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

