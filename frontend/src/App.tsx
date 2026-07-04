import React, { Suspense, lazy } from "react";
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
import DashboardShell from "@/components/DashboardShell";

const DashboardPage = lazy(() =>
  import("@/pages/DashboardPageNew").then((module) => ({ default: module.DashboardPage }))
);
const ProjectDetailPage = lazy(() =>
  import("@/pages/ProjectDetailPage").then((module) => ({ default: module.ProjectDetailPage }))
);
const SubmissionDetailPage = lazy(() =>
  import("@/pages/SubmissionDetailPage").then((module) => ({
    default: module.SubmissionDetailPage,
  }))
);
const ImportCsvPage = lazy(() => import("@/pages/ImportCsvPage"));
const ImportProjectsPage = lazy(() => import("@/pages/ImportProjectsPage"));
const ImportClassificationsPage = lazy(() => import("@/pages/ImportClassificationsPage"));
const NewProtocolPage = lazy(() => import("@/pages/NewProtocolPage"));
const NewProtocolClassicPage = lazy(() => import("@/pages/NewProtocolClassicPage"));
const ArchivesPage = lazy(() => import("@/pages/ArchivesPage"));
const RecentlyDeletedPage = lazy(() => import("@/pages/RecentlyDeletedPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const QueuePage = lazy(() => import("@/pages/QueuePage"));
const ExemptedPage = lazy(() => import("@/pages/ExemptedPage"));
const CalendarPage = lazy(() => import("@/pages/CalendarPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const SignupPage = lazy(() => import("@/pages/SignupPage"));
const ChangePasswordPage = lazy(() => import("@/pages/ChangePasswordPage"));
const AdminAccountManagementPage = lazy(() => import("@/pages/AdminAccountManagementPage"));
const PanelManagementPage = lazy(() => import("@/pages/PanelManagementPage"));
const MyProfilePage = lazy(() => import("@/pages/MyProfilePage"));
const NotAuthorizedPage = lazy(() => import("@/pages/NotAuthorizedPage"));

function RouteFallback() {
  return (
    <div className="route-skeleton" aria-busy="true" aria-label="Loading page">
      <div className="route-skeleton-shell">
        <aside className="route-skeleton-sidebar" aria-hidden="true">
          <span className="skeleton-pill" />
          <div style={{ display: "grid", gap: 12, marginTop: 28 }}>
            <span className="skeleton-line" />
            <span className="skeleton-line" style={{ width: "78%" }} />
            <span className="skeleton-line" style={{ width: "86%" }} />
            <span className="skeleton-line" style={{ width: "64%" }} />
          </div>
        </aside>
        <main className="route-skeleton-main" aria-hidden="true">
          <div className="route-skeleton-header">
            <span className="skeleton-pill" />
            <span className="skeleton-line" style={{ height: 22, width: "68%" }} />
            <span className="skeleton-line" style={{ width: "44%" }} />
          </div>
          <div className="route-skeleton-grid">
            <span className="skeleton-card" />
            <span className="skeleton-card" />
            <span className="skeleton-card" />
          </div>
          <span className="skeleton-card route-skeleton-table" />
        </main>
      </div>
    </div>
  );
}

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
    location.pathname.startsWith("/calendar") ||
    location.pathname.startsWith("/admin/") ||
    location.pathname.startsWith("/account/");

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
          <Suspense fallback={<RouteFallback />}>
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
                  <Route path="/holidays" element={<Navigate to="/calendar" replace />} />
                  <Route
                    path="/calendar"
                    element={
                      <ProtectedRoute allowedRoles={["CHAIR", "RESEARCH_ASSOCIATE", "ADMIN"]}>
                        <CalendarPage />
                      </ProtectedRoute>
                    }
                  />
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
                  <Route
                    path="/admin/panel-management"
                    element={
                      <ProtectedRoute allowedRoles={["CHAIR"]}>
                        <PanelManagementPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/account/profile" element={<MyProfilePage />} />
                </Route>

                {/* Protected: standalone pages */}
                <Route
                  path="/projects/new"
                  element={
                    <ProtectedRoute allowedRoles={["CHAIR", "RESEARCH_ASSOCIATE"]}>
                      <NewProtocolPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects/new-classic"
                  element={
                    <ProtectedRoute allowedRoles={["CHAIR", "RESEARCH_ASSOCIATE"]}>
                      <NewProtocolClassicPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/imports"
                  element={
                    <ProtectedRoute allowedRoles={["CHAIR", "RESEARCH_ASSOCIATE"]}>
                      <ImportCsvPage />
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
                  path="/imports/classifications"
                  element={
                    <ProtectedRoute allowedRoles={["CHAIR", "RESEARCH_ASSOCIATE"]}>
                      <ImportClassificationsPage />
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
                    <ProtectedRoute allowedRoles={["CHAIR", "RESEARCH_ASSOCIATE", "ADMIN"]}>
                      <ArchivesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recently-deleted"
                  element={
                    <ProtectedRoute allowedRoles={["CHAIR", "ADMIN"]}>
                      <RecentlyDeletedPage />
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
          </Suspense>
        </ErrorBoundary>
      </AuthProvider>
    </Router>
  );
}

export default App;
