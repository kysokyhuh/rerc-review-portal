import axios from "axios";

const API_BASE_URL = process.env.VITE_API_URL || "http://localhost:3000";

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

export interface QueueCounts {
  forClassification: number;
  forReview: number;
  awaitingRevisions: number;
  completed: number;
}

export interface QueueItem {
  id: number;
  projectCode: string;
  projectTitle: string;
  piName: string;
  submissionType: string;
  status: string;
  receivedDate: string;
  daysRemaining?: number;
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

export interface SubmissionDetail {
  id: number;
  submissionType: string;
  status: string;
  receivedDate: string;
  finalDecision: string | null;
  finalDecisionDate: string | null;
  statusHistory: StatusHistoryEntry[];
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

/**
 * Fetch queues for a specific committee
 */
export async function fetchDashboardQueues(committeeCode: string) {
  const response = await api.get(
    `/dashboard/queues?committeeCode=${committeeCode}`
  );

  // Transform the backend response to match frontend types
  const data = response.data;
  const transformQueue = (items: any[]): QueueItem[] => {
    return items.map((item) => ({
      id: item.id,
      projectCode: item.project?.projectCode || "N/A",
      projectTitle: item.project?.title || "N/A",
      piName: item.project?.piName || "N/A",
      submissionType: item.submissionType,
      status: item.status,
      receivedDate: item.receivedDate,
      daysRemaining: undefined,
    }));
  };

  return {
    counts: {
      forClassification: data.counts?.classification || 0,
      forReview: data.counts?.review || 0,
      awaitingRevisions: data.counts?.revision || 0,
      completed: data.counts?.completed || 0,
    },
    classificationQueue: transformQueue(data.classificationQueue || []),
    reviewQueue: transformQueue(data.reviewQueue || []),
    revisionQueue: transformQueue(data.revisionQueue || []),
  };
}

/**
 * Fetch project details with full submission history
 */
export async function fetchProjectDetail(projectId: number) {
  const response = await api.get(`/projects/${projectId}/full`);
  return response.data as ProjectDetail;
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
