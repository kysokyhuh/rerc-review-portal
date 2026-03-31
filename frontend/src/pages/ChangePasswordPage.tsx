import { FormEvent, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BRAND } from "@/config/branding";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPasswordStrength,
  MIN_PASSWORD_LENGTH,
  passwordMeetsRules,
} from "@/utils/passwordStrength";
import "../styles/login.css";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, changePassword } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordValid = useMemo(() => passwordMeetsRules(newPassword), [newPassword]);
  const passwordStrength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.forcePasswordChange) {
    if (user.roles.includes("CHAIR") || user.roles.includes("ADMIN")) {
      return <Navigate to="/admin/account-management" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  const showPasswordError = submitAttempted && !passwordValid;
  const showConfirmRequired = submitAttempted && confirmPassword.length === 0;
  const showMismatch =
    submitAttempted &&
    confirmPassword.length > 0 &&
    newPassword.length > 0 &&
    newPassword !== confirmPassword;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    setError(null);

    if (!passwordValid || confirmPassword.length === 0 || newPassword !== confirmPassword) {
      return;
    }

    setLoading(true);
    try {
      const nextUser = await changePassword({
        newPassword,
        confirmPassword,
      });
      if (nextUser.roles.includes("CHAIR") || nextUser.roles.includes("ADMIN")) {
        navigate("/admin/account-management", { replace: true });
        return;
      }
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-grain" aria-hidden="true"></div>
      <div className="login-shell forgot-shell">
        <aside className="login-card forgot-card" role="region" aria-label="Change password">
          <div className="login-cardHeader forgot-card-header">
            <p className="login-kicker forgot-kicker">
              <span className="login-dot" aria-hidden="true"></span>
              {BRAND.name}
            </p>
            <h2>Change your password</h2>
            <p className="forgot-reassurance">
              A password change is required before you can continue.
            </p>
            <p>Create a new password for your URERB portal account.</p>
          </div>

          <form onSubmit={onSubmit} noValidate className="forgot-form">
            {error ? <div className="login-error">{error}</div> : null}

            <div className="login-field">
              <label htmlFor="newPassword">New password</label>
              <div className={`login-control forgot-control ${showPasswordError ? "invalid" : ""}`}>
                <input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Create a new password"
                  autoComplete="new-password"
                  required
                  aria-invalid={showPasswordError}
                  aria-describedby="change-password-help change-password-strength change-password-error"
                />
                <button
                  className="login-toggle"
                  type="button"
                  onClick={() => setShowNewPassword((value) => !value)}
                  aria-controls="newPassword"
                  aria-pressed={showNewPassword}
                  aria-label="Toggle password visibility"
                >
                  {showNewPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                      <circle cx="12" cy="12" r="3.5" />
                      <path d="M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                      <circle cx="12" cy="12" r="3.5" />
                    </svg>
                  )}
                </button>
              </div>
              <div id="change-password-strength" className="password-strength" aria-live="polite">
                <div className="password-strength-row">
                  <span className="password-strength-label">Strength</span>
                  <span className={`password-strength-value is-${passwordStrength.tone}`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div
                  className="password-strength-track"
                  role="progressbar"
                  aria-label="Password strength"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={passwordStrength.progress}
                >
                  <span
                    className={`password-strength-fill is-${passwordStrength.tone}`}
                    style={{ width: `${passwordStrength.progress}%` }}
                  />
                </div>
              </div>
              <div id="change-password-help" className="password-guide-card" role="note">
                <p className="password-guide-title">Your password must have:</p>
                <ul className="password-guide-list">
                  {passwordStrength.criteria.map((criterion) => (
                    <li
                      key={criterion.key}
                      className={criterion.satisfied ? "is-satisfied" : "is-pending"}
                    >
                      <span className="password-guide-icon" aria-hidden="true">
                        {criterion.satisfied ? "✓" : "•"}
                      </span>
                      <span>{criterion.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {showPasswordError ? (
                <p id="change-password-error" className="login-field-error forgot-inline-error" role="alert">
                  Use at least {MIN_PASSWORD_LENGTH} characters with uppercase, lowercase, and a number.
                </p>
              ) : null}
            </div>

            <div className="login-field">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <div className={`login-control forgot-control ${(showConfirmRequired || showMismatch) ? "invalid" : ""}`}>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  required
                  aria-invalid={showConfirmRequired || showMismatch}
                  aria-describedby="change-confirm-error"
                />
                <button
                  className="login-toggle"
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  aria-controls="confirmPassword"
                  aria-pressed={showConfirmPassword}
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirmPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                      <circle cx="12" cy="12" r="3.5" />
                      <path d="M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                      <circle cx="12" cy="12" r="3.5" />
                    </svg>
                  )}
                </button>
              </div>
              {showConfirmRequired ? (
                <p id="change-confirm-error" className="login-field-error forgot-inline-error" role="alert">
                  Confirm your new password.
                </p>
              ) : null}
              {!showConfirmRequired && showMismatch ? (
                <p id="change-confirm-error" className="login-field-error forgot-inline-error" role="alert">
                  Passwords must match.
                </p>
              ) : null}
            </div>

            <button className="login-btn forgot-btn" type="submit" disabled={loading}>
              {loading ? "Updating password..." : "Update password"}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
