import React from "react";

/**
 * Dashboard utility functions and constants.
 * Extracted from DashboardPageNew to keep the page file lean.
 */

// ── Greeting ──────────────────────────────────────────────
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

// ── Formatters ────────────────────────────────────────────
export function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatStatusLabel(status: string | null): string {
  if (!status) return "Unknown";
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatShortDate(value?: string | Date | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Owner-badge metadata ──────────────────────────────────
export const OWNER_BADGE_META: Record<
  string,
  { label: string; icon: string; cssClass: string; reason: string }
> = {
  PROJECT_LEADER_RESEARCHER_PROPONENT: {
    label: "Researcher",
    icon: "◎",
    cssClass: "researcher",
    reason: "Waiting on project leader/researcher/proponent action",
  },
  REVIEWER_GROUP: {
    label: "Reviewer",
    icon: "☑",
    cssClass: "reviewer",
    reason: "Waiting on reviewer or consultant action",
  },
  RESEARCH_ASSOCIATE_PROCESSING_STAFF: {
    label: "Staff",
    icon: "▣",
    cssClass: "staff",
    reason: "Waiting on staff processing/routing",
  },
  COMMITTEE_CHAIRPERSON_DESIGNATE: {
    label: "Chairperson",
    icon: "✓",
    cssClass: "chairperson",
    reason: "Waiting on chairperson decision/finalization",
  },
  UNASSIGNED_PROCESS_GAP: {
    label: "Unassigned",
    icon: "⚠",
    cssClass: "unassigned",
    reason: "Missing actionable assignee or routing metadata",
  },
};

// ── Shared types ──────────────────────────────────────────
export type CollapsedPanels = { overdue: boolean };

export const PAGE_SIZE = 15;
const slaUnitShort = (item: any) => (item.slaDayMode === "CALENDAR" ? "d" : "wd");

// ── Row-level predicates ──────────────────────────────────
export const isOverdue = (item: any) => item.slaStatus === "OVERDUE";

export const isDueSoon = (item: any, threshold: number) =>
  item.slaStatus === "DUE_SOON" ||
  ((item.daysRemaining ?? item.workingDaysRemaining) <= threshold &&
    (item.daysRemaining ?? item.workingDaysRemaining) >= 0);

export const isBlocked = (item: any) =>
  item.missingFields && item.missingFields.length > 0;

export const isUnassigned = (item: any) => !item.staffInChargeName;

export const isPaused = (item: any) =>
  ["WITHDRAWN", "CLOSED"].includes(item.status);

export function blockReasonFor(item: any): string {
  if (!item.missingFields || item.missingFields.length === 0) return "—";
  const preview = item.missingFields.slice(0, 2).join(", ");
  return item.missingFields.length > 2
    ? `Missing: ${preview} +${item.missingFields.length - 2}`
    : `Missing: ${preview}`;
}

export function slaChipText(item: any, threshold: number): string {
  if (isPaused(item)) return "SLA paused";
  const remaining = item.daysRemaining ?? item.workingDaysRemaining;
  const target = item.targetDays ?? item.targetWorkingDays;
  if (target == null || !item.slaDueDate || remaining == null) return "SLA not set";
  const unit = slaUnitShort(item);
  if (isOverdue(item)) return `Overdue ${Math.abs(remaining)} ${unit}`;
  if (isDueSoon(item, threshold)) return `Due in ${remaining} ${unit}`;
  return `${remaining} ${unit} left`;
}

export function priorityScore(item: any, threshold: number): number {
  let score = 0;
  if (isOverdue(item)) score += 100;
  if (isDueSoon(item, threshold)) score += 60;
  if (isBlocked(item)) score += 40;
  if (isUnassigned(item)) score += 15;
  if (item.queue === "classification") score += 10;
  return score;
}

export function resolveOwnerRoleKey(item: {
  overdueOwnerRole?: string;
  overdueOwner?: "PANEL" | "RESEARCHER";
}): string {
  if (item.overdueOwnerRole) return item.overdueOwnerRole;
  if (item.overdueOwner === "RESEARCHER") return "PROJECT_LEADER_RESEARCHER_PROPONENT";
  if (item.overdueOwner === "PANEL") return "RESEARCH_ASSOCIATE_PROCESSING_STAFF";
  return "UNASSIGNED_PROCESS_GAP";
}

export function renderOverdueOwnerBadge(
  item: {
    overdueOwnerRole?: string;
    overdueOwnerLabel?: string;
    overdueOwnerIcon?: string;
    overdueOwnerReason?: string;
    overdueOwner?: "PANEL" | "RESEARCHER";
    overdueReason?: string;
  },
  tone: "overdue" | "pending" = "overdue"
): React.JSX.Element | null {
  const fallbackRole =
    item.overdueOwner === "RESEARCHER"
      ? "PROJECT_LEADER_RESEARCHER_PROPONENT"
      : item.overdueOwner
        ? "RESEARCH_ASSOCIATE_PROCESSING_STAFF"
        : undefined;
  const ownerRole = item.overdueOwnerRole ?? fallbackRole;
  if (!ownerRole) return null;

  const meta = OWNER_BADGE_META[ownerRole] ?? OWNER_BADGE_META.RESEARCH_ASSOCIATE_PROCESSING_STAFF;
  const label = item.overdueOwnerLabel ?? meta.label;
  const icon = item.overdueOwnerIcon ?? meta.icon;
  const title = item.overdueOwnerReason ?? item.overdueReason ?? meta.reason;

  return (
    <span className={`overdue-owner-badge role-${meta.cssClass}`} title={title}>
      <span className="overdue-owner-icon" aria-hidden="true">{icon}</span>
      <span>{`${label} ${tone}`}</span>
    </span>
  );
}

// ── CSV export helper ─────────────────────────────────────
export function exportRowsToCsv(rows: any[], filename: string): void {
  if (rows.length === 0) {
    window.alert("No submissions in the current view.");
    return;
  }
  const headers = [
    "submission_id", "project_code", "project_title", "pi_name",
    "status", "queue", "sla_status", "sla_due_date", "owner",
  ];
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      [row.id, row.projectCode, row.projectTitle, row.piName,
       row.status, row.queue, row.slaStatus, row.slaDueDate,
       row.staffInChargeName ?? ""]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
