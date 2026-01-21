import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import '../styles/login.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!email.trim()) {
        throw new Error("Email is required");
      }
      // TODO: Replace with actual API call
      await new Promise<void>((resolve, reject) =>
        setTimeout(() => {
          if (!email.includes("@")) {
            reject(new Error("Invalid email address"));
          } else {
            resolve();
          }
        }, 1000)
      );
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-grain" aria-hidden="true"></div>

      <div className="login-shell" style={{ maxWidth: '480px' }}>
        <aside className="login-card" role="region" aria-label="Forgot password">
          <div className="login-cardHeader">
            <Link to="/login" className="login-back-link">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
              </svg>
              Back to login
            </Link>
            <h2>Forgot password?</h2>
            <p>Enter your email and we'll send you instructions to reset your password.</p>
          </div>

          {submitted ? (
            <div className="login-card-body">
              <div className="login-success">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <h3>Check your email</h3>
                <p>
                  We've sent password reset instructions to <strong>{email}</strong>. 
                  Check your inbox and follow the link to reset your password.
                </p>
                <p className="login-footnote" style={{ marginTop: '16px' }}>
                  Didn't receive the email? Check your spam folder or{' '}
                  <button 
                    className="login-link-btn" 
                    onClick={() => setSubmitted(false)}
                  >
                    try again
                  </button>
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {error && <div className="login-error">{error}</div>}

              <div className="login-field">
                <label htmlFor="email">Email address</label>
                <div className="login-control">
                  <svg className="login-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z"/>
                  </svg>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="name@dlsu.edu.ph"
                    required
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? (
                  <span className="login-spinner">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" opacity="0.25"/>
                      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Send reset link'
                )}
              </button>

              <div className="login-divider" role="separator" aria-hidden="true"></div>
              <div className="login-footnote" style={{ textAlign: 'center' }}>
                Remember your password?{' '}
                <Link to="/login" className="login-link">Sign in</Link>
              </div>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
