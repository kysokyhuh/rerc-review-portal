import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMyProfile } from "@/services/api";
import type { AuthProfile, LayoutDensity, UserPreferences } from "@/types";
import {
  getPasswordStrength,
  MIN_PASSWORD_LENGTH,
  passwordMeetsRules,
} from "@/utils/passwordStrength";
import { getErrorMessage } from "@/utils";
import { getRoleDescription, getRoleLabel } from "@/utils/roleUtils";
import "@/styles/settings.css";

type SettingsSectionKey = "account" | "security" | "access" | "preferences";

const SETTINGS_SECTIONS: Array<{
  key: SettingsSectionKey;
  label: string;
  detail: string;
}> = [
  { key: "account", label: "Account", detail: "Name and email" },
  { key: "security", label: "Security", detail: "Password and sign-in" },
  { key: "access", label: "Access", detail: "Role and permissions" },
  { key: "preferences", label: "Preferences", detail: "Display defaults" },
];

const DEFAULT_PREFERENCES: UserPreferences = {
  layoutDensity: "COMFORTABLE",
  defaultPageSize: 25,
};

const PAGE_SIZE_OPTIONS: Array<10 | 25 | 50> = [10, 25, 50];

const formatStatusLabel = (status?: string | null) => {
  if (!status) return "Active";
  return status.charAt(0) + status.slice(1).toLowerCase();
};

const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ");
const normalizeEmail = (value: string) => value.trim().toLowerCase();

const getPreferences = (profile?: AuthProfile | null): UserPreferences => ({
  layoutDensity: profile?.preferences?.layoutDensity ?? DEFAULT_PREFERENCES.layoutDensity,
  defaultPageSize: profile?.preferences?.defaultPageSize ?? DEFAULT_PREFERENCES.defaultPageSize,
});

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
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
  const parts = fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "U";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
};

const sectionIsValid = (value: string | undefined): value is SettingsSectionKey =>
  SETTINGS_SECTIONS.some((section) => section.key === value);

export default function SettingsPage() {
  const { section } = useParams();
  const navigate = useNavigate();
  const { user, updateProfile, updatePreferences, changePassword, logout } = useAuth();
  const activeSection = sectionIsValid(section) ? section : null;

  const [profile, setProfile] = useState<AuthProfile | null>(user);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
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
  const [preferencesForm, setPreferencesForm] = useState<UserPreferences>(
    getPreferences(user)
  );
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
      setPreferencesForm(getPreferences(nextProfile));
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error, "Unable to load settings."));
      if (user) {
        setProfile(user);
        setPreferencesForm(getPreferences(user));
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const passwordStrength = useMemo(
    () => getPasswordStrength(passwordForm.newPassword),
    [passwordForm.newPassword]
  );
  const passwordValid = useMemo(
    () => passwordMeetsRules(passwordForm.newPassword),
    [passwordForm.newPassword]
  );

  if (section === undefined) {
    return <Navigate to="/settings/account" replace />;
  }

  if (!activeSection) {
    return <Navigate to="/settings/account" replace />;
  }

  const activeProfile = profile ?? user;
  const currentPreferences = getPreferences(activeProfile);
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
  const preferencesDirty =
    preferencesForm.layoutDensity !== currentPreferences.layoutDensity ||
    preferencesForm.defaultPageSize !== currentPreferences.defaultPageSize;
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
    setPreferencesError(null);
    setNotice(null);

    if (!profileDirty) {
      setProfileError("Make a change before saving.");
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
      setNotice(emailChanged ? "Name and sign-in email saved." : "Profile saved.");
    } catch (error: unknown) {
      setProfileError(getErrorMessage(error, "Unable to save profile."));
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
    setPreferencesError(null);

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
      setNotice("Password updated. Other sessions were signed out.");
    } catch (error: unknown) {
      setPasswordError(getErrorMessage(error, "Unable to update password."));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handlePreferencesSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setProfileError(null);
    setPasswordError(null);
    setPreferencesError(null);

    if (!preferencesDirty) {
      setPreferencesError("Choose a different preference before saving.");
      return;
    }

    setPreferencesSaving(true);
    try {
      const nextProfile = await updatePreferences({
        layoutDensity: preferencesForm.layoutDensity,
        defaultPageSize: preferencesForm.defaultPageSize,
      });
      setProfile(nextProfile);
      setPreferencesForm(getPreferences(nextProfile));
      setNotice("Preferences saved.");
    } catch (error: unknown) {
      setPreferencesError(getErrorMessage(error, "Unable to save preferences."));
    } finally {
      setPreferencesSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  if (!activeProfile && loading) {
    return (
      <div
        className="dashboard-content settings-page portal-page portal-page--dense"
        aria-busy="true"
      >
        <section className="settings-skeleton portal-section">
          <span className="skeleton-pill" />
          <span className="skeleton-line settings-skeleton-title" />
          <span className="skeleton-line settings-skeleton-copy" />
          <div className="settings-skeleton-grid">
            <span className="skeleton-card" />
            <span className="skeleton-card" />
            <span className="skeleton-card" />
          </div>
          <span className="sr-only">Loading settings.</span>
        </section>
      </div>
    );
  }

  if (!activeProfile) {
    return (
      <div className="dashboard-content settings-page portal-page portal-page--dense">
        <section className="settings-empty portal-section">
          <span className="settings-kicker">Settings</span>
          <h1>Settings unavailable</h1>
          <p>{loadError || "Reload the page and try again."}</p>
          <button className="settings-primary-button" type="button" onClick={() => void loadProfile()}>
            Try again
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard-content settings-page portal-page portal-page--dense">
      <section className="settings-hero portal-section">
        <div className="settings-hero-copy">
          <span className="settings-kicker">Personal settings</span>
          <h1>Settings</h1>
          <p>Manage your account, security, access, and display defaults.</p>
        </div>

        <div className="settings-account-summary">
          <div className="settings-avatar">{getInitials(activeProfile.fullName)}</div>
          <div className="settings-account-copy">
            <strong>{activeProfile.fullName}</strong>
            <span>{activeProfile.email}</span>
            <div className="settings-account-meta">
              <span className={`settings-status-pill is-${(activeProfile.status || "APPROVED").toLowerCase()}`}>
                {formatStatusLabel(activeProfile.status)}
              </span>
              <span>{(activeProfile.roles || []).map(getRoleLabel).join(", ") || "Portal user"}</span>
            </div>
          </div>
          <button className="settings-logout-button" type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </section>

      {loadError ? <div className="settings-notice error">{loadError}</div> : null}
      {!loadError && notice ? <div className="settings-notice success">{notice}</div> : null}

      <div className="settings-shell">
        <aside className="settings-nav-panel" aria-label="Settings sections">
          <nav className="settings-section-nav">
            {SETTINGS_SECTIONS.map((item) => (
              <NavLink
                key={item.key}
                to={`/settings/${item.key}`}
                className={({ isActive }) => `settings-nav-link ${isActive ? "active" : ""}`}
              >
                <span>{item.label}</span>
                <small>{item.detail}</small>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="settings-main">
          {activeSection === "account" ? (
            <section className="settings-panel">
              <div className="settings-section-heading">
                <span className="settings-kicker">Account</span>
                <h2>Name and email</h2>
                <p>Keep your profile information current.</p>
              </div>

              <form className="settings-form" onSubmit={handleProfileSubmit} noValidate>
                <div className="settings-form-grid">
                  <label className="settings-field">
                    <span>Full name</span>
                    <input
                      className="settings-input"
                      value={profileForm.fullName}
                      onChange={(event) => {
                        setProfileForm((current) => ({
                          ...current,
                          fullName: event.target.value,
                        }));
                        setProfileError(null);
                        setNotice(null);
                      }}
                      autoComplete="name"
                      disabled={profileSaving}
                    />
                  </label>

                  <label className="settings-field">
                    <span>Email address</span>
                    <input
                      className={`settings-input ${profileRequiresPassword && profileError ? "has-error" : ""}`}
                      value={profileForm.email}
                      onChange={(event) => {
                        setProfileForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }));
                        setProfileError(null);
                        setNotice(null);
                      }}
                      autoComplete="email"
                      disabled={profileSaving}
                    />
                  </label>
                </div>

                <div className="settings-inline-note">
                  <div>
                    <strong>Email changes need your current password.</strong>
                    <span>Name changes can be saved directly.</span>
                  </div>
                  <button
                    className="settings-tertiary-button"
                    type="button"
                    onClick={() => setShowEmailPassword((current) => !current)}
                  >
                    {showEmailPassword || profileRequiresPassword ? "Hide confirmation" : "Confirm email change"}
                  </button>
                </div>

                {showEmailPassword || profileRequiresPassword ? (
                  <label className="settings-field">
                    <span>Current password</span>
                    <div className={`settings-password-shell ${profileRequiresPassword && profileError ? "has-error" : ""}`}>
                      <input
                        className="settings-input settings-password-input"
                        type={showProfileCurrentPassword ? "text" : "password"}
                        value={profileForm.currentPassword}
                        onChange={(event) => {
                          setProfileForm((current) => ({
                            ...current,
                            currentPassword: event.target.value,
                          }));
                          setProfileError(null);
                        }}
                        autoComplete="current-password"
                        disabled={profileSaving}
                      />
                      <button
                        className="settings-password-toggle"
                        type="button"
                        onClick={() => setShowProfileCurrentPassword((current) => !current)}
                      >
                        {showProfileCurrentPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </label>
                ) : null}

                {profileError ? (
                  <div className="settings-inline-error" role="alert">
                    {profileError}
                  </div>
                ) : null}

                <div className="settings-form-actions">
                  <button
                    className="settings-secondary-button"
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
                    Reset
                  </button>
                  <button
                    className="settings-primary-button"
                    type="submit"
                    disabled={profileSaving || !profileCanSave}
                  >
                    {profileSaving ? "Saving..." : "Save account"}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {activeSection === "security" ? (
            <section className="settings-panel">
              <div className="settings-section-heading">
                <span className="settings-kicker">Security</span>
                <h2>Password and sign-in</h2>
                <p>Update your password and review recent sign-in details.</p>
              </div>

              <div className="settings-metric-grid">
                <div className="settings-metric">
                  <span>Last sign-in</span>
                  <strong>{formatDateTime(activeProfile.lastLoginAt)}</strong>
                </div>
                <div className="settings-metric">
                  <span>Sign-in source</span>
                  <strong>{activeProfile.lastLoginIp ? `IP ${activeProfile.lastLoginIp}` : "Unavailable"}</strong>
                </div>
              </div>

              <form className="settings-form" onSubmit={handlePasswordSubmit} noValidate>
                <label className="settings-field">
                  <span>Current password</span>
                  <div className={`settings-password-shell ${showCurrentPasswordError || passwordError ? "has-error" : ""}`}>
                    <input
                      className="settings-input settings-password-input"
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
                      autoComplete="current-password"
                      disabled={passwordSaving}
                    />
                    <button
                      className="settings-password-toggle"
                      type="button"
                      onClick={() => setShowCurrentPassword((current) => !current)}
                    >
                      {showCurrentPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {showCurrentPasswordError ? (
                    <p className="settings-field-error" role="alert">
                      Enter your current password.
                    </p>
                  ) : null}
                </label>

                <div className="settings-form-grid">
                  <label className="settings-field">
                    <span>New password</span>
                    <div className={`settings-password-shell ${showPasswordError ? "has-error" : ""}`}>
                      <input
                        className="settings-input settings-password-input"
                        type={showNewPassword ? "text" : "password"}
                        value={passwordForm.newPassword}
                        onChange={(event) => {
                          setPasswordForm((current) => ({
                            ...current,
                            newPassword: event.target.value,
                          }));
                          setPasswordError(null);
                        }}
                        autoComplete="new-password"
                        disabled={passwordSaving}
                      />
                      <button
                        className="settings-password-toggle"
                        type="button"
                        onClick={() => setShowNewPassword((current) => !current)}
                      >
                        {showNewPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </label>

                  <label className="settings-field">
                    <span>Confirm new password</span>
                    <div className={`settings-password-shell ${(showConfirmRequired || showPasswordMismatch) ? "has-error" : ""}`}>
                      <input
                        className="settings-input settings-password-input"
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordForm.confirmPassword}
                        onChange={(event) => {
                          setPasswordForm((current) => ({
                            ...current,
                            confirmPassword: event.target.value,
                          }));
                          setPasswordError(null);
                        }}
                        autoComplete="new-password"
                        disabled={passwordSaving}
                      />
                      <button
                        className="settings-password-toggle"
                        type="button"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                      >
                        {showConfirmPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </label>
                </div>

                <div className="settings-password-strength">
                  <div>
                    <span>Password strength</span>
                    <strong className={`is-${passwordStrength.tone}`}>{passwordStrength.label}</strong>
                  </div>
                  <div className="settings-password-strength-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={passwordStrength.progress}>
                    <span
                      className={`settings-password-strength-fill is-${passwordStrength.tone}`}
                      style={{ width: `${passwordStrength.progress}%` }}
                    />
                  </div>
                </div>

                <div className="settings-password-guidance" role="note">
                  <span>Password must include:</span>
                  <ul>
                    {passwordStrength.criteria.map((criterion) => (
                      <li key={criterion.key} className={criterion.satisfied ? "is-satisfied" : "is-pending"}>
                        {criterion.label}
                      </li>
                    ))}
                  </ul>
                </div>

                {showPasswordError ? (
                  <p className="settings-field-error" role="alert">
                    Use at least {MIN_PASSWORD_LENGTH} characters with uppercase, lowercase, and a number.
                  </p>
                ) : null}
                {!showPasswordError && showConfirmRequired ? (
                  <p className="settings-field-error" role="alert">
                    Confirm your new password.
                  </p>
                ) : null}
                {!showPasswordError && !showConfirmRequired && showPasswordMismatch ? (
                  <p className="settings-field-error" role="alert">
                    Passwords must match.
                  </p>
                ) : null}
                {passwordError ? (
                  <div className="settings-inline-error" role="alert">
                    {passwordError}
                  </div>
                ) : null}

                <div className="settings-form-actions">
                  <button
                    className="settings-secondary-button"
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
                  <button className="settings-primary-button" type="submit" disabled={passwordSaving}>
                    {passwordSaving ? "Updating..." : "Update password"}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {activeSection === "access" ? (
            <section className="settings-panel">
              <div className="settings-section-heading">
                <span className="settings-kicker">Access</span>
                <h2>Role and permissions</h2>
                <p>Your access level is managed by approved portal administrators.</p>
              </div>

              <dl className="settings-access-grid">
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span className={`settings-status-pill is-${(activeProfile.status || "APPROVED").toLowerCase()}`}>
                      {formatStatusLabel(activeProfile.status)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Approved on</dt>
                  <dd>{formatDateOnly(activeProfile.approvedAt)}</dd>
                </div>
                <div>
                  <dt>Current email</dt>
                  <dd>{activeProfile.email}</dd>
                </div>
              </dl>

              <div className="settings-role-list">
                {(activeProfile.roles || []).length > 0 ? (
                  activeProfile.roles.map((role) => (
                    <article key={role} className="settings-role-card">
                      <span>{getRoleLabel(role)}</span>
                      <p>{getRoleDescription(role)}</p>
                    </article>
                  ))
                ) : (
                  <article className="settings-role-card">
                    <span>No role assigned</span>
                    <p>Ask a chair or administrator to review your access.</p>
                  </article>
                )}
              </div>
            </section>
          ) : null}

          {activeSection === "preferences" ? (
            <section className="settings-panel">
              <div className="settings-section-heading">
                <span className="settings-kicker">Preferences</span>
                <h2>Display defaults</h2>
                <p>Set how dense portal lists should feel by default.</p>
              </div>

              <form className="settings-form" onSubmit={handlePreferencesSubmit} noValidate>
                <fieldset className="settings-choice-group">
                  <legend>Layout density</legend>
                  <div className="settings-choice-grid">
                    {(["COMFORTABLE", "COMPACT"] as LayoutDensity[]).map((density) => (
                      <label key={density} className="settings-choice-card">
                        <input
                          type="radio"
                          name="layoutDensity"
                          value={density}
                          checked={preferencesForm.layoutDensity === density}
                          onChange={() => {
                            setPreferencesForm((current) => ({
                              ...current,
                              layoutDensity: density,
                            }));
                            setPreferencesError(null);
                            setNotice(null);
                          }}
                        />
                        <span>{density === "COMFORTABLE" ? "Comfortable" : "Compact"}</span>
                        <small>
                          {density === "COMFORTABLE"
                            ? "More breathing room for repeated review work."
                            : "Tighter rows for scanning larger lists."}
                        </small>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="settings-choice-group">
                  <legend>Default rows per page</legend>
                  <div className="settings-segmented-control">
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <label key={size}>
                        <input
                          type="radio"
                          name="defaultPageSize"
                          value={size}
                          checked={preferencesForm.defaultPageSize === size}
                          onChange={() => {
                            setPreferencesForm((current) => ({
                              ...current,
                              defaultPageSize: size,
                            }));
                            setPreferencesError(null);
                            setNotice(null);
                          }}
                        />
                        <span>{size}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {preferencesError ? (
                  <div className="settings-inline-error" role="alert">
                    {preferencesError}
                  </div>
                ) : null}

                <div className="settings-form-actions">
                  <button
                    className="settings-secondary-button"
                    type="button"
                    onClick={() => {
                      setPreferencesForm(currentPreferences);
                      setPreferencesError(null);
                      setNotice(null);
                    }}
                    disabled={preferencesSaving || !preferencesDirty}
                  >
                    Reset
                  </button>
                  <button
                    className="settings-primary-button"
                    type="submit"
                    disabled={preferencesSaving || !preferencesDirty}
                  >
                    {preferencesSaving ? "Saving..." : "Save preferences"}
                  </button>
                </div>
              </form>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
