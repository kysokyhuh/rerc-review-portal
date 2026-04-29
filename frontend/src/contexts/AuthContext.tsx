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
  warmBackendConnection,
} from "@/services/api";
import type {
  AuthProfile,
  ChangePasswordPayload,
  UpdateProfilePayload,
} from "@/types";
import { getErrorStatus } from "@/utils";
import { useRef } from "react";

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
const BACKEND_KEEP_WARM_INTERVAL_MS = 10 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const lastWarmAtRef = useRef(Date.now());

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
    } catch (error: unknown) {
      if (getErrorStatus(error) === 401) {
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
    // Initial session bootstrap is an external sync step on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (!state.isAuthenticated) {
      return undefined;
    }

    lastWarmAtRef.current = Date.now();

    const runKeepWarm = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      try {
        await warmBackendConnection();
        lastWarmAtRef.current = Date.now();
      } catch {
        // Ignore warm-up failures. Normal user-triggered requests still surface errors.
      }
    };

    const handleResume = () => {
      if (Date.now() - lastWarmAtRef.current >= BACKEND_KEEP_WARM_INTERVAL_MS / 2) {
        void runKeepWarm();
      }
    };

    const intervalId = window.setInterval(() => {
      void runKeepWarm();
    }, BACKEND_KEEP_WARM_INTERVAL_MS);

    window.addEventListener("focus", handleResume);
    document.addEventListener("visibilitychange", handleResume);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleResume);
      document.removeEventListener("visibilitychange", handleResume);
    };
  }, [state.isAuthenticated]);

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
