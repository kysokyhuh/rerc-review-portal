/**
 * Overdue / Due-Soon Classifier
 *
 * Determines whether a delay is the responsibility of the PANEL (committee
 * reviewers, classification officers, etc.) or the RESEARCHER (PI needs to
 * submit revisions).
 *
 * Rule-of-thumb:
 *   - AWAITING_REVISIONS / REVISION_SUBMITTED → RESEARCHER
 *   - Everything else (RECEIVED, UNDER_COMPLETENESS_CHECK, AWAITING_CLASSIFICATION,
 *     UNDER_CLASSIFICATION, CLASSIFIED, UNDER_REVIEW, CLOSED, WITHDRAWN) → PANEL
 */

export type OverdueOwner = "PANEL" | "RESEARCHER";

export type OverdueOwnerRole =
  | "PROJECT_LEADER_RESEARCHER_PROPONENT"
  | "REVIEWER_GROUP"
  | "RESEARCH_ASSOCIATE_PROCESSING_STAFF"
  | "COMMITTEE_CHAIRPERSON_DESIGNATE"
  | "UNASSIGNED_PROCESS_GAP";

export interface OverdueClassificationContext {
  hasActionableAssignee?: boolean;
  hasRoutingMetadata?: boolean;
  isReviewerTask?: boolean;
  isEndorsementTask?: boolean;
  hasChairGate?: boolean;
}

export interface OverdueClassification {
  overdueOwner: OverdueOwner;
  overdueReason: string;
  overdueOwnerRole: OverdueOwnerRole;
  overdueOwnerLabel: string;
  overdueOwnerIcon: string;
  overdueOwnerReason: string;
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

const OWNER_ROLE_META: Record<
  OverdueOwnerRole,
  { label: string; icon: string; reason: string }
> = {
  PROJECT_LEADER_RESEARCHER_PROPONENT: {
    label: "Researcher",
    icon: "\u25CE",
    reason: "Waiting on project leader/researcher/proponent action",
  },
  REVIEWER_GROUP: {
    label: "Reviewer",
    icon: "\u2611",
    reason: "Waiting on reviewer or consultant action",
  },
  RESEARCH_ASSOCIATE_PROCESSING_STAFF: {
    label: "Staff",
    icon: "\u25A3",
    reason: "Waiting on staff processing/routing",
  },
  COMMITTEE_CHAIRPERSON_DESIGNATE: {
    label: "Chairperson",
    icon: "\u2713",
    reason: "Waiting on chairperson decision/finalization",
  },
  UNASSIGNED_PROCESS_GAP: {
    label: "Unassigned",
    icon: "\u26A0",
    reason: "Missing actionable assignee or routing metadata",
  },
};

/**
 * Classify who currently "owns" the delay for an overdue / due-soon item.
 */
export function classifyOverdue(
  status: string,
  context: OverdueClassificationContext = {}
): OverdueClassification {
  const hasActionableAssignee = context.hasActionableAssignee ?? true;
  const hasRoutingMetadata = context.hasRoutingMetadata ?? true;

  const overdueOwner: OverdueOwner = RESEARCHER_STATUSES.has(status)
    ? "RESEARCHER"
    : "PANEL";

  const overdueReason =
    REASON_MAP[status] ?? `Status: ${status}`;

  let overdueOwnerRole: OverdueOwnerRole;

  if (status === "AWAITING_REVISIONS") {
    overdueOwnerRole = "PROJECT_LEADER_RESEARCHER_PROPONENT";
  } else if (status === "REVISION_SUBMITTED") {
    overdueOwnerRole = "REVIEWER_GROUP";
  } else if (context.isReviewerTask || context.isEndorsementTask) {
    overdueOwnerRole = "REVIEWER_GROUP";
  } else if (context.hasChairGate) {
    overdueOwnerRole = "COMMITTEE_CHAIRPERSON_DESIGNATE";
  } else if (
    status === "RECEIVED" ||
    status === "UNDER_COMPLETENESS_CHECK" ||
    status === "AWAITING_CLASSIFICATION" ||
    status === "UNDER_CLASSIFICATION" ||
    status === "CLASSIFIED"
  ) {
    overdueOwnerRole = "RESEARCH_ASSOCIATE_PROCESSING_STAFF";
  } else if (!hasActionableAssignee || !hasRoutingMetadata) {
    overdueOwnerRole = "UNASSIGNED_PROCESS_GAP";
  } else {
    overdueOwnerRole = "RESEARCH_ASSOCIATE_PROCESSING_STAFF";
  }

  const ownerRoleMeta = OWNER_ROLE_META[overdueOwnerRole];

  return {
    overdueOwner,
    overdueReason,
    overdueOwnerRole,
    overdueOwnerLabel: ownerRoleMeta.label,
    overdueOwnerIcon: ownerRoleMeta.icon,
    overdueOwnerReason: ownerRoleMeta.reason,
  };
}
