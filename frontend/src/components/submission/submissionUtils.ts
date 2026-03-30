import { formatDateDisplay } from "@/utils/dateUtils";
import type { CommitteeSummary } from "@/types";

export const STANDARD_MILESTONES: { label: string; ownerRole: string }[] = [
  { label: "Classification of Proposal (RERC)", ownerRole: "RERC Staff" },
  { label: "Provision of Documents & Assessment Forms to Primary Reviewer", ownerRole: "RERC Staff" },
  { label: "Accomplishment of Assessment Forms", ownerRole: "Primary Reviewers" },
  { label: "Full Review Meeting (for Full Review only)", ownerRole: "RERP" },
  { label: "Finalization of Review Results", ownerRole: "RERP Chair Designate" },
  { label: "Communication of Review Results to Project Leader", ownerRole: "RERC Chair/Staff" },
  { label: "1st Resubmission from Proponent", ownerRole: "RERC Staff" },
  { label: "1st Review of Resubmission", ownerRole: "Primary Reviewers" },
  { label: "1st Finalization of Review Results - Resubmission", ownerRole: "RERP Chair Designate" },
  { label: "Issuance of Ethics Clearance", ownerRole: "RERC and RERC Chair" },
];

export const SUBMISSION_TYPE_OPTIONS = [
  "INITIAL", "AMENDMENT", "CONTINUING_REVIEW", "FINAL_REPORT",
  "WITHDRAWAL", "SAFETY_REPORT", "PROTOCOL_DEVIATION",
];

export const STATUS_OPTIONS = [
  "RECEIVED", "UNDER_COMPLETENESS_CHECK", "RETURNED_FOR_COMPLETION", "NOT_ACCEPTED", "AWAITING_CLASSIFICATION",
  "UNDER_CLASSIFICATION", "CLASSIFIED", "UNDER_REVIEW",
  "AWAITING_REVISIONS", "REVISION_SUBMITTED", "CLOSED", "WITHDRAWN",
];

export const FINAL_DECISION_OPTIONS = [
  "APPROVED", "MINOR_REVISIONS", "MAJOR_REVISIONS", "DISAPPROVED", "INFO_ONLY",
];

export function toInputDate(value?: string | Date | null): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return "";
}

export function humanizeEnum(value?: string | null): string {
  if (!value) return "—";
  return value.replace(/_/g, " ");
}

export function formatDateTimeDisplay(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function formatHistoryDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function formatFieldName(fieldName: string): string {
  switch (fieldName) {
    case "piName": return "PI name";
    case "committeeId": return "Committee";
    case "submissionType": return "Submission type";
    case "receivedDate": return "Received date";
    case "finalDecision": return "Final decision";
    case "finalDecisionDate": return "Decision date";
    default: return fieldName.replace(/([A-Z])/g, " $1").toLowerCase();
  }
}

export function formatChangeValue(
  fieldName: string,
  value: string | null,
  committees: CommitteeSummary[]
): string {
  if (!value) return "—";
  if (fieldName === "committeeId") {
    const match = committees.find((c) => String(c.id) === value);
    return match ? `${match.code} – ${match.name}` : value;
  }
  if (fieldName.toLowerCase().includes("date")) return formatDateDisplay(value);
  return value;
}

export function getDueMeta(
  dueDate?: string | null,
  submittedAt?: string | null,
  isActive = true
): { label: string; className: string } {
  if (!dueDate) return { label: "No deadline", className: "due-neutral" };
  if (submittedAt) return { label: "Submitted", className: "due-good" };
  if (!isActive) return { label: "Closed", className: "due-neutral" };
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return { label: "No deadline", className: "due-neutral" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, className: "due-overdue" };
  if (diffDays === 0) return { label: "Due today", className: "due-soon" };
  if (diffDays <= 3) return { label: `${diffDays}d left`, className: "due-soon" };
  return { label: `${diffDays}d left`, className: "due-good" };
}

export function getSlaStatus(stage: {
  actualDays: number | null;
  configuredDays: number | null;
  withinSla: boolean | null;
}): string {
  if (stage.actualDays == null || stage.configuredDays == null) return "pending";
  if (stage.withinSla === false) return "overdue";
  const ratio = stage.actualDays / stage.configuredDays;
  if (ratio >= 0.8) return "due-soon";
  return "on-track";
}

export function getSlaPercent(stage: {
  actualDays: number | null;
  configuredDays: number | null;
}): number {
  if (stage.actualDays == null || stage.configuredDays == null) return 0;
  if (stage.configuredDays === 0) return 100;
  return Math.min(100, Math.round((stage.actualDays / stage.configuredDays) * 100));
}

export function getStatusVariant(status: string): string {
  if (["CLOSED", "WITHDRAWN", "NOT_ACCEPTED"].includes(status)) return "badge-neutral";
  if (["AWAITING_REVISIONS", "REVISION_SUBMITTED", "RETURNED_FOR_COMPLETION"].includes(status)) return "badge-warning";
  if (["UNDER_REVIEW", "UNDER_CLASSIFICATION", "UNDER_COMPLETENESS_CHECK"].includes(status)) return "badge-info";
  return "badge-positive";
}
