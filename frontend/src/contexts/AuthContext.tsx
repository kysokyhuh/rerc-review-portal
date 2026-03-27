import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  authApi,
  ensureCsrfCookie,
  forceSessionExpiredRedirect,
  logoutSession,
  refreshAccessSession,
  registerSessionExpiredHandler,
} from "@/services/api";

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  roles: string[];
  status?: string;
  forcePasswordChange?: boolean;
}

interface AuthLoginResult {
  user: AuthUser;
  mustChangePassword: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<AuthLoginResult>;
  changePassword: (newPassword: string, confirmPassword: string) => Promise<AuthUser>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const setAuthenticatedUser = useCallback((user: AuthUser) => {
    setState({
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const clearAuthState = useCallback(() => {
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const res = await authApi.get("/auth/me");
      setAuthenticatedUser(res.data.user as AuthUser);
      return;
    } catch (error: any) {
      if (error?.response?.status === 401) {
        try {
          await refreshAccessSession();
          const retry = await authApi.get("/auth/me");
          setAuthenticatedUser(retry.data.user as AuthUser);
          return;
        } catch {
          forceSessionExpiredRedirect();
          return;
        }
      }

      clearAuthState();
    }
  }, [clearAuthState, setAuthenticatedUser]);

  useEffect(() => {
    return registerSessionExpiredHandler(() => {
      clearAuthState();
      void logoutSession().catch(() => {});
    });
  }, [clearAuthState]);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    await ensureCsrfCookie();
    const res = await authApi.post("/auth/login", { email, password });
    const { user, mustChangePassword } = res.data;
    setAuthenticatedUser(user as AuthUser);
    return {
      user: user as AuthUser,
      mustChangePassword: Boolean(mustChangePassword),
    };
  }, [setAuthenticatedUser]);

  const changePassword = useCallback(
    async (newPassword: string, confirmPassword: string) => {
      await ensureCsrfCookie();
      const res = await authApi.post("/auth/change-password", {
        newPassword,
        confirmPassword,
      });
      const { user } = res.data;
      setAuthenticatedUser(user as AuthUser);
      return user as AuthUser;
    },
    [setAuthenticatedUser]
  );

  const logout = useCallback(() => {
    void logoutSession().catch(() => {});
    clearAuthState();
  }, [clearAuthState]);

  return (
    <AuthContext.Provider
      value={{ ...state, login, changePassword, logout, refreshMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
