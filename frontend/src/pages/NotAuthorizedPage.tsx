import { Link } from "react-router-dom";

export default function NotAuthorizedPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Not authorized</h1>
      <p>Your account does not have permission to access this page.</p>
      <p>
        <Link to="/dashboard">Back to dashboard</Link>
      </p>
    </div>
  );
}
