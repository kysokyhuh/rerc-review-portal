// packages/shared/src/constants.ts
// Shared enums and constants used across backend and frontend

export const ROLES = {
  CHAIR: "CHAIR",
  MEMBER: "MEMBER",
  RESEARCH_ASSOCIATE: "RESEARCH_ASSOCIATE",
  RESEARCH_ASSISTANT: "RESEARCH_ASSISTANT",
  REVIEWER: "REVIEWER",
  ADMIN: "ADMIN",
} as const;

export const SUBMISSION_STATUSES = {
  RECEIVED: "RECEIVED",
  UNDER_COMPLETENESS_CHECK: "UNDER_COMPLETENESS_CHECK",
  AWAITING_CLASSIFICATION: "AWAITING_CLASSIFICATION",
  UNDER_CLASSIFICATION: "UNDER_CLASSIFICATION",
  CLASSIFIED: "CLASSIFIED",
  UNDER_REVIEW: "UNDER_REVIEW",
  AWAITING_REVISIONS: "AWAITING_REVISIONS",
  REVISION_SUBMITTED: "REVISION_SUBMITTED",
  CLOSED: "CLOSED",
  WITHDRAWN: "WITHDRAWN",
} as const;

export const PROJECT_STATUSES = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  WITHDRAWN: "WITHDRAWN",
  CLOSED: "CLOSED",
} as const;

export const REVIEW_TYPES = {
  EXEMPT: "EXEMPT",
  EXPEDITED: "EXPEDITED",
  FULL_BOARD: "FULL_BOARD",
} as const;

export const REVIEW_DECISIONS = {
  APPROVED: "APPROVED",
  MINOR_REVISIONS: "MINOR_REVISIONS",
  MAJOR_REVISIONS: "MAJOR_REVISIONS",
  DISAPPROVED: "DISAPPROVED",
  INFO_ONLY: "INFO_ONLY",
} as const;

export const FUNDING_TYPES = {
  INTERNAL: "INTERNAL",
  EXTERNAL: "EXTERNAL",
  SELF_FUNDED: "SELF_FUNDED",
  NO_FUNDING: "NO_FUNDING",
} as const;

export const SLA_STAGES = {
  CLASSIFICATION: "CLASSIFICATION",
  REVIEW: "REVIEW",
  REVISION_RESPONSE: "REVISION_RESPONSE",
  CONTINUING_REVIEW_DUE: "CONTINUING_REVIEW_DUE",
  FINAL_REPORT_DUE: "FINAL_REPORT_DUE",
  MEMBERSHIP: "MEMBERSHIP",
  MEETING: "MEETING",
} as const;

export const COMPLETENESS_STATUSES = {
  COMPLETE: "COMPLETE",
  MINOR_MISSING: "MINOR_MISSING",
  MAJOR_MISSING: "MAJOR_MISSING",
  MISSING_SIGNATURES: "MISSING_SIGNATURES",
  OTHER: "OTHER",
} as const;

// Role-based access control matrix
export const RBAC_RULES = {
  CHAIR: {
    canCreateProject: true,
    canClassify: true,
    canAssignReviewers: true,
    canViewAuditLogs: true,
    canExportLetters: true,
    canGenerateReports: true,
  },
  RESEARCH_ASSOCIATE: {
    canCreateProject: true,
    canClassify: false,
    canAssignReviewers: false,
    canViewAuditLogs: false,
    canExportLetters: true,
    canGenerateReports: false,
  },
  REVIEWER: {
    canCreateProject: false,
    canClassify: false,
    canAssignReviewers: false,
    canViewAuditLogs: false,
    canExportLetters: false,
    canGenerateReports: false,
  },
  MEMBER: {
    canCreateProject: false,
    canClassify: false,
    canAssignReviewers: false,
    canViewAuditLogs: false,
    canExportLetters: false,
    canGenerateReports: false,
  },
  ADMIN: {
    canCreateProject: true,
    canClassify: true,
    canAssignReviewers: true,
    canViewAuditLogs: true,
    canExportLetters: true,
    canGenerateReports: true,
  },
} as const;
