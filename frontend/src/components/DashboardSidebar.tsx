import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import type { QueueCounts } from "@/types";
import { BRAND } from "@/config/branding";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/services/api";
import { getPrimaryRoleLabel, getRoleCapabilities } from "@/utils/roleUtils";

type DashboardSidebarProps = {
  counts: QueueCounts | null;
};

type SidebarBadgeTone = "default" | "warning" | "success";

const navClassName = ({ isActive }: { isActive: boolean }) =>
  `nav-item ${isActive ? "active" : ""}`;

const SidebarItemContent = ({
  icon,
  label,
  badge,
  badgeTone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeTone?: SidebarBadgeTone;
}) => (
  <>
    <span className="nav-item-icon-shell" aria-hidden="true">
      {icon}
    </span>
    <span className="nav-item-label">{label}</span>
    {badge && badge > 0 ? (
      <span className={`nav-item-badge nav-item-badge-${badgeTone}`}>{badge}</span>
    ) : null}
  </>
);

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ counts }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

  const roles = user?.roles ?? [];
  const capabilities = getRoleCapabilities(roles);
  const roleLabel = getPrimaryRoleLabel(roles);
  const assignedOnly = capabilities.hasAssignedOnlyAccess;
  const displayName = user?.fullName?.trim() || "User";
  const sidebarTaglineSource =
    typeof BRAND.tagline === "string" && BRAND.tagline.trim().length > 0
      ? BRAND.tagline
      : BRAND.name;
  const sidebarTagline = sidebarTaglineSource.replace(/\s+Portal$/i, "");

  useEffect(() => {
    if (!capabilities.isChair) {
      return;
    }

    let mounted = true;
    const loadPendingApprovals = async () => {
      try {
        const res = await api.get("/admin/users", {
          params: { _t: Date.now() },
        });
        const users = Array.isArray(res.data?.users) ? res.data.users : [];
        const pending = users.filter((item: { status?: string }) => item.status === "PENDING").length;
        if (mounted) {
          setPendingApprovalCount(pending);
        }
      } catch {
        if (mounted) {
          setPendingApprovalCount(0);
        }
      }
    };

    void loadPendingApprovals();
    return () => {
      mounted = false;
    };
  }, [capabilities.isChair]);

  return (
    <aside className="dashboard-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <span>R</span>
          </div>
          <div className="sidebar-brand-text">
            <h1>{BRAND.name}</h1>
            <span>{sidebarTagline}</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        <div className="nav-section">
          <div className="nav-section-title">Main</div>
          <div className="nav-section-items">
            <NavLink to="/dashboard" className={navClassName}>
              <SidebarItemContent
                label="Dashboard"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                }
              />
            </NavLink>
            {capabilities.canAdministerAccounts ? (
              <NavLink to="/admin/account-management" className={navClassName}>
                <SidebarItemContent
                  label="Account Management"
                  badge={capabilities.isChair ? pendingApprovalCount : undefined}
                  badgeTone="warning"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8" />
                    </svg>
                  }
                />
              </NavLink>
            ) : null}
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">{assignedOnly ? "Assignments" : "Queues"}</div>
          <div className="nav-section-items">
            {!assignedOnly ? (
              <NavLink to="/queues/classification" className={navClassName}>
                <SidebarItemContent
                  label="Classification"
                  badge={counts?.forClassification ?? undefined}
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                  }
                />
              </NavLink>
            ) : null}
            <NavLink to="/queues/under-review" className={navClassName}>
              <SidebarItemContent
                label={assignedOnly ? "My Reviews" : "Under Review"}
                badge={counts?.forReview ?? undefined}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                }
              />
            </NavLink>
            {capabilities.canOperateProtocols ? (
              <NavLink to="/queues/exempted" className={navClassName}>
                <SidebarItemContent
                  label="Exempted"
                  badge={counts?.forExempted ?? undefined}
                  badgeTone="success"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4" />
                      <path d="M21 12c-2 4-5 7-9 7s-7-3-9-7c2-4 5-7 9-7s7 3 9 7z" />
                    </svg>
                  }
                />
              </NavLink>
            ) : null}
            {!assignedOnly ? (
            <NavLink to="/queues/revisions" className={navClassName}>
              <SidebarItemContent
                label="Revisions"
                badge={counts?.awaitingRevisions ?? undefined}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                }
              />
            </NavLink>
            ) : null}
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Tools</div>
          <div className="nav-section-items">
            {capabilities.canCreateProtocol ? (
              <button className="nav-item" type="button" onClick={() => navigate("/projects/new")}>
                <SidebarItemContent
                  label="New Protocol"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                  }
                />
              </button>
            ) : null}
            {capabilities.canImportProjects ? (
              <NavLink to="/imports/projects" className={navClassName}>
                <SidebarItemContent
                  label="Import CSV"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 3v12" />
                      <path d="M7 8l5-5 5 5" />
                      <path d="M5 21h14a2 2 0 002-2v-5" />
                      <path d="M3 14v5a2 2 0 002 2" />
                    </svg>
                  }
                />
              </NavLink>
            ) : null}
            {capabilities.canGenerateReports ? (
              <NavLink to="/reports" className={navClassName}>
                <SidebarItemContent
                  label="Reports"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  }
                />
              </NavLink>
            ) : null}
            {capabilities.canViewArchives ? (
              <NavLink to="/archives" className={navClassName}>
                <SidebarItemContent
                  label="Archives"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 8v13H3V8" />
                      <path d="M1 3h22v5H1z" />
                      <path d="M10 12h4" />
                    </svg>
                  }
                />
              </NavLink>
            ) : null}
            {capabilities.canViewRecentlyDeleted ? (
              <NavLink to="/recently-deleted" className={navClassName}>
                <SidebarItemContent
                  label="Recently Deleted"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M6 6l1 14h10l1-14" />
                    </svg>
                  }
                />
              </NavLink>
            ) : null}
            {capabilities.canManageCalendar ? (
              <NavLink to="/calendar" className={navClassName}>
                <SidebarItemContent
                  label="Calendar"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                  }
                />
              </NavLink>
            ) : null}
          </div>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-card">
          <div className="sidebar-footer-kicker">Account</div>
          <div className="sidebar-user">
            <div className="sidebar-avatar">{user?.fullName?.[0]?.toUpperCase() ?? "U"}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-label">Signed in as</div>
              <div className="sidebar-user-name">{displayName}</div>
              <div className="sidebar-user-meta">{user?.email || "Portal session"}</div>
              <div className="sidebar-user-role-badge">{roleLabel}</div>
            </div>
          </div>
          <NavLink to="/account/profile" className={navClassName}>
            <SidebarItemContent
              label="My Profile"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" />
                </svg>
              }
            />
          </NavLink>
          <button
            className="nav-item sidebar-logout"
            type="button"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            <SidebarItemContent
              label="Sign out"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              }
            />
          </button>
        </div>
      </div>
    </aside>
  );
};
