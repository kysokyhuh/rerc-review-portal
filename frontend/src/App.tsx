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
import ImportProjectsPage from "@/pages/ImportProjectsPage";
import NewProtocolPage from "@/pages/NewProtocolPage";
import ArchivesPage from "@/pages/ArchivesPage";
import ReportsPage from "@/pages/ReportsPage";
import QueuePage from "@/pages/QueuePage";
import HolidaysPage from "@/pages/HolidaysPage";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import DashboardShell from "@/components/DashboardShell";

// Layout wrapper that conditionally shows nav/footer
function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/forgot-password";
  const isDashboardShell =
    location.pathname === "/dashboard" ||
    location.pathname.startsWith("/queues/") ||
    location.pathname.startsWith("/holidays");

  // Don't show nav/footer on auth pages or new dashboard (has its own layout)
  if (isAuthPage || isDashboardShell) {
    return <>{children}</>;
  }

  return (
    <div className="app-container">
      <main className="app-main">{children}</main>

      <footer className="app-footer">
        <p>&copy; 2026 RERC Review Portal. All rights reserved.</p>
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

          {/* Dashboard shell — sidebar persists across these routes */}
          <Route element={<DashboardShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/queues/:queueKey" element={<QueuePage />} />
            <Route path="/holidays" element={<HolidaysPage />} />
          </Route>

          <Route path="/projects/new" element={<NewProtocolPage />} />
          <Route path="/imports/projects" element={<ImportProjectsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/archives" element={<ArchivesPage />} />
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
