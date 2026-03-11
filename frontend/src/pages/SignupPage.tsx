import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { BRAND } from "@/config/branding";
import "../styles/login.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof process !== "undefined" ? process.env?.VITE_API_URL : undefined) ||
  "http://localhost:3000";

export default function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    if (!trimmedFirstName || !trimmedLastName) {
      setError("First name and last name are required.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/auth/signup`, {
        fullName: `${trimmedFirstName} ${trimmedLastName}`,
        email,
        password,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Signup failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-grain" aria-hidden="true" />
      <div className="login-particles" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span><span></span><span></span>
      </div>

      <div className="login-shell signup-shell">
        <section className="login-intro signup-intro">
          <div className="login-logo">
            <img src="/urerblogo.png" alt="URERB Portal" className="login-logo-img" />
          </div>
          <h1>Join {BRAND.name} Portal</h1>
          <p>
            Create your account to start collaborating on protocol reviews. New registrations are
            placed in pending status until approved by the chair.
          </p>
        </section>

        <aside className="login-card signup-card" role="region" aria-label="Sign up">
          <div className="login-cardHeader signup-card-header">
            <p className="login-greeting">Create account</p>
            <h2>Sign up only</h2>
            <p>Your account will be activated after chair approval.</p>
          </div>

          {submitted ? (
            <div className="login-warning" role="status">
              Sign-up submitted. Please wait for chair approval before logging in.
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
                  <div className="login-control">
                    <input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Juan"
                      required
                    />
                  </div>
                </div>

                <div className="login-field signup-field">
                  <label htmlFor="lastName">Last name</label>
                  <div className="login-control">
                    <input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Dela Cruz"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="login-field signup-field">
                <label htmlFor="email">Email</label>
                <div className="login-control">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@dlsu.edu.ph"
                    required
                  />
                </div>
              </div>

              <div className="login-field signup-field">
                <label htmlFor="password">Password</label>
                <div className="login-control">
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                  />
                </div>
              </div>

              <div className="login-field signup-field">
                <label htmlFor="confirmPassword">Confirm password</label>
                <div className="login-control">
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    minLength={8}
                    required
                  />
                </div>
              </div>

              <button className="login-btn signup-btn" type="submit" disabled={loading}>
                {loading ? "Submitting..." : "Submit for Approval"}
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
