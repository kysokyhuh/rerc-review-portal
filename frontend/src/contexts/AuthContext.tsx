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
  changeOwnPassword,
  ensureCsrfCookie,
  fetchMyProfile,
  forceSessionExpiredRedirect,
  logoutSession,
  refreshAccessSession,
  registerSessionExpiredHandler,
  updateMyProfile,
} from "@/services/api";
import type {
  AuthProfile,
  ChangePasswordPayload,
  UpdateProfilePayload,
} from "@/types";

export type AuthUser = AuthProfile;

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
  updateProfile: (payload: UpdateProfilePayload) => Promise<AuthUser>;
  changePassword: (payload: ChangePasswordPayload) => Promise<AuthUser>;
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
      const profile = await fetchMyProfile();
      setAuthenticatedUser(profile);
      return;
    } catch (error: any) {
      if (error?.response?.status === 401) {
        try {
          await refreshAccessSession();
          const retry = await fetchMyProfile();
          setAuthenticatedUser(retry);
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

  const updateProfile = useCallback(
    async (payload: UpdateProfilePayload) => {
      const user = await updateMyProfile(payload);
      setAuthenticatedUser(user);
      return user;
    },
    [setAuthenticatedUser]
  );

  const changePassword = useCallback(
    async (payload: ChangePasswordPayload) => {
      const user = await changeOwnPassword(payload);
      setAuthenticatedUser(user);
      return user;
    },
    [setAuthenticatedUser]
  );

  const logout = useCallback(() => {
    void logoutSession().catch(() => {});
    clearAuthState();
  }, [clearAuthState]);

  return (
    <AuthContext.Provider
      value={{ ...state, login, updateProfile, changePassword, logout, refreshMe }}
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
