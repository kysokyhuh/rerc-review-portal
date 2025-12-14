import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import "./styles/globals.css";

function App() {
  return (
    <Router>
      <div className="app-container">
        <nav className="app-nav">
          <div className="nav-brand">
            <h1>RERC Review Portal</h1>
          </div>
          <div className="nav-links">
            <a href="/dashboard">Dashboard</a>
          </div>
        </nav>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route
              path="/projects/:projectId"
              element={<ProjectDetailPage />}
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <p>&copy; 2025 RERC Review Portal. All rights reserved.</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
