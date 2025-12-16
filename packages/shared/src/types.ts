// packages/shared/src/types.ts
// Shared types and DTOs used across backend and frontend

// API Response Wrappers
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// User Types
export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: string;
  affiliation?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  role: string;
  affiliation?: string;
  phone?: string;
}

// Project Types
export interface ProjectDTO {
  id: string;
  projectNumber: string;
  title: string;
  principalInvestigator: string;
  department: string;
  fundingType: string;
  fundingSource?: string;
  studyDescription?: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  projectNumber: string;
  title: string;
  principalInvestigator: string;
  department: string;
  fundingType: string;
  fundingSource?: string;
  studyDescription?: string;
}

// Submission Types
export interface SubmissionDTO {
  id: string;
  projectId: string;
  submissionNumber: string;
  submissionType: string;
  status: string;
  completenessStatus?: string;
  completenessNotes?: string;
  classificationAssignedAt?: string;
  classificationAssignedBy?: string;
  lastStatusChangeAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubmissionRequest {
  projectId: string;
  submissionType: string;
}

// Classification Types
export interface ClassificationDTO {
  id: string;
  submissionId: string;
  reviewType: string;
  classifiedAt: string;
  classifiedBy: string;
  rationale?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClassificationRequest {
  submissionId: string;
  reviewType: string;
  rationale?: string;
}

// Review Types
export interface ReviewDTO {
  id: string;
  submissionId: string;
  assignedTo: string;
  decision?: string;
  comments?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewRequest {
  submissionId: string;
  assignedTo: string;
}

export interface SubmitReviewRequest {
  reviewId: string;
  decision: string;
  comments?: string;
}

// Panel Types
export interface PanelDTO {
  id: string;
  name: string;
  description?: string;
  chairId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PanelMemberDTO {
  id: string;
  panelId: string;
  userId: string;
  role: string;
  joinedAt: string;
}

// Committee Types
export interface CommitteeDTO {
  id: string;
  name: string;
  description?: string;
  chairId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommitteeMemberDTO {
  id: string;
  committeeId: string;
  userId: string;
  role: string;
  joinedAt: string;
}

// Mail-Merge Letter Types
export interface MailMergeLetterRequest {
  submissionId: string;
  letterCode: string; // e.g., "6B", "20B", "6D", etc.
}

export interface MailMergeLetterResponse {
  success: boolean;
  letterCode: string;
  submissionId: string;
  generatedAt: string;
  csv?: string; // CSV data for download
}

// Dashboard Types
export interface DashboardQueueItem {
  id: string;
  submissionId: string;
  projectNumber: string;
  pi: string;
  title: string;
  status: string;
  daysWaiting: number;
  assignedTo?: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface DashboardSummary {
  totalProjects: number;
  totalSubmissions: number;
  submissionsUnderReview: number;
  submissionsAwaitingRevisions: number;
  overdueSLAs: number;
  completedThisMonth: number;
}

// SLA and Deadline Types
export interface SLADeadline {
  id: string;
  submissionId: string;
  stage: string;
  dueDate: string;
  wasDueDate?: string;
  status: "PENDING" | "MET" | "MISSED" | "WAIVED";
}

export interface ConfigSLADTO {
  id: string;
  stage: string;
  workingDays: number;
  description?: string;
}

// Submission Status History
export interface SubmissionStatusHistoryDTO {
  id: string;
  submissionId: string;
  previousStatus?: string;
  newStatus: string;
  changedBy: string;
  changedAt: string;
  reason?: string;
}

// Audit Log Types
export interface AuditLogDTO {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, any>;
  timestamp: string;
}

// Error Types
export interface ValidationError {
  field: string;
  message: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  validationErrors?: ValidationError[];
  timestamp: string;
}

// Request Context (for middleware)
export interface RequestContext {
  userId: string;
  userRole: string;
  requestId: string;
  timestamp: string;
}
