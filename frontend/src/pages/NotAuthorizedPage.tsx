import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getPrimaryRoleDescription, getPrimaryRoleLabel, getRoleLabel } from "@/utils/roleUtils";

export default function NotAuthorizedPage() {
  const { user } = useAuth();
  const location = useLocation();
  const state = location.state as { requiredRoles?: string[] } | null;
  const requiredRoles = state?.requiredRoles ?? [];
  const roleLabel = getPrimaryRoleLabel(user?.roles ?? []);
  const roleDescription = getPrimaryRoleDescription(user?.roles ?? []);

  return (
    <div className="not-authorized-page">
      <h1>Not authorized</h1>
      <p>
        Your current role is <strong>{roleLabel}</strong>. {roleDescription}
      </p>
      <p>
        This page is limited to a different role. Use the dashboard to return to
        the records available to your account.
      </p>
      {requiredRoles.length > 0 ? (
        <p className="not-authorized-required">
          Required role: {requiredRoles.map(getRoleLabel).join(", ")}
        </p>
      ) : null}
      <p>
        <Link to="/dashboard">Back to dashboard</Link>
      </p>
    </div>
  );
}
