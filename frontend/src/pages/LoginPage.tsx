import { useState, useEffect, FormEvent, KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BRAND } from '@/config/branding';
import '../styles/login.css';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limiting
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 60000; // 1 minute

// Get greeting based on time of day
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  
  // UI state
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [success, setSuccess] = useState(false);
  const [greeting] = useState(getGreeting());
  
  // Rate limiting state
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Check for session expired param
  useEffect(() => {
    if (searchParams.get('expired') === 'true') {
      setSessionExpired(true);
    }
  }, [searchParams]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockedUntil) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, lockedUntil - Date.now());
        setLockoutRemaining(Math.ceil(remaining / 1000));
        if (remaining <= 0) {
          setLockedUntil(null);
          setAttempts(0);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockedUntil]);

  // Email validation
  useEffect(() => {
    if (email.length === 0) {
      setEmailValid(null);
    } else {
      setEmailValid(EMAIL_REGEX.test(email));
    }
  }, [email]);

  const emailDomainValid =
    email.length === 0 ? null : email.toLowerCase().endsWith("@dlsu.edu.ph");
  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  const showEmailError =
    emailTouched && (!emailValid || emailDomainValid === false);
  const emailErrorText = !emailValid
    ? "Enter a valid email address."
    : `Please use your assigned ${BRAND.name} email address.`;
  const showPasswordError = passwordTouched && password.length === 0;
  const canSubmit =
    !loading &&
    !isLocked &&
    email.length > 0 &&
    password.length > 0 &&
    emailValid === true &&
    emailDomainValid === true;

  // Detect Caps Lock
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState('CapsLock'));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSessionExpired(false);
    setEmailTouched(true);
    setPasswordTouched(true);

    // Check lockout
    if (lockedUntil && Date.now() < lockedUntil) {
      return;
    }

    if (!emailValid || emailDomainValid === false || password.length === 0) {
      setError("Please check the highlighted fields.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setLoading(true);

    // TODO: Replace with actual API call once backend auth is implemented
    try {
      // Simulate login - remove this when backend is ready
      await new Promise((resolve) => setTimeout(resolve, 800));
      
      // Simulate validation (for demo, accept any @dlsu.edu.ph email)
      if (!email.endsWith('@dlsu.edu.ph')) {
        throw new Error('Invalid credentials');
      }

      // Store last login time
      localStorage.setItem('lastLogin', new Date().toISOString());
      
      // Show success animation
      setSuccess(true);
      
      // Wait for animation then redirect
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const doNavigate = () =>
        navigate("/dashboard", { replace: true, state: { fromLogin: true } });

      const anyDocument = document as unknown as {
        startViewTransition?: (callback: () => void) => void;
      };
      if (typeof anyDocument.startViewTransition === "function") {
        anyDocument.startViewTransition(doNavigate);
      } else {
        doNavigate();
      }
    } catch (err) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_DURATION);
        setError(`Too many failed attempts. Please try again in 1 minute.`);
      } else {
        setError(`Invalid email or password. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`);
      }
      
      // Trigger shake animation
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      {/* Top loading bar */}
      {loading && <div className="login-loading-bar" />}
      
      {/* Success overlay */}
      {success && (
        <div className="login-success-overlay">
          <div className="login-success-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" className="login-success-circle" />
              <path d="M8 12l2.5 2.5L16 9" className="login-success-check" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p>Welcome back!</p>
        </div>
      )}
      
      {/* Skip to main content for accessibility */}
      <a href="#login-form" className="login-skip">Skip to login form</a>
      
      <div className="login-grain" aria-hidden="true"></div>
      
      {/* Floating particles */}
      <div className="login-particles" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span><span></span><span></span>
      </div>

      <div className="login-shell">
        <section className="login-intro">
          <div className="login-logo">
            <img src="/urerblogo.png" alt="URERB Portal" className="login-logo-img" />
          </div>
        </section>

        <aside className={`login-card ${shake ? 'shake' : ''}`} role="region" aria-label="Sign in">
          <div className="login-cardHeader">
            <p className="login-greeting">{greeting}.</p>
            <h2>Sign in to {BRAND.name} Portal</h2>
            <p>Enter your {BRAND.name} email and password.</p>
          </div>

          <form id="login-form" onSubmit={handleSubmit} noValidate>
            {/* Session expired notice */}
            {sessionExpired && (
              <div className="login-warning">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                Your session has expired. Please log in again.
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <div className="login-field">
              <label htmlFor="email">Email</label>
              <div className={`login-control ${showEmailError ? 'invalid' : ''} ${emailValid === true ? 'valid' : ''}`}>
                <svg className="login-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z"/>
                </svg>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  placeholder="name@dlsu.edu.ph"
                  required
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  aria-invalid={showEmailError}
                  aria-describedby="email-help email-error"
                  disabled={isLocked}
                />
                {emailValid === true && (
                  <svg className="login-valid-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                )}
              </div>
              <p id="email-help" className="login-help">
                Use your assigned {BRAND.name} email (e.g., @dlsu.edu.ph).
              </p>
              {showEmailError && (
                <p id="email-error" className="login-field-error" role="alert">
                  {emailErrorText}
                </p>
              )}
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <div className={`login-control ${capsLock ? 'caps-warning' : ''}`}>
                <svg className="login-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm-3 8V6a3 3 0 0 1 6 0v3H9z"/>
                </svg>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyDown}
                  aria-invalid={showPasswordError}
                  aria-describedby="password-error"
                  disabled={isLocked}
                />
                <button
                  className="login-toggle"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-controls="password"
                  aria-pressed={showPassword}
                  aria-label="Toggle password visibility"
                  disabled={isLocked}
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
              {capsLock && (
                <div className="login-caps-warning">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L4 14h6v8h4v-8h6L12 2z"/>
                  </svg>
                  Caps Lock is on
                </div>
              )}
              {showPasswordError && (
                <p id="password-error" className="login-field-error" role="alert">
                  Password is required.
                </p>
              )}
            </div>

            <div className="login-row">
              <label className="login-remember">
                <input
                  type="checkbox"
                  name="remember"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={isLocked}
                />
                Stay signed in on this device
              </label>
              <a className="login-link" href="/forgot-password">Forgot your password?</a>
            </div>

            <button 
              className="login-btn" 
              type="submit" 
              disabled={!canSubmit}
            >
              {loading ? (
                <span className="login-spinner">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" opacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                  </svg>
                  Signing in...
                </span>
              ) : isLocked ? (
                `Try again in ${lockoutRemaining}s`
              ) : (
                'Log in'
              )}
            </button>

            <div className="login-divider" role="separator" aria-hidden="true"></div>
            <div className="login-footnote">
              Authorized users only. Activity may be monitored for compliance and security.
              If you believe you should have access, contact the {BRAND.name} Secretariat.
            </div>
          </form>
          <div className="login-support">
            <a href={`mailto:${BRAND.supportEmail}`} className="login-support-link">
              Need help? Contact the {BRAND.name} admin team
            </a>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="login-footer">
        <div className="login-footer-left">
          <span className="login-footer-status">
            <span className="login-footer-dot"></span>
            System Online
          </span>
          <span className="login-footer-version">v1.0.0</span>
        </div>
        <div className="login-footer-right">
          <a href={`mailto:${BRAND.supportEmail}`} className="login-footer-link">
            Contact {BRAND.name} admin
          </a>
        </div>
      </footer>
    </div>
  );
}
