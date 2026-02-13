import React from "react";
import { Outlet } from "react-router-dom";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { useDashboardQueues } from "@/hooks/useDashboardQueues";
import { BRAND } from "@/config/branding";
import "@/styles/dashboard.css";

/**
 * Shared layout shell for all dashboard-related routes.
 * Keeps the sidebar mounted and persistent across navigation —
 * only the <Outlet /> content swaps on route change.
 */
export default function DashboardShell() {
  const { counts } = useDashboardQueues(BRAND.defaultCommitteeCode);

  return (
    <div className="dashboard-page">
      <div className="dashboard-layout">
        <DashboardSidebar counts={counts} />
        <main className="dashboard-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
