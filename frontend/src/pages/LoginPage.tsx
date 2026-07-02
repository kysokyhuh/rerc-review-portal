import { useState, useEffect, FormEvent, KeyboardEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BRAND } from "@/config/branding";
import { useAuth } from "@/contexts/AuthContext";
import { ensureCsrfCookie, getSafeNextPath } from "@/services/api";
import { getErrorData } from "@/utils";
import "../styles/login.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login: authLogin } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [success, setSuccess] = useState(false);
  const [greeting] = useState(getGreeting());

  useEffect(() => {
    void ensureCsrfCookie().catch(() => {});
    if (searchParams.get("expired") === "true") {
      setSessionExpired(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (email.length === 0) {
      setEmailValid(null);
      return;
    }
    setEmailValid(EMAIL_REGEX.test(email));
  }, [email]);

  const showEmailError = emailTouched && emailValid === false;
  const showPasswordError = passwordTouched && password.length === 0;
  const showGlobalError = Boolean(error) && !sessionExpired;
  const emailDescribedBy = showEmailError ? "email-help email-error" : "email-help";
  const passwordDescribedBy = [
    "password-help",
    showPasswordError ? "password-error" : "",
    capsLock ? "password-caps" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const canSubmit =
    !loading && email.length > 0 && password.length > 0 && emailValid === true;

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState("CapsLock"));
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const navigateAfterAuth = async (
    user: { roles: string[] },
    mustChangePassword: boolean
  ) => {
    const nextPath = getSafeNextPath(searchParams.get("next"));

    setSuccess(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const doNavigate = () => {
      if (mustChangePassword) {
        navigate("/change-password", { replace: true, state: { fromLogin: true } });
        return;
      }

      if (nextPath) {
        navigate(nextPath, { replace: true, state: { fromLogin: true } });
        return;
      }

      if (user.roles.includes("CHAIR") || user.roles.includes("ADMIN")) {
        navigate("/admin/account-management", {
          replace: true,
          state: { fromLogin: true },
        });
        return;
      }

      navigate("/dashboard", { replace: true, state: { fromLogin: true } });
    };

    const anyDocument = document as Document & {
      startViewTransition?: (callback: () => void) => void;
    };
    if (typeof anyDocument.startViewTransition === "function") {
      anyDocument.startViewTransition(doNavigate);
    } else {
      doNavigate();
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSessionExpired(false);
    setEmailTouched(true);
    setPasswordTouched(true);

    if (emailValid !== true || password.length === 0) {
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const result = await authLogin(email, password);
      await navigateAfterAuth(result.user, result.mustChangePassword);
    } catch (err: unknown) {
      const apiMessage = getErrorData(err)?.message;
      setError(apiMessage ?? "Invalid email or password.");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      {loading ? <div className="login-loading-bar" /> : null}

      {success ? (
        <div className="login-success-overlay">
          <div className="login-success-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" className="login-success-circle" />
              <path
                d="M8 12l2.5 2.5L16 9"
                className="login-success-check"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p>Welcome back!</p>
        </div>
      ) : null}

      <a href="#login-form" className="login-skip">
        Skip to login form
      </a>

      <div className="login-grain" aria-hidden="true"></div>
      <div className="login-particles" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span><span></span><span></span>
      </div>

      <div className="login-shell">
        <section className="login-intro">
          <p className="login-kicker">
            <span className="login-dot" aria-hidden="true"></span>
            {BRAND.name}
          </p>
          <h1>{BRAND.tagline}</h1>
          <p className="login-intro-tagline">{BRAND.fullName}</p>
          <p>
            Restricted access for protocol intake, review coordination, and committee records.
          </p>
          <p className="login-intro-note">
            Only chair-approved account holders can sign in.
          </p>
        </section>

        <aside className={`login-card ${shake ? "shake" : ""}`} role="region" aria-label="Sign in">
          <div className="login-cardHeader">
            <p className="login-greeting">{greeting}.</p>
            <h2>Sign in to {BRAND.name} Portal</h2>
            <p>Enter the email and password for your approved URERB account.</p>
          </div>

          <form id="login-form" onSubmit={handleSubmit} noValidate>
            {sessionExpired ? (
              <div className="login-warning" role="status" aria-live="polite">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                Your session has expired. Please log in again.
              </div>
            ) : null}

            {showGlobalError ? (
              <div className="login-error" role="alert" aria-live="assertive">
                {error}
              </div>
            ) : null}

            <div className="login-field">
              <label htmlFor="email">Email</label>
              <div className={`login-control ${showEmailError ? "invalid" : ""} ${emailValid === true ? "valid" : ""}`}>
                <svg className="login-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z" />
                </svg>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  placeholder="Enter your email"
                  required
                  spellCheck={false}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  aria-invalid={showEmailError}
                  aria-describedby={emailDescribedBy}
                />
                {emailValid === true ? (
                  <svg className="login-valid-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                ) : null}
              </div>
              <p id="email-help" className="login-help">
                Use the email address associated with your approved URERB account.
              </p>
              {showEmailError ? (
                <p id="email-error" className="login-field-error" role="alert">
                  Enter a valid email address.
                </p>
              ) : null}
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <div className={`login-control ${capsLock ? "caps-warning" : ""}`}>
                <svg className="login-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm-3 8V6a3 3 0 0 1 6 0v3H9z" />
                </svg>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyDown}
                  aria-invalid={showPasswordError}
                  aria-describedby={passwordDescribedBy}
                />
                <button
                  className="login-toggle"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-controls="password"
                  aria-pressed={showPassword}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                      <circle cx="12" cy="12" r="3.5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 3l18 18" />
                      <path d="M10.5 6.5A9.7 9.7 0 0 1 12 6c6.5 0 10 6 10 6a17.3 17.3 0 0 1-4.2 4.6" />
                      <path d="M6.6 6.6A17.2 17.2 0 0 0 2 12s3.5 6 10 6a9.6 9.6 0 0 0 3.1-.5" />
                      <circle cx="12" cy="12" r="3.5" />
                    </svg>
                  )}
                </button>
              </div>
              <p id="password-help" className="login-help">
                Enter the password for your approved URERB account. Passwords are case-sensitive.
              </p>
              {capsLock ? (
                <div id="password-caps" className="login-caps-warning">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L4 14h6v8h4v-8h6L12 2z" />
                  </svg>
                  Caps Lock is on
                </div>
              ) : null}
              {showPasswordError ? (
                <p id="password-error" className="login-field-error" role="alert">
                  Password is required.
                </p>
              ) : null}
            </div>

            <div className="login-row">
              <label className="login-remember">
                <input
                  type="checkbox"
                  name="remember"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                Stay signed in on this device
              </label>
            </div>

            <button className="login-btn" type="submit" disabled={!canSubmit}>
              {loading ? (
                <span className="login-spinner">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Log in"
              )}
            </button>

            <p className="login-signup login-access-note">
              Need access? <Link to="/signup">Create an account</Link>
            </p>

            <div className="login-divider" role="separator" aria-hidden="true"></div>
            <div className="login-footnote">
              Authorized users only. Activity may be monitored for security, audit, and compliance.
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
