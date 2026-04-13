/**
 * Shared type definitions for the URERB Review Portal frontend
 */

// Queue and SLA types
export type QueueType = "classification" | "review" | "revision";
export type SLAStatus = "ON_TRACK" | "DUE_SOON" | "OVERDUE";
export type SLADayMode = "CALENDAR" | "WORKING";
export type SLAStageKey =
  | "COMPLETENESS"
  | "CLASSIFICATION"
  | "EXEMPT_NOTIFICATION"
  | "REVIEW"
  | "REVISION_RESPONSE"
  | "CONTINUING_REVIEW_DUE"
  | "FINAL_REPORT_DUE"
  | "MEMBERSHIP"
  | "MEETING";
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

export interface AuthProfile {
  id: number;
  email: string;
  fullName: string;
  roles: string[];
  status?: string;
  forcePasswordChange?: boolean;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  approvedAt?: string | null;
}

export interface UpdateProfilePayload {
  fullName?: string;
  email?: string;
  currentPassword?: string;
}

export interface ChangePasswordPayload {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
}

// Dashboard metrics
export interface QueueCounts {
  forClassification: number;
  forReview: number;
  forExempted?: number;
  awaitingRevisions: number;
  completed: number;
  legacyImports?: number;
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
  daysRemaining?: number | null;
  daysElapsed?: number | null;
  targetDays?: number | null;
  reviewType?: string | null;
  finalDecision?: string | null;
  queue?: QueueType;
  slaStage?: SLAStageKey | null;
  slaDayMode?: SLADayMode | null;
  slaStatus?: SLAStatus;
  slaDueDate?: string | null;
  startedAt?: string | null;
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
  classification?: {
    reviewType: string | null;
    panelId?: number | null;
  } | null;
  reviews?: Array<{ id: number }>;
  reviewAssignments?: Array<{
    id: number;
    reviewerId: number;
    reviewerRole: string;
    isActive: boolean;
  }>;
}

export interface DecoratedQueueItem extends QueueItem {
  queue: QueueType;
  slaStatus: SLAStatus;
  workingDaysRemaining: number | null;
  workingDaysElapsed: number | null;
  slaDueDate: string | null;
  targetWorkingDays: number | null;
  startedAt: string | null;
  daysRemaining: number | null;
  daysElapsed: number | null;
  targetDays: number | null;
  slaStage: SLAStageKey | null;
  slaDayMode: SLADayMode | null;
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
  origin?: ProjectOrigin;
}

export interface LegacyDashboardProject {
  projectId: number;
  projectCode: string;
  title: string;
  piName: string;
  receivedDate: string | null;
  reviewType: string | null;
  status: string;
  importedAt: string | null;
  sourceFilename: string | null;
}

export interface LegacyDashboardProjectsResponse {
  committeeCode: string;
  q: string;
  totalCount: number;
  page: number;
  pageSize: number;
  items: LegacyDashboardProject[];
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

export type BulkReminderTarget =
  | "PROPONENT"
  | "REVIEWER"
  | "INTERNAL_STAFF";

export type BulkStatusAction =
  | "START_COMPLETENESS_CHECK"
  | "RETURN_FOR_COMPLETION"
  | "MARK_NOT_ACCEPTED"
  | "ACCEPT_FOR_CLASSIFICATION"
  | "MOVE_TO_UNDER_CLASSIFICATION"
  | "MARK_CLASSIFIED"
  | "START_REVIEW";

export interface ReviewerCandidate {
  id: number;
  fullName: string;
  email: string;
  roles: string[];
  isCommonReviewer: boolean;
  reviewerExpertise: string[];
}

export interface BulkActionResult {
  submissionId: number;
  projectCode: string | null;
  status: "SUCCEEDED" | "SKIPPED" | "FAILED";
  message: string;
  data?: Record<string, unknown> | null;
}

export interface BulkActionResponse {
  requestedCount: number;
  succeeded: number;
  skipped: number;
  failed: number;
  results: BulkActionResult[];
}

export interface SubmissionReminderLogEntry {
  id: number;
  target: BulkReminderTarget;
  note: string;
  createdAt: string;
  actor: {
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

export type ImportMode = "INTAKE_IMPORT" | "LEGACY_MIGRATION";
export type ImportModeFit = "match" | "warn" | "blocked";
export type ProjectOrigin = "NATIVE_PORTAL" | "LEGACY_IMPORT";

export interface ImportWarning {
  code: string;
  message: string;
  row?: number;
  field?: string;
}

export interface ImportBatchSummary {
  id: number;
  mode: ImportMode;
  sourceFilename: string;
  createdAt: string;
}

export interface LegacyImportSnapshot {
  id: number;
  projectId: number;
  sourceRowNumber: number;
  importedStatus?: string | null;
  importedTypeOfReview?: string | null;
  importedClassificationOfProposal?: string | null;
  importedPanel?: string | null;
  importedScientistReviewer?: string | null;
  importedLayReviewer?: string | null;
  importedPrimaryReviewer?: string | null;
  importedFinalLayReviewer?: string | null;
  importedIndependentConsultant?: string | null;
  importedHonorariumStatus?: string | null;
  importedTotalDays?: number | null;
  importedSubmissionCount?: number | null;
  importedReviewDurationDays?: number | null;
  importedClassificationDays?: number | null;
  importedFinishDate?: string | null;
  importedClassificationDate?: string | null;
  importedMonthOfClearance?: string | null;
  importedWithdrawn?: boolean | null;
  importedProjectEndDate6A?: string | null;
  importedClearanceExpiration?: string | null;
  importedProgressReportTargetDate?: string | null;
  importedProgressReportSubmission?: string | null;
  importedProgressReportApprovalDate?: string | null;
  importedProgressReportStatus?: string | null;
  importedProgressReportDays?: number | null;
  importedFinalReportTargetDate?: string | null;
  importedFinalReportSubmission?: string | null;
  importedFinalReportCompletionDate?: string | null;
  importedFinalReportStatus?: string | null;
  importedFinalReportDays?: number | null;
  importedAmendmentSubmission?: string | null;
  importedAmendmentStatus?: string | null;
  importedAmendmentApprovalDate?: string | null;
  importedAmendmentDays?: number | null;
  importedContinuingSubmission?: string | null;
  importedContinuingStatus?: string | null;
  importedContinuingApprovalDate?: string | null;
  importedContinuingDays?: number | null;
  importedRemarks?: string | null;
  importedAt?: string;
  importBatch?: ImportBatchSummary | null;
  rawRowJson?: Record<string, string> | null;
}

export interface ImportResult {
  entity?: string;
  receivedRows: number;
  insertedRows: number;
  failedRows: number;
  warningRows?: number;
  warnings?: ImportWarning[];
  selectedMode?: ImportMode;
  recommendedMode?: ImportMode;
  modeFit?: ImportModeFit;
  importBatch?: ImportBatchSummary;
  errors: ImportRowError[];
}

export interface ProjectImportPreview {
  detectedFormat: "headered" | "legacy_headered" | "legacy_headerless";
  detectedHeaders: string[];
  previewRowNumbers: number[];
  previewRows: Record<string, string>[];
  suggestedMapping: Record<string, string | null>;
  missingRequiredFields: string[];
  warnings: string[];
  warningItems?: ImportWarning[];
  selectedMode?: ImportMode;
  recommendedMode?: ImportMode;
  modeFit?: ImportModeFit;
  sourceType?: "csv" | "xlsx";
  sourceWarnings?: string[];
}

export interface ProjectImportRowEdit {
  rowNumber: number;
  values: Record<string, string>;
}

export interface CreateProjectPayload {
  projectCode: string;
  title?: string;
  piName?: string;
  committeeCode?: string;
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
  reminderLogs?: SubmissionReminderLogEntry[];
  changeLogs?: ChangeLogEntry[];
  projectChangeLogs?: ChangeLogEntry[];
  classification?: {
    reviewType: string | null;
    classificationDate: string | null;
    rationale?: string | null;
  } | null;
  project?: {
    id: number;
    origin?: ProjectOrigin;
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
    protocolMilestones?: ProtocolMilestone[];
    legacyImportSnapshot?: LegacyImportSnapshot | null;
  } | null;
}

// Project details
export interface ProjectDetail {
  id: number;
  origin?: ProjectOrigin;
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
  legacyImportSnapshot?: LegacyImportSnapshot | null;
  protocolMilestones?: ProtocolMilestone[];
  submissions: SubmissionDetail[];
  statusHistory?: StatusHistoryEntry[];
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
export interface SubmissionSlaStageSummary {
  stage: SLAStageKey;
  label: string;
  dayMode: SLADayMode | null;
  configuredDays: number | null;
  start: string | null;
  end: string | null;
  dueDate: string | null;
  actualDays: number | null;
  remainingDays: number | null;
  withinSla: boolean | null;
  description: string | null;
  isActive: boolean;
  slaStatus: SLAStatus | null;
}

export interface SubmissionCurrentSlaWindow {
  stage: SLAStageKey;
  label: string;
  dayMode: SLADayMode;
  targetDays: number;
  startedAt: string;
  dueDate: string;
  elapsedDays: number;
  remainingDays: number;
  slaStatus: SLAStatus;
  ownerRole:
    | "PROJECT_LEADER_RESEARCHER_PROPONENT"
    | "REVIEWER_GROUP"
    | "RESEARCH_ASSOCIATE_PROCESSING_STAFF"
    | "COMMITTEE_CHAIRPERSON_DESIGNATE"
    | "UNASSIGNED_PROCESS_GAP";
  ownerLabel: string;
  ownerIcon: string;
  ownerReason: string;
  reason: string;
  description: string | null;
}

export interface SubmissionSlaSummary {
  submissionId: number;
  committeeCode: string | null;
  reviewType: string | null;
  current: SubmissionCurrentSlaWindow | null;
  completeness: SubmissionSlaStageSummary;
  classification: SubmissionSlaStageSummary;
  exemptNotification: SubmissionSlaStageSummary;
  review: SubmissionSlaStageSummary;
  revisionResponse: SubmissionSlaStageSummary;
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
  archiveDate: string | null;
  archiveReason: string | null;
}

export interface ArchivedProjectsResponse {
  items: ArchivedProject[];
  total: number;
  limit: number;
  offset: number;
}

export interface ExemptedQueueItem {
  id: number;
  projectId: number | null;
  projectCode: string;
  title: string;
  proponentOrLeader: string;
  college: string;
  dateReceived: string | null;
  status: string;
  resultsNotifiedAt: string | null;
}

export interface ExemptedQueueResponse {
  totalCount: number;
  items: ExemptedQueueItem[];
  page: number;
  pageSize: number;
}

export interface ReportsAcademicYearOption {
  academicYear: string;
  terms: number[];
}

export interface AnnualReportSummaryResponse {
  selection: {
    periodMode: "ACADEMIC" | "CUSTOM";
    ay: string;
    term: "ALL" | 1 | 2 | 3;
    committee: string;
    college: string;
    category: "ALL" | "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING";
    reviewType: "ALL" | "EXEMPT" | "EXPEDITED" | "FULL_BOARD" | "UNCLASSIFIED" | "WITHDRAWN";
    status: "ALL" | string;
    q: string | null;
    asOfDate: string;
    isPartial: boolean;
    dateRange: {
      startDate: string;
      endDate: string;
    };
  };
  sourceCounts: {
    nativePortal: number;
    legacyImport: number;
  };
  summaryCounts: {
    received: number;
    exempted: number;
    expedited: number;
    fullReview: number;
    withdrawn: number;
    byProponentCategory: {
      UNDERGRAD: number;
      GRAD: number;
      FACULTY: number;
      NON_TEACHING: number;
    };
  };
  overviewTable: {
    rows: Array<{
      label: string;
      received: number;
      exempted: number;
      expedited: number;
      fullReview: number;
      withdrawn: number;
    }>;
    totals: {
      received: number;
      exempted: number;
      expedited: number;
      fullReview: number;
      withdrawn: number;
    };
  };
  classificationMatrix: {
    UNDERGRAD: { exempted: number; expedited: number; fullReview: number; withdrawn: number; total: number };
    GRAD: { exempted: number; expedited: number; fullReview: number; withdrawn: number; total: number };
    FACULTY: { exempted: number; expedited: number; fullReview: number; withdrawn: number; total: number };
    NON_TEACHING: { exempted: number; expedited: number; fullReview: number; withdrawn: number; total: number };
    TOTAL: { exempted: number; expedited: number; fullReview: number; withdrawn: number; total: number };
  };
  breakdownByCollege: Array<{
    college: string;
    received: number;
    exempted: number;
    expedited: number;
    fullReview: number;
    withdrawn: number;
    categories: {
      UNDERGRAD: { received: number; exempted: number; expedited: number; fullReview: number; withdrawn: number };
      GRAD: { received: number; exempted: number; expedited: number; fullReview: number; withdrawn: number };
      FACULTY: { received: number; exempted: number; expedited: number; fullReview: number; withdrawn: number };
      NON_TEACHING: { received: number; exempted: number; expedited: number; fullReview: number; withdrawn: number };
    };
  }>;
  comparativeByProponent: Array<{
    category: "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING";
    years: string[];
    rows: Array<{
      college: string;
      exempted: Record<string, number>;
      expedited: Record<string, number>;
      fullReview: Record<string, number>;
      withdrawn: Record<string, number>;
    }>;
    totals: {
      college: string;
      exempted: Record<string, number>;
      expedited: Record<string, number>;
      fullReview: Record<string, number>;
      withdrawn: Record<string, number>;
    };
  }>;
  charts: {
    receivedByMonth: Array<{ label: string; count: number }>;
    proponentCategoryDistribution: Array<{
      label: string;
      category: "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING";
      count: number;
    }>;
    receivedByCollege: Array<{ label: string; count: number }>;
    outcomeByCollege: Array<{
      label: string;
      total: number;
      exempted: number;
      expedited: number;
      fullReview: number;
      withdrawn: number;
      unclassified: number;
    }>;
    proposalsPerTerm: Array<{ label: string; count: number }>;
    reviewTypeDistribution: Array<{ label: string; count: number }>;
    topColleges: Array<{ label: string; count: number }>;
    reviewTypeByMonth: Array<{
      label: string;
      exempted: number;
      expedited: number;
      fullReview: number;
      withdrawn: number;
      unclassified: number;
      total: number;
    }>;
    withdrawnByMonth: Array<{ label: string; count: number }>;
    comparativeYearTrend: Array<{
      label: string;
      exempted: number;
      expedited: number;
      fullReview: number;
      withdrawn: number;
    }>;
    committeeDistribution: Array<{ label: string; count: number }>;
  };
  performanceCharts: {
    averages: {
      daysToResults: Array<{ label: string; value: number | null }>;
      daysToClearance: Array<{ label: string; value: number | null }>;
      daysToResubmit: number | null;
    };
    slaCompliance: Array<{ label: string; within: number; overdue: number }>;
    workflowFunnel: Array<{ label: string; count: number }>;
  };
}

export interface AnnualReportSubmissionsResponse {
  totalCount: number;
  page: number;
  pageSize: number;
  items: Array<{
    submissionId: number;
    projectId: number | null;
    projectCode: string;
    title: string;
    proponent: string;
    college: string;
    department: string;
    proponentCategory: "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING" | "UNKNOWN";
    reviewType: "EXEMPT" | "EXPEDITED" | "FULL_BOARD" | "UNCLASSIFIED";
    status: string;
    receivedDate: string | null;
    origin: ProjectOrigin;
    sourceLabel: string;
  }>;
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
  termSummaryRows?: Array<{
    term: number;
    received: number;
    exempted: number;
    expedited: number;
    fullReview: number;
    withdrawn: number;
  }>;
  academicYearVolume?: Array<{
    academicYear: string;
    received: number;
  }>;
  academicYearSummaryRows?: Array<{
    academicYear: string;
    received: number;
    exempted: number;
    expedited: number;
    fullReview: number;
    withdrawn: number;
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
    byProponentTypeWithdrawn?: {
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
  classificationMatrix?: {
    undergrad: { exempted: number; expedited: number; fullReview: number; withdrawn: number; total: number };
    grad: { exempted: number; expedited: number; fullReview: number; withdrawn: number; total: number };
    faculty: { exempted: number; expedited: number; fullReview: number; withdrawn: number; total: number };
    other: { exempted: number; expedited: number; fullReview: number; withdrawn: number; total: number };
    unknown: { exempted: number; expedited: number; fullReview: number; withdrawn: number; total: number };
    total: { exempted: number; expedited: number; fullReview: number; withdrawn: number; total: number };
  };
  withdrawnByProponentType?: {
    undergrad: number;
    grad: number;
    faculty: number;
    other: number;
    unknown: number;
  };
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
