import axios from "axios";

// Minimal process typing so Vite builds without Node typings
declare const process: { env?: Record<string, string | undefined> };

// Guard against `process` being undefined in the browser; rely on Vite env first.
const API_BASE_URL =
  (typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_URL : undefined) ||
  (typeof process !== "undefined" ? process.env?.VITE_API_URL : undefined) ||
  "http://localhost:3000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token to requests if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

export interface QueueItem {
  id: number;
  projectId?: number;
  projectCode: string;
  projectTitle: string;
  piName: string;
  piAffiliation?: string | null;
  piEmail?: string | null;
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

export interface AttentionMetrics {
  overdue: number;
  dueSoon: number;
  classificationWait: number;
  missingLetterFields: number;
}

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

export interface SubmissionDetail {
  id: number;
  submissionType: string;
  status: string;
  receivedDate: string;
  finalDecision: string | null;
  finalDecisionDate: string | null;
  statusHistory: StatusHistoryEntry[];
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

/**
 * Fetch queues for a specific committee
 */
export async function fetchDashboardQueues(committeeCode: string) {
  const response = await api.get(
    `/dashboard/queues?committeeCode=${committeeCode}`
  );

  const data = response.data;
  const transformQueue = (items: any[], queue: QueueType): QueueItem[] => {
    return items.map((item) => ({
      id: item.id,
      projectId: item.project?.id,
      projectCode: item.project?.projectCode || "N/A",
      projectTitle: item.project?.title || "N/A",
      piName: item.project?.piName || "N/A",
      piAffiliation: item.project?.piAffiliation,
      submissionType: item.submissionType,
      status: item.status,
      receivedDate: item.receivedDate,
      daysRemaining: undefined,
      reviewType: item.classification?.reviewType ?? null,
      finalDecision: item.finalDecision ?? null,
      queue,
    }));
  };

  return {
    counts: {
      forClassification: data.counts?.classification || 0,
      forReview: data.counts?.review || 0,
      awaitingRevisions: data.counts?.revision || 0,
      completed: data.counts?.completed || 0,
    },
    classificationQueue: transformQueue(data.classificationQueue || [], "classification"),
    reviewQueue: transformQueue(data.reviewQueue || [], "review"),
    revisionQueue: transformQueue(data.revisionQueue || [], "revision"),
  };
}

/**
 * Fetch project details with full submission history
 */
export async function fetchProjectDetail(projectId: number) {
  const response = await api.get(`/projects/${projectId}/full`);
  return response.data as ProjectDetail;
}

export async function fetchSubmissionDetail(submissionId: number) {
  const response = await api.get(`/submissions/${submissionId}`);
  return response.data as SubmissionDetail;
}

export async function fetchSubmissionSlaSummary(submissionId: number) {
  const response = await api.get(`/submissions/${submissionId}/sla-summary`);
  return response.data as SubmissionSlaSummary;
}

/**
 * Export initial acknowledgement CSV
 */
export async function exportInitialAckCSV(submissionId: number) {
  const response = await api.get(
    `/mail-merge/initial-ack/${submissionId}/csv`,
    {
      responseType: "blob",
    }
  );
  return response.data;
}

/**
 * Export initial approval DOCX
 */
export async function exportInitialApprovalDocx(submissionId: number) {
  const response = await api.get(
    `/letters/initial-approval/${submissionId}.docx`,
    {
      responseType: "blob",
    }
  );
  return response.data;
}

export default api;
