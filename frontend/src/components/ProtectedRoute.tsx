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
      <div className="route-skeleton route-skeleton-auth" aria-busy="true" aria-label="Checking session">
        <main className="route-skeleton-main" aria-hidden="true">
          <div className="route-skeleton-header">
            <span className="skeleton-pill" />
            <span className="skeleton-line" />
            <span className="skeleton-line" style={{ width: "62%" }} />
          </div>
          <span className="skeleton-card" />
        </main>
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
      return (
        <Navigate
          to="/not-authorized"
          state={{ from: location, requiredRoles: allowedRoles }}
          replace
        />
      );
    }
  }

  return <>{children}</>;
}
