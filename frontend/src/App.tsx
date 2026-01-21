import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { DashboardPage } from "@/pages/DashboardPageNew";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { SubmissionDetailPage } from "@/pages/SubmissionDetailPage";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";

// Layout wrapper that conditionally shows nav/footer
function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/forgot-password";
  const isDashboard = location.pathname === "/dashboard";

  // Don't show nav/footer on auth pages or new dashboard (has its own layout)
  if (isAuthPage || isDashboard) {
    return <>{children}</>;
  }

  return (
    <div className="app-container">
      <main className="app-main">{children}</main>

      <footer className="app-footer">
        <p>&copy; 2025 RERC Review Portal. All rights reserved.</p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route
            path="/projects/:projectId"
            element={<ProjectDetailPage />}
          />
          <Route
            path="/submissions/:submissionId"
            element={<SubmissionDetailPage />}
          />
        </Routes>
      </AppLayout>
    </Router>
  );
}

export default App;
