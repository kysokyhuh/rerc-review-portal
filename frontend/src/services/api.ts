import axios from "axios";

// Re-export all types from the types module for backward compatibility
export type {
  QueueType,
  SLAStatus,
  StageFilter,
  QueueCounts,
  QueueItem,
  DecoratedQueueItem,
  AttentionMetrics,
  DashboardActivityEntry,
  OverdueReviewItem,
  ProjectSearchResult,
  LetterTemplateReadiness,
  StatusHistoryEntry,
  SubmissionDetail,
  ProjectDetail,
  SubmissionSlaSummary,
  CommitteeSummary,
} from "@/types";

import type {
  QueueItem,
  QueueType,
  ProjectDetail,
  SubmissionDetail,
  SubmissionSlaSummary,
  DashboardActivityEntry,
  OverdueReviewItem,
  ProjectSearchResult,
  CommitteeSummary,
} from "@/types";

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
      staffInChargeName: item.staffInCharge?.fullName ?? null,
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

export async function fetchDashboardActivity(
  committeeCode: string,
  limit = 8
) {
  const response = await api.get(
    `/dashboard/activity?committeeCode=${committeeCode}&limit=${limit}`
  );
  return response.data as {
    committeeCode: string;
    items: DashboardActivityEntry[];
  };
}

export async function fetchDashboardOverdue(committeeCode: string) {
  const response = await api.get(
    `/dashboard/overdue?committeeCode=${committeeCode}`
  );
  return response.data as {
    committeeCode: string;
    overdueReviews: OverdueReviewItem[];
    overdueEndorsements: OverdueReviewItem[];
  };
}

export async function searchProjects(
  query: string,
  committeeCode?: string,
  limit = 8
) {
  const params = new URLSearchParams();
  params.set("q", query);
  params.set("limit", String(limit));
  if (committeeCode) {
    params.set("committeeCode", committeeCode);
  }
  const response = await api.get(`/projects/search?${params.toString()}`);
  return response.data as { items: ProjectSearchResult[] };
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

export async function updateSubmissionOverview(
  submissionId: number,
  payload: {
    submissionType?: string;
    receivedDate?: string;
    status?: string;
    finalDecision?: string | null;
    finalDecisionDate?: string | null;
    piName?: string;
    committeeId?: number;
    changeReason?: string;
  }
) {
  const response = await api.patch(
    `/submissions/${submissionId}/overview`,
    payload
  );
  return response.data as SubmissionDetail;
}

export async function fetchSubmissionSlaSummary(submissionId: number) {
  const response = await api.get(`/submissions/${submissionId}/sla-summary`);
  return response.data as SubmissionSlaSummary;
}

export async function fetchCommittees() {
  const response = await api.get("/committees");
  return response.data as CommitteeSummary[];
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
