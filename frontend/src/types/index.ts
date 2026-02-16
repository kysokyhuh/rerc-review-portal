/**
 * Shared type definitions for the URERB Review Portal frontend
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
  overdueOwner?: "PANEL" | "RESEARCHER";
  overdueReason?: string;
  overdueOwnerRole?:
    | "PROJECT_LEADER_RESEARCHER_PROPONENT"
    | "REVIEWER_GROUP"
    | "RESEARCH_ASSOCIATE_PROCESSING_STAFF"
    | "COMMITTEE_CHAIRPERSON_DESIGNATE"
    | "UNASSIGNED_PROCESS_GAP";
  overdueOwnerLabel?: string;
  overdueOwnerIcon?: string;
  overdueOwnerReason?: string;
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
  overdueOwner?: "PANEL" | "RESEARCHER";
  overdueReason?: string;
  overdueOwnerRole?:
    | "PROJECT_LEADER_RESEARCHER_PROPONENT"
    | "REVIEWER_GROUP"
    | "RESEARCH_ASSOCIATE_PROCESSING_STAFF"
    | "COMMITTEE_CHAIRPERSON_DESIGNATE"
    | "UNASSIGNED_PROCESS_GAP";
  overdueOwnerLabel?: string;
  overdueOwnerIcon?: string;
  overdueOwnerReason?: string;
}

export interface ProjectSearchResult {
  id: number;
  projectCode: string;
  title: string | null;
  piName: string | null;
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

export interface SubmissionReviewerEntry {
  id: number;
  reviewerRole: string | null;
  isPrimary?: boolean;
  assignedAt?: string;
  receivedAt?: string | null;
  dueDate?: string | null;
  respondedAt?: string | null;
  decision?: string | null;
  remarks?: string | null;
  endorsementStatus?: string | null;
  honorariumStatus?: string | null;
  reviewer: {
    id: number;
    fullName: string;
    email: string;
  };
}

export interface SubmissionReviewAssignmentEntry {
  id: number;
  roundSequence: number;
  reviewerRole: string;
  assignedAt: string;
  dueDate: string | null;
  receivedAt: string | null;
  submittedAt: string | null;
  decision: string | null;
  endorsementStatus: string | null;
  remarks: string | null;
  isActive: boolean;
  endedAt: string | null;
  reviewer: {
    id: number;
    fullName: string;
    email: string;
  };
}

export interface SubmissionDocumentEntry {
  id: number;
  type: string;
  title: string;
  status: string;
  documentUrl: string | null;
  notes: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommitteeSummary {
  id: number;
  code: string;
  name: string;
}

export interface HolidayItem {
  id: number;
  date: string;
  name: string;
  createdAt: string;
}

export interface CreateHolidayPayload {
  date: string;
  name: string;
}

export interface UpdateHolidayPayload {
  date?: string;
  name?: string;
}

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  entity?: string;
  receivedRows: number;
  insertedRows: number;
  failedRows: number;
  errors: ImportRowError[];
}

export interface ProjectImportPreview {
  detectedHeaders: string[];
  previewRowNumbers: number[];
  previewRows: Record<string, string>[];
  suggestedMapping: Record<string, string | null>;
  missingRequiredFields: string[];
  warnings: string[];
}

export interface ProjectImportRowEdit {
  rowNumber: number;
  values: Record<string, string>;
}

export interface CreateProjectPayload {
  projectCode: string;
  title?: string;
  piName?: string;
  committeeCode: string;
  submissionType?: string;
  receivedDate?: string;
  fundingType?: string;
  notes?: string;
  collegeOrUnit?: string;
  department?: string;
  proponent?: string;
  researchTypePHREB?: string;
  researchTypePHREBOther?: string;
  proponentCategory?: "UNDERGRAD" | "GRAD" | "FACULTY" | "OTHER";
  // Extra ProtocolProfile fields
  panel?: string;
  scientistReviewer?: string;
  layReviewer?: string;
  independentConsultant?: string;
  honorariumStatus?: string;
  classificationDate?: string;
  finishDate?: string;
  status?: string;
  monthOfSubmission?: string;
  monthOfClearance?: string;
}

export interface CreateProjectResponse {
  projectId: number;
  submissionId: number;
}

// Submission details
export interface SubmissionDetail {
  id: number;
  submissionType: string | null;
  status: string;
  receivedDate: string | null;
  finalDecision: string | null;
  finalDecisionDate: string | null;
  statusHistory: StatusHistoryEntry[];
  reviews?: SubmissionReviewerEntry[];
  reviewAssignments?: SubmissionReviewAssignmentEntry[];
  documents?: SubmissionDocumentEntry[];
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
    title: string | null;
    piName: string | null;
    piAffiliation?: string | null;
    committee?: {
      id: number;
      code: string;
      name: string;
    } | null;
    approvalStartDate?: string | null;
    approvalEndDate?: string | null;
    protocolProfile?: ProtocolProfile | null;
  } | null;
}

// Project details
export interface ProjectDetail {
  id: number;
  projectCode: string;
  title: string | null;
  piName: string | null;
  piAffiliation: string;
  fundingType: string | null;
  overallStatus: string;
  approvalStartDate: string | null;
  approvalEndDate: string | null;
  committee: {
    id: number;
    name: string;
    code: string;
  };
  protocolProfile?: ProtocolProfile | null;
  protocolMilestones?: ProtocolMilestone[];
  submissions: SubmissionDetail[];
  changeLog?: ChangeLogEntry[];
}

export interface ProtocolProfile {
  id: number;
  projectId: number;
  title?: string | null;
  projectLeader?: string | null;
  college?: string | null;
  department?: string | null;
  dateOfSubmission?: string | null;
  monthOfSubmission?: string | null;
  typeOfReview?: string | null;
  proponent?: string | null;
  funding?: string | null;
  typeOfResearchPhreb?: string | null;
  typeOfResearchPhrebOther?: string | null;
  status?: string | null;
  finishDate?: string | null;
  monthOfClearance?: string | null;
  reviewDurationDays?: number | null;
  remarks?: string | null;
  panel?: string | null;
  scientistReviewer?: string | null;
  layReviewer?: string | null;
  independentConsultant?: string | null;
  honorariumStatus?: string | null;
  classificationOfProposalRerc?: string | null;
  totalDays?: number | null;
  submissionCount?: number | null;
  withdrawn?: boolean | null;
  projectEndDate6A?: string | null;
  clearanceExpiration?: string | null;
  progressReportTargetDate?: string | null;
  progressReportSubmission?: string | null;
  progressReportApprovalDate?: string | null;
  progressReportStatus?: string | null;
  progressReportDays?: number | null;
  finalReportTargetDate?: string | null;
  finalReportSubmission?: string | null;
  finalReportCompletionDate?: string | null;
  finalReportStatus?: string | null;
  finalReportDays?: number | null;
  amendmentSubmission?: string | null;
  amendmentStatusOfRequest?: string | null;
  amendmentApprovalDate?: string | null;
  amendmentDays?: number | null;
  continuingSubmission?: string | null;
  continuingStatusOfRequest?: string | null;
  continuingApprovalDate?: string | null;
  continuingDays?: number | null;
  primaryReviewer?: string | null;
  finalLayReviewer?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProtocolProfilePayload {
  title?: string | null;
  projectLeader?: string | null;
  college?: string | null;
  department?: string | null;
  dateOfSubmission?: string | null;
  monthOfSubmission?: string | null;
  typeOfReview?: string | null;
  proponent?: string | null;
  funding?: string | null;
  typeOfResearchPhreb?: string | null;
  typeOfResearchPhrebOther?: string | null;
  status?: string | null;
  finishDate?: string | null;
  monthOfClearance?: string | null;
  reviewDurationDays?: number | null;
  remarks?: string | null;
  panel?: string | null;
  scientistReviewer?: string | null;
  layReviewer?: string | null;
  independentConsultant?: string | null;
  honorariumStatus?: string | null;
  classificationOfProposalRerc?: string | null;
  totalDays?: number | null;
  submissionCount?: number | null;
  withdrawn?: boolean | null;
  projectEndDate6A?: string | null;
  clearanceExpiration?: string | null;
  progressReportTargetDate?: string | null;
  progressReportSubmission?: string | null;
  progressReportApprovalDate?: string | null;
  progressReportStatus?: string | null;
  progressReportDays?: number | null;
  finalReportTargetDate?: string | null;
  finalReportSubmission?: string | null;
  finalReportCompletionDate?: string | null;
  finalReportStatus?: string | null;
  finalReportDays?: number | null;
  amendmentSubmission?: string | null;
  amendmentStatusOfRequest?: string | null;
  amendmentApprovalDate?: string | null;
  amendmentDays?: number | null;
  continuingSubmission?: string | null;
  continuingStatusOfRequest?: string | null;
  continuingApprovalDate?: string | null;
  continuingDays?: number | null;
  primaryReviewer?: string | null;
  finalLayReviewer?: string | null;
  _meta?: {
    changeReason?: string;
    sourceSubmissionId?: number;
  };
}

export interface ProtocolMilestone {
  id: number;
  projectId: number;
  orderIndex: number;
  label: string;
  days?: number | null;
  dateOccurred?: string | null;
  ownerRole?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProtocolMilestonePayload {
  orderIndex?: number;
  label: string;
  days?: number | null;
  dateOccurred?: string | null;
  ownerRole?: string | null;
  notes?: string | null;
}

export interface UpdateProtocolMilestonePayload {
  orderIndex?: number;
  label?: string;
  days?: number | null;
  dateOccurred?: string | null;
  ownerRole?: string | null;
  notes?: string | null;
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

// Archived projects (terminal states: CLOSED, WITHDRAWN)
export interface ArchivedProject {
  projectId: number;
  projectCode: string;
  title: string | null;
  piName: string | null;
  latestSubmissionId: number | null;
  latestSubmissionStatus: string | null;
  receivedDate: string | null;
  reviewType: string | null;
  committeeCode: string | null;
  overallStatus: string | null;
}

export interface ArchivedProjectsResponse {
  items: ArchivedProject[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReportsAcademicYearOption {
  academicYear: string;
  terms: number[];
}

export interface ReportsSummaryResponse {
  academicYear: string;
  term: "ALL" | number;
  committeeCode: string | null;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  totals: {
    received: number;
    withdrawn: number;
    exempted: number;
    expedited: number;
    fullReview: number;
  };
  termVolume: Array<{
    term: number;
    received: number;
  }>;
  academicYearVolume?: Array<{
    academicYear: string;
    received: number;
  }>;
  breakdownByCollegeOrUnit: Array<{
    collegeOrUnit: string;
    received: number;
    withdrawn: number;
    exempted: number;
    expedited: number;
    fullReview: number;
    byProponentType: {
      undergrad: number;
      grad: number;
      faculty: number;
      other: number;
      unknown: number;
    };
    byProponentTypeAndReviewType: {
      undergrad: { exempted: number; expedited: number; fullReview: number };
      grad: { exempted: number; expedited: number; fullReview: number };
      faculty: { exempted: number; expedited: number; fullReview: number };
      other: { exempted: number; expedited: number; fullReview: number };
      unknown: { exempted: number; expedited: number; fullReview: number };
    };
  }>;
  averages: {
    avgDaysToResults: {
      expedited: number | null;
      fullReview: number | null;
    };
    avgDaysToResubmit: number | null;
    avgDaysToClearance: {
      expedited: number | null;
      fullReview: number | null;
    };
  };
}
