import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import axios from "axios";

const API_BASE_URL =
  (typeof import.meta !== "undefined"
    ? import.meta.env?.VITE_API_URL
    : undefined) || "http://localhost:3000";

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  roles: string[];
  committeeRoles: Record<number, string>;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "rerc_access_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Try to restore session on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    // Validate token by calling /auth/me
    const authApi = axios.create({ baseURL: API_BASE_URL });
    authApi
      .get("/auth/me", {
        headers: { Authorization: `Bearer ${stored}` },
      })
      .then((res) => {
        setState({
          user: res.data.user,
          accessToken: stored,
          isAuthenticated: true,
          isLoading: false,
        });
      })
      .catch(() => {
        // Token invalid/expired — try refresh
        return authApi
          .post("/auth/refresh", {}, { withCredentials: true })
          .then((res) => {
            const newToken = res.data.accessToken;
            localStorage.setItem(TOKEN_KEY, newToken);
            return authApi.get("/auth/me", {
              headers: { Authorization: `Bearer ${newToken}` },
            });
          })
          .then((res) => {
            setState({
              user: res.data.user,
              accessToken: localStorage.getItem(TOKEN_KEY),
              isAuthenticated: true,
              isLoading: false,
            });
          })
          .catch(() => {
            localStorage.removeItem(TOKEN_KEY);
            setState({
              user: null,
              accessToken: null,
              isAuthenticated: false,
              isLoading: false,
            });
          });
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await axios.post(
      `${API_BASE_URL}/auth/login`,
      { email, password },
      { withCredentials: true }
    );

    const { accessToken, user } = res.data;
    localStorage.setItem(TOKEN_KEY, accessToken);

    setState({
      user,
      accessToken,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    // Fire-and-forget server logout to clear httpOnly cookie
    axios
      .post(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true })
      .catch(() => {});

    setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const getAccessToken = useCallback(() => {
    return state.accessToken;
  }, [state.accessToken]);

  return (
    <AuthContext.Provider
      value={{ ...state, login, logout, getAccessToken }}
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
