import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMyProfile } from "@/services/api";
import type { AuthProfile } from "@/types";
import {
  getPasswordStrength,
  MIN_PASSWORD_LENGTH,
  passwordMeetsRules,
} from "@/utils/passwordStrength";
import "@/styles/profile-settings.css";

const ROLE_LABELS: Record<string, string> = {
  CHAIR: "Chair",
  ADMIN: "Admin",
  RESEARCH_ASSOCIATE: "Research Associate",
  RESEARCH_ASSISTANT: "Research Assistant",
  REVIEWER: "Reviewer",
};

const formatRoleLabel = (role: string) => ROLE_LABELS[role] || role.replace(/_/g, " ");

const formatStatusLabel = (status?: string | null) => {
  if (!status) return "Active";
  return status.charAt(0) + status.slice(1).toLowerCase();
};

const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ");
const normalizeEmail = (value: string) => value.trim().toLowerCase();

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not available yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available yet";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatDateOnly = (value?: string | null) => {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getInitials = (fullName: string) => {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "U";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
};

export default function MyProfilePage() {
  const { user, updateProfile, changePassword } = useAuth();
  const [profile, setProfile] = useState<AuthProfile | null>(user);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName ?? "",
    email: user?.email ?? "",
    currentPassword: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordAttempted, setPasswordAttempted] = useState(false);
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [showProfileCurrentPassword, setShowProfileCurrentPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const nextProfile = await fetchMyProfile();
      setProfile(nextProfile);
      setProfileForm({
        fullName: nextProfile.fullName,
        email: nextProfile.email,
        currentPassword: "",
      });
    } catch (error: any) {
      setLoadError(error?.response?.data?.message || "Unable to load your account details.");
      if (user) {
        setProfile(user);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const activeProfile = profile ?? user;
  const nameChanged =
    normalizeName(profileForm.fullName) !== normalizeName(activeProfile?.fullName ?? "");
  const emailChanged =
    normalizeEmail(profileForm.email) !== normalizeEmail(activeProfile?.email ?? "");
  const profileDirty = nameChanged || emailChanged;
  const profileRequiresPassword = emailChanged;
  const profileCanSave =
    normalizeName(profileForm.fullName).length > 0 &&
    profileDirty &&
    (!profileRequiresPassword || profileForm.currentPassword.trim().length > 0);

  const passwordStrength = useMemo(
    () => getPasswordStrength(passwordForm.newPassword),
    [passwordForm.newPassword]
  );
  const passwordValid = useMemo(
    () => passwordMeetsRules(passwordForm.newPassword),
    [passwordForm.newPassword]
  );
  const showCurrentPasswordError =
    passwordAttempted && passwordForm.currentPassword.trim().length === 0;
  const showPasswordError = passwordAttempted && !passwordValid;
  const showConfirmRequired =
    passwordAttempted && passwordForm.confirmPassword.trim().length === 0;
  const showPasswordMismatch =
    passwordAttempted &&
    passwordForm.confirmPassword.length > 0 &&
    passwordForm.newPassword !== passwordForm.confirmPassword;

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setProfileError(null);
    setPasswordError(null);
    setNotice(null);

    if (!profileDirty) {
      setProfileError("Make a change before saving your profile.");
      return;
    }
    if (normalizeName(profileForm.fullName).length === 0) {
      setProfileError("Full name is required.");
      return;
    }
    if (profileRequiresPassword && profileForm.currentPassword.trim().length === 0) {
      setProfileError("Enter your current password to update your email.");
      return;
    }

    setProfileSaving(true);
    try {
      const payload: {
        fullName?: string;
        email?: string;
        currentPassword?: string;
      } = {};

      if (nameChanged) {
        payload.fullName = normalizeName(profileForm.fullName);
      }
      if (emailChanged) {
        payload.email = normalizeEmail(profileForm.email);
        payload.currentPassword = profileForm.currentPassword;
      }

      const nextProfile = await updateProfile(payload);
      setProfile(nextProfile);
      setProfileForm({
        fullName: nextProfile.fullName,
        email: nextProfile.email,
        currentPassword: "",
      });
      setShowEmailPassword(false);
      setNotice(
        emailChanged
          ? "Profile updated. Your name and sign-in email are now current."
          : "Profile updated."
      );
    } catch (error: any) {
      setProfileError(error?.response?.data?.message || "Unable to save your profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordAttempted(true);
    setNotice(null);
    setProfileError(null);
    setPasswordError(null);

    if (
      passwordForm.currentPassword.trim().length === 0 ||
      !passwordValid ||
      passwordForm.confirmPassword.length === 0 ||
      passwordForm.newPassword !== passwordForm.confirmPassword
    ) {
      return;
    }

    setPasswordSaving(true);
    try {
      const nextProfile = await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });
      setProfile(nextProfile);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordAttempted(false);
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setNotice("Password updated. Other active sessions were signed out.");
    } catch (error: any) {
      setPasswordError(error?.response?.data?.message || "Unable to update your password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  if (!activeProfile && loading) {
    return (
      <div className="dashboard-content profile-settings-page portal-page portal-page--dense portal-page--narrow">
        <section className="portal-section profile-settings-loading">
          <span className="portal-kicker">My Profile</span>
          <h1 className="portal-title">Loading your account</h1>
          <p className="portal-subtitle">Fetching the latest profile and security details.</p>
        </section>
      </div>
    );
  }

  if (!activeProfile) {
    return (
      <div className="dashboard-content profile-settings-page portal-page portal-page--dense portal-page--narrow">
        <section className="portal-section profile-settings-loading">
          <span className="portal-kicker">My Profile</span>
          <h1 className="portal-title">Your account details are unavailable</h1>
          <p className="portal-subtitle">
            {loadError || "Reload the page and try again."}
          </p>
          <button className="profile-primary-button" type="button" onClick={() => void loadProfile()}>
            Try again
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard-content profile-settings-page portal-page portal-page--dense portal-page--narrow">
      <section className="portal-section profile-settings-hero portal-context">
        <div className="portal-context-inline">
          <div className="portal-context-copy">
            <span className="portal-kicker">My Profile</span>
            <h1 className="portal-title">Profile settings</h1>
            <p className="portal-subtitle">
              Keep your personal account details current and maintain the password used for
              portal access.
            </p>
          </div>

          <div className="profile-identity-card" aria-label="Current account summary">
            <div className="profile-identity-avatar">{getInitials(activeProfile.fullName)}</div>
            <div className="profile-identity-copy">
              <strong>{activeProfile.fullName}</strong>
              <span>{activeProfile.email}</span>
              <div className="profile-identity-meta">
                <span className={`profile-status-pill is-${(activeProfile.status || "APPROVED").toLowerCase()}`}>
                  {formatStatusLabel(activeProfile.status)}
                </span>
                <span className="profile-role-summary">
                  {(activeProfile.roles || []).map(formatRoleLabel).join(", ") || "Portal user"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {loadError ? <div className="profile-notice error portal-support">{loadError}</div> : null}
      {!loadError && notice ? <div className="profile-notice success portal-support">{notice}</div> : null}

      <div className="profile-settings-grid">
        <div className="profile-settings-main">
          <section className="portal-section profile-settings-panel">
            <div className="profile-section-heading">
              <span className="section-kicker">Profile</span>
              <div>
                <h2>Personal details</h2>
                <p>Update the name and email shown across your current portal session.</p>
              </div>
            </div>

            <form className="profile-form" onSubmit={handleProfileSubmit} noValidate>
              <div className="profile-form-grid">
                <label className="profile-field">
                  <span>Full name</span>
                  <input
                    className="profile-input"
                    value={profileForm.fullName}
                    onChange={(event) => {
                      setProfileForm((current) => ({
                        ...current,
                        fullName: event.target.value,
                      }));
                      setProfileError(null);
                      setNotice(null);
                    }}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    disabled={profileSaving}
                  />
                </label>

                <label className="profile-field">
                  <span>Email address</span>
                  <input
                    className={`profile-input ${profileRequiresPassword && profileError ? "has-error" : ""}`}
                    value={profileForm.email}
                    onChange={(event) => {
                      setProfileForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }));
                      setProfileError(null);
                      setNotice(null);
                    }}
                    placeholder="Enter your sign-in email"
                    autoComplete="email"
                    disabled={profileSaving}
                  />
                </label>
              </div>

              <div className="profile-inline-callout">
                <div>
                  <strong>Email changes require your current password.</strong>
                  <p>
                    Your name can be updated on its own. Changing the email used for sign-in
                    requires one quick confirmation step.
                  </p>
                </div>
                <button
                  className="profile-secondary-button"
                  type="button"
                  onClick={() => setShowEmailPassword((current) => !current)}
                >
                  {showEmailPassword || profileRequiresPassword ? "Hide confirmation" : "Confirm email change"}
                </button>
              </div>

              {showEmailPassword || profileRequiresPassword ? (
                <label className="profile-field">
                  <span>Current password</span>
                  <div className={`profile-password-shell ${profileRequiresPassword && profileError ? "has-error" : ""}`}>
                    <input
                      className="profile-input profile-password-input"
                      type={showProfileCurrentPassword ? "text" : "password"}
                      value={profileForm.currentPassword}
                      onChange={(event) => {
                        setProfileForm((current) => ({
                          ...current,
                          currentPassword: event.target.value,
                        }));
                        setProfileError(null);
                      }}
                      placeholder="Required only when changing your email"
                      autoComplete="current-password"
                      disabled={profileSaving}
                    />
                    <button
                      className="profile-password-toggle"
                      type="button"
                      onClick={() => setShowProfileCurrentPassword((current) => !current)}
                      aria-label="Toggle current password visibility"
                    >
                      {showProfileCurrentPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
              ) : null}

              {profileError ? (
                <div className="profile-inline-error" role="alert">
                  {profileError}
                </div>
              ) : null}

              <div className="profile-form-actions">
                <button
                  className="profile-secondary-button"
                  type="button"
                  onClick={() => {
                    setProfileForm({
                      fullName: activeProfile.fullName,
                      email: activeProfile.email,
                      currentPassword: "",
                    });
                    setProfileError(null);
                    setNotice(null);
                    setShowEmailPassword(false);
                  }}
                  disabled={profileSaving || !profileDirty}
                >
                  Reset changes
                </button>
                <button
                  className="profile-primary-button"
                  type="submit"
                  disabled={profileSaving || !profileCanSave}
                >
                  {profileSaving ? "Saving profile..." : "Save profile"}
                </button>
              </div>
            </form>
          </section>

          <section className="portal-section profile-settings-panel">
            <div className="profile-section-heading">
              <span className="section-kicker">Security</span>
              <div>
                <h2>Password and sign-in</h2>
                <p>Use your current password to set a new one for this account.</p>
              </div>
            </div>

            <div className="profile-security-summary">
              <div className="profile-security-card">
                <span>Last sign-in</span>
                <strong>{formatDateTime(activeProfile.lastLoginAt)}</strong>
                <small>{activeProfile.lastLoginIp ? `IP ${activeProfile.lastLoginIp}` : "IP address unavailable"}</small>
              </div>
              <div className="profile-security-card">
                <span>Session protection</span>
                <strong>Current password required</strong>
                <small>Password changes revoke other active sessions.</small>
              </div>
            </div>

            <form className="profile-form" onSubmit={handlePasswordSubmit} noValidate>
              <label className="profile-field">
                <span>Current password</span>
                <div className={`profile-password-shell ${showCurrentPasswordError || passwordError ? "has-error" : ""}`}>
                  <input
                    className="profile-input profile-password-input"
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(event) => {
                      setPasswordForm((current) => ({
                        ...current,
                        currentPassword: event.target.value,
                      }));
                      setPasswordError(null);
                      setNotice(null);
                    }}
                    placeholder="Enter your current password"
                    autoComplete="current-password"
                    disabled={passwordSaving}
                  />
                  <button
                    className="profile-password-toggle"
                    type="button"
                    onClick={() => setShowCurrentPassword((current) => !current)}
                    aria-label="Toggle current password visibility"
                  >
                    {showCurrentPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {showCurrentPasswordError ? (
                  <p className="profile-field-error" role="alert">
                    Enter your current password before setting a new one.
                  </p>
                ) : null}
              </label>

              <div className="profile-form-grid">
                <label className="profile-field">
                  <span>New password</span>
                  <div className={`profile-password-shell ${showPasswordError ? "has-error" : ""}`}>
                    <input
                      className="profile-input profile-password-input"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(event) => {
                        setPasswordForm((current) => ({
                          ...current,
                          newPassword: event.target.value,
                        }));
                        setPasswordError(null);
                      }}
                      placeholder="Create a new password"
                      autoComplete="new-password"
                      disabled={passwordSaving}
                    />
                    <button
                      className="profile-password-toggle"
                      type="button"
                      onClick={() => setShowNewPassword((current) => !current)}
                      aria-label="Toggle new password visibility"
                    >
                      {showNewPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>

                <label className="profile-field">
                  <span>Confirm new password</span>
                  <div className={`profile-password-shell ${(showConfirmRequired || showPasswordMismatch) ? "has-error" : ""}`}>
                    <input
                      className="profile-input profile-password-input"
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordForm.confirmPassword}
                      onChange={(event) => {
                        setPasswordForm((current) => ({
                          ...current,
                          confirmPassword: event.target.value,
                        }));
                        setPasswordError(null);
                      }}
                      placeholder="Repeat your new password"
                      autoComplete="new-password"
                      disabled={passwordSaving}
                    />
                    <button
                      className="profile-password-toggle"
                      type="button"
                      onClick={() => setShowConfirmPassword((current) => !current)}
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
              </div>

              <div className="profile-password-strength">
                <div className="profile-password-strength-row">
                  <span>Password strength</span>
                  <strong className={`is-${passwordStrength.tone}`}>{passwordStrength.label}</strong>
                </div>
                <div className="profile-password-strength-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={passwordStrength.progress}>
                  <span
                    className={`profile-password-strength-fill is-${passwordStrength.tone}`}
                    style={{ width: `${passwordStrength.progress}%` }}
                  />
                </div>
              </div>

              <div className="profile-password-guidance" role="note">
                <p>Your password must have:</p>
                <ul>
                  {passwordStrength.criteria.map((criterion) => (
                    <li key={criterion.key} className={criterion.satisfied ? "is-satisfied" : "is-pending"}>
                      <span aria-hidden="true">{criterion.satisfied ? "✓" : "•"}</span>
                      <span>{criterion.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {showPasswordError ? (
                <p className="profile-field-error" role="alert">
                  Use at least {MIN_PASSWORD_LENGTH} characters with uppercase, lowercase, and a number.
                </p>
              ) : null}
              {!showPasswordError && showConfirmRequired ? (
                <p className="profile-field-error" role="alert">
                  Confirm your new password.
                </p>
              ) : null}
              {!showPasswordError && !showConfirmRequired && showPasswordMismatch ? (
                <p className="profile-field-error" role="alert">
                  Passwords must match.
                </p>
              ) : null}
              {passwordError ? (
                <div className="profile-inline-error" role="alert">
                  {passwordError}
                </div>
              ) : null}

              <div className="profile-form-actions">
                <button
                  className="profile-secondary-button"
                  type="button"
                  onClick={() => {
                    setPasswordForm({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                    setPasswordAttempted(false);
                    setPasswordError(null);
                  }}
                  disabled={passwordSaving}
                >
                  Clear
                </button>
                <button className="profile-primary-button" type="submit" disabled={passwordSaving}>
                  {passwordSaving ? "Updating password..." : "Update password"}
                </button>
              </div>
            </form>
          </section>
        </div>

        <aside className="profile-settings-aside">
          <section className="portal-section profile-settings-panel">
            <div className="profile-section-heading">
              <span className="section-kicker">Account Info</span>
              <div>
                <h2>Read-only details</h2>
                <p>Reference information for your active account and access level.</p>
              </div>
            </div>

            <dl className="profile-meta-list">
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`profile-status-pill is-${(activeProfile.status || "APPROVED").toLowerCase()}`}>
                    {formatStatusLabel(activeProfile.status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Roles</dt>
                <dd className="profile-role-list">
                  {(activeProfile.roles || []).length > 0
                    ? activeProfile.roles.map((role) => (
                        <span key={role} className="profile-role-chip">
                          {formatRoleLabel(role)}
                        </span>
                      ))
                    : <span className="profile-muted-value">No role assigned</span>}
                </dd>
              </div>
              <div>
                <dt>Approved on</dt>
                <dd>{formatDateOnly(activeProfile.approvedAt)}</dd>
              </div>
              <div>
                <dt>Current sign-in email</dt>
                <dd>{activeProfile.email}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
