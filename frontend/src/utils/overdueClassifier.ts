/**
 * Overdue / Due-soon classifier (frontend mirror of backend logic)
 *
 * AWAITING_REVISIONS / REVISION_SUBMITTED → RESEARCHER
 * Everything else → PANEL
 */

export type OverdueOwner = "PANEL" | "RESEARCHER";

export interface OverdueClassification {
  overdueOwner: OverdueOwner;
  overdueReason: string;
}

const RESEARCHER_STATUSES = new Set([
  "AWAITING_REVISIONS",
  "REVISION_SUBMITTED",
]);

const REASON_MAP: Record<string, string> = {
  RECEIVED: "Submission awaiting initial review by the committee",
  UNDER_COMPLETENESS_CHECK: "Panel is checking submission completeness",
  AWAITING_CLASSIFICATION: "Awaiting classification by reviewer",
  UNDER_CLASSIFICATION: "Classification in progress by panel",
  CLASSIFIED: "Classified but pending review assignment",
  UNDER_REVIEW: "Under active review by panel reviewers",
  AWAITING_REVISIONS: "Researcher has not yet submitted required revisions",
  REVISION_SUBMITTED: "Researcher submitted revisions — pending panel re-review",
  CLOSED: "Submission closed",
  WITHDRAWN: "Submission withdrawn",
};

export function classifyOverdue(status: string): OverdueClassification {
  const overdueOwner: OverdueOwner = RESEARCHER_STATUSES.has(status)
    ? "RESEARCHER"
    : "PANEL";
  const overdueReason = REASON_MAP[status] ?? `Status: ${status}`;
  return { overdueOwner, overdueReason };
}
