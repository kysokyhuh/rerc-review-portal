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
          <NavLink to="/holidays" className={navClassName}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Holidays
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
