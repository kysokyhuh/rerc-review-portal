import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authApi, ensureCsrfCookie } from "@/services/api";
import { BRAND } from "@/config/branding";
import {
  getPasswordStrength,
  MIN_PASSWORD_LENGTH,
  passwordMeetsRules,
} from "@/utils/passwordStrength";
import "../styles/login.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [firstNameTouched, setFirstNameTouched] = useState(false);
  const [lastNameTouched, setLastNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const trimmedFirstName = firstName.trim();
  const trimmedLastName = lastName.trim();
  const trimmedEmail = email.trim();
  const emailValid = trimmedEmail.length === 0 ? null : EMAIL_REGEX.test(trimmedEmail);
  const passwordStrength = getPasswordStrength(password);
  const passwordMeetsClientRules = passwordMeetsRules(password);

  const showGroupedNameError = submitAttempted && !trimmedFirstName && !trimmedLastName;
  const showFirstNameError =
    !showGroupedNameError && !trimmedFirstName && (firstNameTouched || submitAttempted);
  const showLastNameError =
    !showGroupedNameError && !trimmedLastName && (lastNameTouched || submitAttempted);
  const showEmailError = emailValid === false && (emailTouched || submitAttempted);
  const showPasswordRequired =
    (passwordTouched || submitAttempted) && password.length === 0;
  const showPasswordRuleError =
    !showPasswordRequired && (passwordTouched || submitAttempted) && !passwordMeetsClientRules;
  const showConfirmRequired =
    (confirmPasswordTouched || submitAttempted) && confirmPassword.length === 0;
  const showConfirmMismatch =
    !showConfirmRequired &&
    (confirmPasswordTouched || submitAttempted) &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password !== confirmPassword;

  const firstNameInvalid = showGroupedNameError || showFirstNameError;
  const lastNameInvalid = showGroupedNameError || showLastNameError;
  const passwordInvalid = showPasswordRequired || showPasswordRuleError;
  const confirmPasswordInvalid = showConfirmRequired || showConfirmMismatch;
  const showPasswordGuide = passwordFocused;

  const emailDescribedBy = showEmailError
    ? "signup-email-help signup-email-error"
    : "signup-email-help";
  const firstNameDescribedBy = showGroupedNameError
    ? "signup-name-error"
    : showFirstNameError
      ? "signup-first-name-error"
      : undefined;
  const lastNameDescribedBy = showGroupedNameError
    ? "signup-name-error"
    : showLastNameError
      ? "signup-last-name-error"
      : undefined;

  useEffect(() => {
    void ensureCsrfCookie().catch(() => {});
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitAttempted(true);
    setFirstNameTouched(true);
    setLastNameTouched(true);
    setEmailTouched(true);
    setPasswordTouched(true);
    setConfirmPasswordTouched(true);

    if (
      !trimmedFirstName ||
      !trimmedLastName ||
      emailValid !== true ||
      !passwordMeetsClientRules ||
      confirmPassword.length === 0 ||
      password !== confirmPassword
    ) {
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.post("/auth/signup", {
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail,
        password,
        confirmPassword,
      });
      setSubmitAttempted(false);
      setSubmitted(true);
      setSuccessMessage(
        response.data?.message ?? "Your account has been submitted for approval."
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg signup-page-bg">
      <div className="login-grain" aria-hidden="true" />
      <div className="login-particles" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span><span></span><span></span>
      </div>

      <div className="login-shell signup-shell">
        <section className="login-intro signup-intro">
          <p className="login-kicker">
            <span className="login-dot" aria-hidden="true"></span>
            {BRAND.name}
          </p>
          <h1>{BRAND.tagline}</h1>
          <p className="login-intro-tagline">{BRAND.fullName}</p>
          <p className="login-intro-note">
            Access is limited to URERB users reviewed and approved by the chair.
          </p>
          <p>
            Create your portal account now. New signups stay pending until the chair reviews the
            request and assigns the final access role.
          </p>
          <div className="signup-trust" aria-label="Access request process">
            <div className="signup-trust-header">
              <div className="signup-trust-seal" aria-hidden="true">
                <span>UR</span>
              </div>
              <div>
                <p className="signup-trust-label">Approval process</p>
                <p className="signup-trust-text">Only approved accounts can sign in to the portal.</p>
              </div>
            </div>
            <ol className="signup-trust-steps">
              <li>
                <span className="signup-step-index" aria-hidden="true">1</span>
                <div>
                  <strong>Create account</strong>
                  <p>Provide your name, email address, and password.</p>
                </div>
              </li>
              <li>
                <span className="signup-step-index" aria-hidden="true">2</span>
                <div>
                  <strong>Chair review</strong>
                  <p>The chair reviews pending accounts and assigns the final role.</p>
                </div>
              </li>
              <li>
                <span className="signup-step-index" aria-hidden="true">3</span>
                <div>
                  <strong>Sign in after approval</strong>
                  <p>Once approved, you can log in directly with the password you created here.</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <aside className="login-card signup-card" role="region" aria-label="Create account">
          <div className="login-cardHeader signup-card-header">
            <p className="login-greeting">Authorized access only</p>
            <h2>Sign up for URERB access</h2>
            <p>Create your account now. Sign-in stays blocked until chair approval.</p>
          </div>

          <div className="signup-mobile-context" role="note">
            <strong>Chair approval required.</strong> Your account will stay pending until the chair reviews it.
          </div>

          {submitted ? (
            <div className="login-warning" role="status">
              {successMessage || "Your account has been submitted for approval."}
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="signup-form">
              {error ? (
                <div className="login-error" role="alert">
                  {error}
                </div>
              ) : null}

              <div className="signup-name-row">
                <div className="login-field signup-field">
                  <label htmlFor="firstName">First name</label>
                  <div className={`login-control ${firstNameInvalid ? "invalid" : ""}`}>
                    <input
                      id="firstName"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      onBlur={() => setFirstNameTouched(true)}
                      placeholder="Juan"
                      required
                      aria-invalid={firstNameInvalid}
                      aria-describedby={firstNameDescribedBy}
                    />
                  </div>
                  {showFirstNameError ? (
                    <p id="signup-first-name-error" className="login-field-error signup-inline-error" role="alert">
                      Enter your first name.
                    </p>
                  ) : null}
                </div>

                <div className="login-field signup-field">
                  <label htmlFor="lastName">Last name</label>
                  <div className={`login-control ${lastNameInvalid ? "invalid" : ""}`}>
                    <input
                      id="lastName"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      onBlur={() => setLastNameTouched(true)}
                      placeholder="Dela Cruz"
                      required
                      aria-invalid={lastNameInvalid}
                      aria-describedby={lastNameDescribedBy}
                    />
                  </div>
                  {showLastNameError ? (
                    <p id="signup-last-name-error" className="login-field-error signup-inline-error" role="alert">
                      Enter your last name.
                    </p>
                  ) : null}
                </div>
              </div>
              {showGroupedNameError ? (
                <p id="signup-name-error" className="login-field-error signup-row-error signup-inline-error" role="alert">
                  Enter your first and last name.
                </p>
              ) : null}

              <div className="login-field signup-field">
                <label htmlFor="email">Email</label>
                <div className={`login-control ${showEmailError ? "invalid" : ""}`}>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    placeholder="Enter your email"
                    required
                    aria-invalid={showEmailError}
                    aria-describedby={emailDescribedBy}
                  />
                </div>
                <p id="signup-email-help" className="login-help">
                  Use the email address for your URERB portal account.
                </p>
                {showEmailError ? (
                  <p id="signup-email-error" className="login-field-error signup-inline-error" role="alert">
                    Enter a valid email address.
                  </p>
                ) : null}
              </div>

              <div className="login-field signup-field">
                <label htmlFor="password">Password</label>
                <div className="signup-password-stack">
                  <div className={`login-control ${passwordInvalid ? "invalid" : ""}`}>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => {
                        setPasswordTouched(true);
                        setPasswordFocused(false);
                      }}
                      placeholder="Create a password"
                      autoComplete="new-password"
                      required
                      aria-invalid={passwordInvalid}
                      aria-describedby="signup-password-strength signup-password-error"
                    />
                    <button
                      className="login-toggle"
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-controls="password"
                      aria-pressed={showPassword}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? (
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
                  <div id="signup-password-strength" className="password-strength" aria-live="polite">
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
                  {showPasswordGuide ? (
                    <div
                      id="signup-password-help"
                      className="password-guide-card signup-password-popover"
                      role="note"
                    >
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
                  ) : null}
                </div>
                {showPasswordRequired ? (
                  <p id="signup-password-error" className="login-field-error signup-inline-error" role="alert">
                    Create a password.
                  </p>
                ) : null}
                {!showPasswordRequired && showPasswordRuleError ? (
                  <p id="signup-password-error" className="login-field-error signup-inline-error" role="alert">
                    Use at least {MIN_PASSWORD_LENGTH} characters with uppercase, lowercase, and a number.
                  </p>
                ) : null}
              </div>

              <div className="login-field signup-field">
                <label htmlFor="confirmPassword">Confirm password</label>
                <div className={`login-control ${confirmPasswordInvalid ? "invalid" : ""}`}>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    onBlur={() => setConfirmPasswordTouched(true)}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    required
                    aria-invalid={confirmPasswordInvalid}
                    aria-describedby="signup-confirm-password-error"
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
                  <p id="signup-confirm-password-error" className="login-field-error signup-inline-error" role="alert">
                    Confirm your password.
                  </p>
                ) : null}
                {!showConfirmRequired && showConfirmMismatch ? (
                  <p id="signup-confirm-password-error" className="login-field-error signup-inline-error" role="alert">
                    Passwords must match.
                  </p>
                ) : null}
              </div>

              <button className="login-btn signup-btn" type="submit" disabled={loading}>
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>
          )}

          <div className="login-support signup-support">
            <span className="login-footnote">
              Already have an account? <Link to="/login" className="login-support-link">Sign in here</Link>
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
