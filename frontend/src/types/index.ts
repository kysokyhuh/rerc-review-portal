/**
 * Shared type definitions for the RERC Review Portal frontend
 */

// Queue and SLA types
export type QueueType = "classification" | "review" | "revision";
export type SLAStatus = "ON_TRACK" | "DUE_SOON" | "OVERDUE";
export type StageFilter =
  | "ALL"
  | "RECEIVED"
  | "COMPLETENESS"
  | "CLASSIFICATION"
  | "UNDER_REVIEW"
  | "REVISIONS"
  | "DUE_SOON"
  | "OVERDUE"
  | "CLOSED";

// Dashboard metrics
export interface QueueCounts {
  forClassification: number;
  forReview: number;
  awaitingRevisions: number;
  completed: number;
  dueSoon?: number;
  overdue?: number;
  missingLetterFields?: number;
  classificationStuck?: number;
}

export interface AttentionMetrics {
  overdue: number;
  dueSoon: number;
  classificationWait: number;
  missingLetterFields: number;
}

export interface DashboardActivityEntry {
  id: number;
  submissionId: number;
  projectCode: string;
  projectTitle: string;
  piName: string;
  oldStatus: string | null;
  newStatus: string;
  effectiveDate: string;
  reason: string | null;
  changedBy: {
    id: number;
    fullName: string;
    email: string;
  } | null;
}

// Queue items
export interface QueueItem {
  id: number;
  projectId?: number;
  projectCode: string;
  projectTitle: string;
  piName: string;
  piAffiliation?: string | null;
  piEmail?: string | null;
  staffInChargeName?: string | null;
  submissionType: string;
  status: string;
  receivedDate: string;
  daysRemaining?: number;
  reviewType?: string | null;
  finalDecision?: string | null;
  queue?: QueueType;
}

export interface DecoratedQueueItem extends QueueItem {
  queue: QueueType;
  slaStatus: SLAStatus;
  workingDaysRemaining: number;
  workingDaysElapsed: number;
  slaDueDate: string;
  targetWorkingDays: number;
  startedAt: string;
  missingFields: string[];
  templateCode: string;
  nextAction?: string;
  lastAction?: string;
  notes?: string;
}

// Letter templates
export interface LetterTemplateReadiness {
  templateCode: string;
  ready: number;
  missingFields: number;
  samples: Array<{
    submissionId: number;
    projectCode: string;
    projectTitle: string;
    fields: string[];
  }>;
}

export interface OverdueReviewItem {
  id: number;
  submissionId: number;
  projectCode: string;
  projectTitle: string;
  piName: string;
  reviewerName: string;
  reviewerRole: string | null;
  dueDate: string;
  daysOverdue: number;
  endorsementStatus?: string;
}

export interface ProjectSearchResult {
  id: number;
  projectCode: string;
  title: string;
  piName: string;
  updatedAt: string;
}

// Status history
export interface StatusHistoryEntry {
  id: number;
  oldStatus: string | null;
  newStatus: string;
  effectiveDate: string;
  reason: string | null;
  changedBy: {
    fullName: string;
    email: string;
  } | null;
}

export interface ChangeLogEntry {
  id: number;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
  changedBy: {
    fullName: string;
    email: string;
  } | null;
}

export interface CommitteeSummary {
  id: number;
  code: string;
  name: string;
}

// Submission details
export interface SubmissionDetail {
  id: number;
  submissionType: string;
  status: string;
  receivedDate: string;
  finalDecision: string | null;
  finalDecisionDate: string | null;
  statusHistory: StatusHistoryEntry[];
  changeLogs?: ChangeLogEntry[];
  projectChangeLogs?: ChangeLogEntry[];
  classification?: {
    reviewType: string | null;
    classificationDate: string | null;
    rationale?: string | null;
  } | null;
  project?: {
    id: number;
    projectCode: string;
    title: string;
    piName: string;
    piAffiliation?: string | null;
    committee?: {
      id: number;
      code: string;
      name: string;
    } | null;
    approvalStartDate?: string | null;
    approvalEndDate?: string | null;
  } | null;
}

// Project details
export interface ProjectDetail {
  id: number;
  projectCode: string;
  title: string;
  piName: string;
  piAffiliation: string;
  fundingType: string;
  overallStatus: string;
  approvalStartDate: string | null;
  approvalEndDate: string | null;
  committee: {
    id: number;
    name: string;
    code: string;
  };
  submissions: SubmissionDetail[];
}

// SLA summary
export interface SubmissionSlaSummary {
  submissionId: number;
  committeeCode: string;
  reviewType: string | null;
  classification: {
    start: string;
    end: string;
    configuredWorkingDays: number | null;
    actualWorkingDays: number | null;
    withinSla: boolean | null;
    description: string | null;
  };
  review: {
    start: string | null;
    end: string | null;
    configuredWorkingDays: number | null;
    actualWorkingDays: number | null;
    withinSla: boolean | null;
    description: string | null;
  };
  revisionResponse: {
    start: string | null;
    end: string | null;
    configuredWorkingDays: number | null;
    actualWorkingDays: number | null;
    withinSla: boolean | null;
    description: string | null;
  };
}
