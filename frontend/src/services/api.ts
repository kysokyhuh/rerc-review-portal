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
  ImportResult,
  ProjectImportPreview,
  ProjectImportRowEdit,
  CreateProjectPayload,
  CreateProjectResponse,
  ArchivedProject,
  ArchivedProjectsResponse,
  ReportsAcademicYearOption,
  ReportsSummaryResponse,
  HolidayItem,
  CreateHolidayPayload,
  UpdateHolidayPayload,
  ProtocolProfile,
  UpdateProtocolProfilePayload,
  ProtocolMilestone,
  CreateProtocolMilestonePayload,
  UpdateProtocolMilestonePayload,
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
  ImportResult,
  ProjectImportPreview,
  CreateProjectPayload,
  CreateProjectResponse,
  ArchivedProjectsResponse,
  ReportsAcademicYearOption,
  ReportsSummaryResponse,
  HolidayItem,
  CreateHolidayPayload,
  UpdateHolidayPayload,
  ProjectImportRowEdit,
  ProtocolProfile,
  UpdateProtocolProfilePayload,
  ProtocolMilestone,
  CreateProtocolMilestonePayload,
  UpdateProtocolMilestonePayload,
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
 * Fetch distinct college values for filter dropdowns
 */
export async function fetchColleges(committeeCode: string): Promise<string[]> {
  const response = await api.get(
    `/dashboard/colleges?committeeCode=${encodeURIComponent(committeeCode)}`
  );
  return response.data;
}

/**
 * Fetch queues for a specific committee
 */
export async function fetchDashboardQueues(
  committeeCode: string,
  filters?: Record<string, string>
) {
  const params = new URLSearchParams({ committeeCode });
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
  }
  const response = await api.get(`/dashboard/queues?${params.toString()}`);

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
  limit = 8,
  filters?: Record<string, string>
) {
  const params = new URLSearchParams({
    committeeCode,
    limit: String(limit),
  });
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
  }
  const response = await api.get(`/dashboard/activity?${params.toString()}`);
  return response.data as {
    committeeCode: string;
    items: DashboardActivityEntry[];
  };
}

export async function fetchDashboardOverdue(
  committeeCode: string,
  filters?: Record<string, string>
) {
  const params = new URLSearchParams({ committeeCode });
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
  }
  const response = await api.get(`/dashboard/overdue?${params.toString()}`);
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

export async function fetchProtocolProfile(projectId: number) {
  const response = await api.get(`/projects/${projectId}/profile`);
  return response.data as {
    profile: ProtocolProfile | null;
    milestones: ProtocolMilestone[];
  };
}

export async function updateProtocolProfile(
  projectId: number,
  payload: UpdateProtocolProfilePayload
) {
  const response = await api.put(`/projects/${projectId}/profile`, payload);
  return response.data as ProtocolProfile;
}

export async function createProtocolMilestone(
  projectId: number,
  payload: CreateProtocolMilestonePayload
) {
  const response = await api.post(`/projects/${projectId}/profile/milestones`, payload);
  return response.data as ProtocolMilestone;
}

export async function updateProtocolMilestone(
  projectId: number,
  milestoneId: number,
  payload: UpdateProtocolMilestonePayload
) {
  const response = await api.patch(
    `/projects/${projectId}/profile/milestones/${milestoneId}`,
    payload
  );
  return response.data as ProtocolMilestone;
}

export async function deleteProtocolMilestone(projectId: number, milestoneId: number) {
  const response = await api.delete(`/projects/${projectId}/profile/milestones/${milestoneId}`);
  return response.data as { success: boolean };
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

export async function fetchHolidays(params?: {
  year?: number;
  from?: string;
  to?: string;
}) {
  const search = new URLSearchParams();
  if (params?.year !== undefined) search.set("year", String(params.year));
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);

  const suffix = search.toString();
  const response = await api.get(`/holidays${suffix ? `?${suffix}` : ""}`);
  return response.data as { items: HolidayItem[] };
}

export async function createHoliday(payload: CreateHolidayPayload) {
  const response = await api.post("/holidays", payload);
  return response.data as HolidayItem;
}

export async function updateHoliday(id: number, payload: UpdateHolidayPayload) {
  const response = await api.patch(`/holidays/${id}`, payload);
  return response.data as HolidayItem;
}

export async function deleteHoliday(id: number) {
  const response = await api.delete(`/holidays/${id}`);
  return response.data as { success: boolean };
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

export async function fetchProjectImportTemplate() {
  const response = await api.get("/api/imports/projects/template", {
    responseType: "blob",
  });
  return response.data as Blob;
}

export async function importProjectsCsv(file: File) {
  return commitProjectsCsvImport(file);
}

export async function previewProjectsCsv(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/imports/projects/preview", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data as ProjectImportPreview;
}

export async function commitProjectsCsvImport(
  file: File,
  mapping?: Record<string, string | null>,
  rowEdits?: ProjectImportRowEdit[]
) {
  const formData = new FormData();
  formData.append("file", file);
  if (mapping) {
    formData.append("mapping", JSON.stringify(mapping));
  }
  if (rowEdits && rowEdits.length > 0) {
    formData.append("rowEdits", JSON.stringify(rowEdits));
  }
  const response = await api.post("/imports/projects/commit", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data as ImportResult;
}

export async function createProjectWithInitialSubmission(
  payload: CreateProjectPayload
) {
  const response = await api.post("/projects", payload);
  return response.data as CreateProjectResponse;
}

/**
 * Fetch archived projects (CLOSED or WITHDRAWN status)
 * These are historical protocols that don't appear in active dashboard queues.
 */
export async function fetchArchivedProjects(params?: {
  committeeCode?: string;
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  reviewType?: string;
  college?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.committeeCode) searchParams.set("committeeCode", params.committeeCode);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  if (params?.search) searchParams.set("search", params.search);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.reviewType) searchParams.set("reviewType", params.reviewType);
  if (params?.college) searchParams.set("college", params.college);
  
  const query = searchParams.toString();
  const url = `/projects/archived${query ? `?${query}` : ""}`;
  const response = await api.get(url);
  return response.data as ArchivedProjectsResponse;
}

export async function fetchReportAcademicYears() {
  const response = await api.get("/reports/academic-years");
  return response.data as { items: ReportsAcademicYearOption[] };
}

export async function fetchAcademicYearSummary(params: {
  academicYear: string;
  term: number | "ALL";
  committeeCode?: string;
}) {
  const searchParams = new URLSearchParams({
    academicYear: params.academicYear,
    term: String(params.term),
  });
  if (params.committeeCode) {
    searchParams.set("committeeCode", params.committeeCode);
  }
  const response = await api.get(
    `/reports/academic-year-summary?${searchParams.toString()}`
  );
  return response.data as ReportsSummaryResponse;
}

export default api;
