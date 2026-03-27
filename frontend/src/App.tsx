import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ColdStartToast } from "@/components/ColdStartToast";
import { DashboardPage } from "@/pages/DashboardPageNew";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { SubmissionDetailPage } from "@/pages/SubmissionDetailPage";
import ImportProjectsPage from "@/pages/ImportProjectsPage";
import NewProtocolPage from "@/pages/NewProtocolPage";
import NewProtocolClassicPage from "@/pages/NewProtocolClassicPage";
import ArchivesPage from "@/pages/ArchivesPage";
import ReportsPage from "@/pages/ReportsPage";
import QueuePage from "@/pages/QueuePage";
import ExemptedPage from "@/pages/ExemptedPage";
import HolidaysPage from "@/pages/HolidaysPage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import ChangePasswordPage from "@/pages/ChangePasswordPage";
import AdminAccountManagementPage from "@/pages/AdminAccountManagementPage";
import NotAuthorizedPage from "@/pages/NotAuthorizedPage";
import DashboardShell from "@/components/DashboardShell";

// Layout wrapper that conditionally shows nav/footer
function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isAuthPage =
    location.pathname === "/login" ||
    location.pathname === "/signup" ||
    location.pathname === "/change-password";
  const isDashboardShell =
    location.pathname === "/dashboard" ||
    location.pathname.startsWith("/queues/") ||
    location.pathname.startsWith("/holidays") ||
    location.pathname.startsWith("/admin/");

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
      <AuthProvider>
        <ErrorBoundary>
          <ColdStartToast />
          <AppLayout>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route
                path="/change-password"
                element={
                  <ProtectedRoute allowForcedPasswordChange>
                    <ChangePasswordPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/not-authorized" element={<NotAuthorizedPage />} />

              {/* Protected: Dashboard shell */}
              <Route
                element={
                  <ProtectedRoute>
                    <DashboardShell />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route
                  path="/queues/exempted"
                  element={
                    <ProtectedRoute allowedRoles={["CHAIR", "RESEARCH_ASSOCIATE"]}>
                      <ExemptedPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/queues/:queueKey" element={<QueuePage />} />
                <Route path="/holidays" element={<HolidaysPage />} />
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute allowedRoles={["CHAIR", "ADMIN"]}>
                      <Navigate to="/admin/account-management" replace />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/account-management"
                  element={
                    <ProtectedRoute allowedRoles={["CHAIR", "ADMIN"]}>
                      <AdminAccountManagementPage />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* Protected: standalone pages */}
              <Route
                path="/projects/new"
                element={
                  <ProtectedRoute>
                    <NewProtocolPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/new-classic"
                element={
                  <ProtectedRoute>
                    <NewProtocolClassicPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/imports/projects"
                element={
                  <ProtectedRoute allowedRoles={["CHAIR", "RESEARCH_ASSOCIATE"]}>
                    <ImportProjectsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={["CHAIR", "RESEARCH_ASSOCIATE"]}>
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/archives"
                element={
                  <ProtectedRoute>
                    <ArchivesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/:projectId"
                element={
                  <ProtectedRoute>
                    <ProjectDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/submissions/:submissionId"
                element={
                  <ProtectedRoute>
                    <SubmissionDetailPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AppLayout>
        </ErrorBoundary>
      </AuthProvider>
    </Router>
  );
}

export default App;
