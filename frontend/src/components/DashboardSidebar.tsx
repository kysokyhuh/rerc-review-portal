import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import type { QueueCounts } from "@/types";
import { BRAND } from "@/config/branding";

type DashboardSidebarProps = {
  counts: QueueCounts | null;
};

const navClassName = ({ isActive }: { isActive: boolean }) =>
  `nav-item ${isActive ? "active" : ""}`;

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ counts }) => {
  const navigate = useNavigate();

  return (
    <aside className="dashboard-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">R</div>
          <div>
                <h1>{BRAND.name} Portal</h1>
                <span>{BRAND.tagline}</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        <div className="nav-section">
          <div className="nav-section-title">Main</div>
          <NavLink to="/dashboard" className={navClassName}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Dashboard
          </NavLink>
          <button className="nav-item" type="button" aria-disabled="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            All Submissions
          </button>
          <button className="nav-item" type="button" aria-disabled="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
            Reviewers
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Queues</div>
          <NavLink to="/queues/classification" className={navClassName}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            Classification
            {(counts?.forClassification ?? 0) > 0 && (
              <span className="nav-item-badge">{counts?.forClassification}</span>
            )}
          </NavLink>
          <NavLink to="/queues/under-review" className={navClassName}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Under Review
            {(counts?.forReview ?? 0) > 0 && (
              <span className="nav-item-badge">{counts?.forReview}</span>
            )}
          </NavLink>
          <NavLink to="/queues/revisions" className={navClassName}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Revisions
            {(counts?.awaitingRevisions ?? 0) > 0 && (
              <span className="nav-item-badge">{counts?.awaitingRevisions}</span>
            )}
          </NavLink>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Tools</div>
          <button className="nav-item" type="button" onClick={() => navigate("/projects/new")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            New Protocol
          </button>
          <button className="nav-item" type="button" aria-disabled="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
            Letter Generator
          </button>
          <NavLink to="/imports/projects" className={navClassName}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v12" />
              <path d="M7 8l5-5 5 5" />
              <path d="M5 21h14a2 2 0 002-2v-5" />
              <path d="M3 14v5a2 2 0 002 2" />
            </svg>
            Import CSV
          </NavLink>
          <NavLink to="/reports" className={navClassName}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Reports
          </NavLink>
          <NavLink to="/archives" className={navClassName}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 8v13H3V8" />
              <path d="M1 3h22v5H1z" />
              <path d="M10 12h4" />
            </svg>
            Archives
          </NavLink>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">RA</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">Research Associate</div>
            <div className="sidebar-user-role">{BRAND.defaultCommitteeCode}</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
