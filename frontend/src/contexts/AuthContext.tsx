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
const authApi = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  roles: string[];
  status?: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<AuthUser>;
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

  const refreshMe = useCallback(async () => {
    try {
      const res = await authApi.get("/auth/me");
      setState({
        user: res.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await axios.post(
      `${API_BASE_URL}/auth/login`,
      { email, password },
      { withCredentials: true }
    );

    const { user } = res.data;

    setState({
      user,
      isAuthenticated: true,
      isLoading: false,
    });
    return user as AuthUser;
  }, []);

  const logout = useCallback(() => {
    axios
      .post(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true })
      .catch(() => {});

    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, logout, refreshMe }}
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
