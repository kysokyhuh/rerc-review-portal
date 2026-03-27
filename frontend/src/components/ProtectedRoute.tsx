import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  allowForcedPasswordChange?: boolean;
}

export default function ProtectedRoute({
  children,
  allowedRoles,
  allowForcedPasswordChange = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          color: "var(--neutral-500)",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.forcePasswordChange && !allowForcedPasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && user) {
    const hasRole = user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      return <Navigate to="/not-authorized" state={{ from: location }} replace />;
    }
  }

  return <>{children}</>;
}
