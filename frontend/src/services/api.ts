import axios, {
  type AxiosProgressEvent,
  type InternalAxiosRequestConfig,
} from "axios";

// Re-export all types from the types module for backward compatibility
export type {
  AuthProfile,
  UpdateProfilePayload,
  ChangePasswordPayload,
  QueueType,
  SLAStatus,
  StageFilter,
  QueueCounts,
  QueueItem,
  DecoratedQueueItem,
  ReviewerCandidate,
  BulkActionResponse,
  BulkProjectDeleteResponse,
  BulkReminderTarget,
  BulkStatusAction,
  AttentionMetrics,
  DashboardActivityEntry,
  OverdueReviewItem,
  ProjectSearchResult,
  LetterTemplateReadiness,
  StatusHistoryEntry,
  SubmissionDetail,
  ReviewDecision,
  ProjectDetail,
  SubmissionSlaSummary,
  CommitteeSummary,
  ImportResult,
  ImportMode,
  ImportModeFit,
  ImportWarning,
  ImportBatchSummary,
  ProjectImportPreview,
  ProjectImportRowEdit,
  CreateProjectPayload,
  CreateProjectResponse,
  ArchivedProject,
  ArchivedProjectsResponse,
  RecentlyDeletedProject,
  RecentlyDeletedProjectsResponse,
  ExemptedQueueItem,
  ExemptedQueueResponse,
  ReportsAcademicYearOption,
  ReportsAcademicYearsResponse,
  ReportsSummaryResponse,
  AnnualReportSummaryResponse,
  AnnualReportSubmissionsResponse,
  HolidayItem,
  CreateHolidayPayload,
  UpdateHolidayPayload,
  AcademicTerm,
  CreateAcademicTermPayload,
  UpdateAcademicTermPayload,
  ProtocolProfile,
  UpdateProtocolProfilePayload,
  ProtocolMilestone,
  CreateProtocolMilestonePayload,
  UpdateProtocolMilestonePayload,
} from "@/types";

import type {
  AuthProfile,
  UpdateProfilePayload,
  ChangePasswordPayload,
  QueueItem,
  QueueType,
  ProjectDetail,
  SubmissionDetail,
  ReviewDecision,
  SubmissionSlaSummary,
  ReviewerCandidate,
  BulkActionResponse,
  BulkProjectDeleteResponse,
  BulkReminderTarget,
  BulkStatusAction,
  DashboardActivityEntry,
  OverdueReviewItem,
  ProjectSearchResult,
  CommitteeSummary,
  ImportResult,
  ProjectImportPreview,
  CreateProjectPayload,
  CreateProjectResponse,
  ArchivedProjectsResponse,
  RecentlyDeletedProjectsResponse,
  ExemptedQueueResponse,
  ReportsAcademicYearsResponse,
  ReportsSummaryResponse,
  AnnualReportSummaryResponse,
  AnnualReportSubmissionsResponse,
  HolidayItem,
  CreateHolidayPayload,
  UpdateHolidayPayload,
  AcademicTerm,
  CreateAcademicTermPayload,
  UpdateAcademicTermPayload,
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
  (
    typeof window !== "undefined" &&
    typeof import.meta !== "undefined" &&
    import.meta.env?.PROD
      ? window.location.origin
      : undefined
  ) ||
  (typeof process !== "undefined" ? process.env?.VITE_API_URL : undefined) ||
  "http://localhost:3000";

export const authApi = axios.create({
  withCredentials: true,
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const api = axios.create({
  withCredentials: true,
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const AUTH_PAGE_PATHS = new Set([
  "/login",
  "/signup",
  "/change-password",
]);
const SESSION_EXEMPT_PATHS = new Set([
  "/auth/signup",
  "/auth/login",
  "/auth/logout",
  "/auth/me",
  "/auth/refresh",
]);
const MUTATING_METHODS = new Set(["post", "put", "patch", "delete"]);
const AUTH_ROUTES_THAT_ROTATE_CSRF = new Set([
  "/auth/login",
  "/auth/refresh",
  "/auth/change-password",
  "/auth/logout",
]);
const CSRF_COOKIE_NAME =
  typeof import.meta !== "undefined" && import.meta.env?.PROD
    ? "__Host-csrfToken"
    : "csrfToken";

let sessionRefreshPromise: Promise<void> | null = null;
let csrfBootstrapPromise: Promise<void> | null = null;
let sessionExpiredHandler: (() => void) | null = null;
let sessionRedirectInFlight = false;
let csrfTokenCache: string | null = null;
const CSRF_HEADER_NAMES = ["X-CSRF-Token", "x-csrf-token"] as const;

function clearCsrfTokenCache() {
  csrfTokenCache = null;
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const target = `${name}=`;
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(target));
  return entry ? decodeURIComponent(entry.slice(target.length)) : null;
}

function getCachedCsrfToken() {
  const cookieToken = getCookieValue(CSRF_COOKIE_NAME);
  if (cookieToken) {
    csrfTokenCache = cookieToken;
    return cookieToken;
  }

  if (typeof document !== "undefined") {
    csrfTokenCache = null;
    return null;
  }

  return csrfTokenCache;
}

function setRequestHeader(
  config: InternalAxiosRequestConfig,
  name: string,
  value: string
) {
  config.headers = config.headers ?? {};
  if (typeof config.headers.set === "function") {
    config.headers.set(name, value);
    return;
  }
  config.headers[name] = value;
}

function clearRequestHeader(config: InternalAxiosRequestConfig, name: string) {
  const headers = config.headers;
  if (!headers) {
    return;
  }
  if (typeof headers.delete === "function") {
    headers.delete(name);
    return;
  }
  delete headers[name];
}

function clearCsrfHeaders(config: InternalAxiosRequestConfig) {
  for (const name of CSRF_HEADER_NAMES) {
    clearRequestHeader(config, name);
  }
}

function getRequestPath(url?: string) {
  if (!url) return null;
  try {
    return new URL(url, API_BASE_URL).pathname;
  } catch {
    return null;
  }
}

async function attachCsrfToken(config: InternalAxiosRequestConfig) {
  const method = (config.method || "get").toLowerCase();
  if (!MUTATING_METHODS.has(method)) {
    return config;
  }

  const requestPath = getRequestPath(config.url);
  if (requestPath === "/auth/csrf") {
    return config;
  }

  let csrfToken = getCachedCsrfToken();
  if (!csrfToken) {
    await ensureCsrfCookie();
    csrfToken = getCachedCsrfToken();
  }

  if (!csrfToken) {
    return config;
  }

  setRequestHeader(config, "X-CSRF-Token", csrfToken);
  return config;
}

authApi.interceptors.request.use(attachCsrfToken);
api.interceptors.request.use(attachCsrfToken);

authApi.interceptors.response.use(
  (response) => {
    const requestPath = getRequestPath(response.config?.url);
    if (requestPath === "/auth/csrf" && response.data?.csrfToken) {
      csrfTokenCache = response.data.csrfToken as string;
    }
    if (requestPath && AUTH_ROUTES_THAT_ROTATE_CSRF.has(requestPath)) {
      clearCsrfTokenCache();
    }
    return response;
  },
  (error) => {
    const requestPath = getRequestPath(error.config?.url);
    if (
      requestPath &&
      (AUTH_ROUTES_THAT_ROTATE_CSRF.has(requestPath) || requestPath === "/auth/me") &&
      error.response?.status >= 400
    ) {
      clearCsrfTokenCache();
    }
    return Promise.reject(error);
  }
);

const isAuthPagePath = (path: string) => AUTH_PAGE_PATHS.has(path);

const isSessionExemptRequest = (url?: string) =>
  Array.from(SESSION_EXEMPT_PATHS).some((path) => url?.startsWith(path));

export function getSafeNextPath(value?: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  try {
    const url = new URL(value, "http://localhost");
    if (isAuthPagePath(url.pathname)) {
      return null;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

const getCurrentPath = () => {
  if (typeof window === "undefined") return null;
  return getSafeNextPath(
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  );
};

export function buildExpiredLoginUrl(nextPath?: string | null) {
  const params = new URLSearchParams({ expired: "true" });
  const safeNext = getSafeNextPath(nextPath);
  if (safeNext) {
    params.set("next", safeNext);
  }
  return `/login?${params.toString()}`;
}

export function registerSessionExpiredHandler(handler: () => void) {
  sessionExpiredHandler = handler;
  return () => {
    if (sessionExpiredHandler === handler) {
      sessionExpiredHandler = null;
    }
  };
}

export async function ensureCsrfCookie(): Promise<void> {
  const cachedToken = getCachedCsrfToken();
  if (cachedToken) {
    csrfTokenCache = cachedToken;
    return;
  }

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = authApi
      .get("/auth/csrf")
      .then((response) => {
        const csrfToken = response.data?.csrfToken;
        if (typeof csrfToken === "string" && csrfToken.length > 0) {
          csrfTokenCache = csrfToken;
        }
      })
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }

  return csrfBootstrapPromise;
}

export async function refreshAccessSession(): Promise<void> {
  if (!sessionRefreshPromise) {
    await ensureCsrfCookie();
    sessionRefreshPromise = authApi
      .post("/auth/refresh", {})
      .then(() => undefined)
      .finally(() => {
        sessionRefreshPromise = null;
      });
  }

  return sessionRefreshPromise;
}

export async function logoutSession(): Promise<void> {
  await ensureCsrfCookie();
  try {
    await authApi.post("/auth/logout", {});
  } finally {
    clearCsrfTokenCache();
  }
}

export async function fetchMyProfile(): Promise<AuthProfile> {
  const response = await api.get("/auth/profile");
  return response.data.user as AuthProfile;
}

export async function warmBackendConnection(): Promise<void> {
  await api.get("/live", {
    headers: {
      "Cache-Control": "no-cache",
    },
  });
}

export async function waitForBackendReady(): Promise<void> {
  await api.get("/ready", {
    headers: {
      "Cache-Control": "no-cache",
    },
  });
}

export async function updateMyProfile(
  payload: UpdateProfilePayload
): Promise<AuthProfile> {
  const response = await api.patch("/auth/profile", payload);
  return response.data.user as AuthProfile;
}

export async function changeOwnPassword(
  payload: ChangePasswordPayload
): Promise<AuthProfile> {
  await ensureCsrfCookie();
  const response = await authApi.post("/auth/change-password", payload);
  return response.data.user as AuthProfile;
}

export function forceSessionExpiredRedirect(nextPath?: string | null) {
  if (typeof window === "undefined") return;

  clearCsrfTokenCache();
  sessionExpiredHandler?.();

  if (sessionRedirectInFlight || isAuthPagePath(window.location.pathname)) {
    return;
  }

  sessionRedirectInFlight = true;
  window.location.assign(buildExpiredLoginUrl(nextPath ?? getCurrentPath()));
}
// ---------------------------------------------------------------------------
// Cold-start retry — Render free tier can take up to ~60s to spin up
// ---------------------------------------------------------------------------

const COLD_START_MAX_RETRIES = 6;
const COLD_START_BACKOFF_MS = [1500, 3000, 6000, 10000, 15000, 20000];
const COLD_START_RETRY_METHODS = new Set(["get", "head", "options"]);

function emitColdStartWindowState(active: boolean) {
  if (typeof window === "undefined") return;
  window.__rercColdStartActive = active;
  window.dispatchEvent(
    new Event(active ? "rerc:cold-start" : "rerc:cold-start-resolved")
  );
}

function isColdStartError(error: unknown): boolean {
  if (!axios.isAxiosError(error) || !error.response) return true; // network error
  const status = error.response.status;
  return status === 502 || status === 503 || status === 504;
}

function canRetryColdStartRequest(config: InternalAxiosRequestConfig): boolean {
  const method = (config.method || "get").toLowerCase();
  if (COLD_START_RETRY_METHODS.has(method)) return true;
  return Boolean((config as { _retryOnColdStart?: boolean })._retryOnColdStart);
}

api.interceptors.response.use(
  (response) => {
    emitColdStartWindowState(false);
    return response;
  },
  async (error) => {
    const config = error.config ?? {};

    if (isSessionExemptRequest(config.url)) {
      return Promise.reject(error);
    }

    if (isColdStartError(error)) {
      emitColdStartWindowState(true);
      const retryCount = config._coldRetry || 0;
      if (
        canRetryColdStartRequest(config) &&
        retryCount < COLD_START_MAX_RETRIES
      ) {
        config._coldRetry = retryCount + 1;
        const delay = COLD_START_BACKOFF_MS[retryCount] ?? 6000;
        await new Promise((r) => setTimeout(r, delay));
        return api(config);
      }
      emitColdStartWindowState(false);
    }

    if (error.response?.status === 401 && !config._sessionRetry) {
      config._sessionRetry = true;
      try {
        await refreshAccessSession();
        clearCsrfTokenCache();
        clearCsrfHeaders(config);
        return api(config);
      } catch (refreshError) {
        forceSessionExpiredRedirect();
        return Promise.reject(refreshError);
      }
    }

    if (
      error.response?.status === 403 &&
      error.response?.data?.message === "Forbidden" &&
      !config._forbiddenSessionRetry
    ) {
      config._forbiddenSessionRetry = true;
      try {
        await refreshAccessSession();
        clearCsrfTokenCache();
        clearCsrfHeaders(config);
        return api(config);
      } catch {
        forceSessionExpiredRedirect();
        return Promise.reject(error);
      }
    }

    const method = (config.method || "get").toLowerCase();
    if (
      error.response?.status === 403 &&
      error.response?.data?.code === "INVALID_CSRF_TOKEN" &&
      MUTATING_METHODS.has(method) &&
      !config._csrfRetry
    ) {
      config._csrfRetry = true;
      clearCsrfTokenCache();
      clearCsrfHeaders(config);
      try {
        await ensureCsrfCookie();
        return api(config);
      } catch (csrfError) {
        return Promise.reject(csrfError);
      }
    }

    if (
      error.response?.status === 403 &&
      error.response?.data?.code === "PASSWORD_CHANGE_REQUIRED" &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/change-password"
    ) {
      window.location.assign("/change-password");
    }

    return Promise.reject(error);
  }
);

/**
 * Fetch distinct college values for filter dropdowns
 */
export async function fetchColleges(committeeCode: string): Promise<string[]> {
  const response = await api.get(
    `/dashboard/colleges?committeeCode=${encodeURIComponent(committeeCode)}`
  );
  return response.data;
}

export async function fetchDepartments(committeeCode: string): Promise<string[]> {
  const response = await api.get(
    `/dashboard/departments?committeeCode=${encodeURIComponent(committeeCode)}`
  );
  return response.data;
}

export async function fetchProponents(committeeCode: string): Promise<string[]> {
  const response = await api.get(
    `/dashboard/proponents?committeeCode=${encodeURIComponent(committeeCode)}`
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
  type DashboardQueueApiItem = {
    id: number;
    project?: {
      id?: number;
      projectCode?: string | null;
      title?: string | null;
      piName?: string | null;
      piAffiliation?: string | null;
    } | null;
    staffInCharge?: {
      fullName?: string | null;
    } | null;
    submissionType?: string | null;
    status?: string | null;
    receivedDate?: string | null;
    classification?: {
      reviewType?: string | null;
    } | null;
    finalDecision?: string | null;
    sla?: {
      remainingDays?: number | null;
      elapsedDays?: number | null;
      targetDays?: number | null;
      stage?: QueueItem["slaStage"];
      dayMode?: QueueItem["slaDayMode"];
      slaStatus?: QueueItem["slaStatus"];
      dueDate?: string | null;
      startedAt?: string | null;
      ownerRole?: QueueItem["overdueOwnerRole"];
      ownerLabel?: string | null;
      ownerIcon?: string | null;
      ownerReason?: string | null;
      reason?: string | null;
    } | null;
  };

  const transformQueue = (
    items: DashboardQueueApiItem[],
    queue: QueueType
  ): QueueItem[] => {
    return items.map((item) => ({
      id: item.id,
      projectId: item.project?.id,
      projectCode: item.project?.projectCode || "N/A",
      projectTitle: item.project?.title || "N/A",
      piName: item.project?.piName || "N/A",
      piAffiliation: item.project?.piAffiliation,
      staffInChargeName: item.staffInCharge?.fullName ?? null,
      submissionType: item.submissionType ?? "UNKNOWN",
      status: item.status ?? "UNKNOWN",
      receivedDate: typeof item.receivedDate === "string" ? item.receivedDate : "",
      daysRemaining: item.sla?.remainingDays ?? null,
      daysElapsed: item.sla?.elapsedDays ?? null,
      targetDays: item.sla?.targetDays ?? null,
      reviewType: item.classification?.reviewType ?? null,
      finalDecision: item.finalDecision ?? null,
      queue,
      slaStage: item.sla?.stage ?? null,
      slaDayMode: item.sla?.dayMode ?? null,
      slaStatus: item.sla?.slaStatus ?? "ON_TRACK",
      slaDueDate: item.sla?.dueDate ?? null,
      startedAt: item.sla?.startedAt ?? null,
      overdueOwner: item.sla?.ownerRole
        ? item.sla.ownerRole === "PROJECT_LEADER_RESEARCHER_PROPONENT"
          ? "RESEARCHER"
          : "PANEL"
        : undefined,
      overdueOwnerRole: item.sla?.ownerRole,
      overdueOwnerLabel: item.sla?.ownerLabel ?? undefined,
      overdueOwnerIcon: item.sla?.ownerIcon ?? undefined,
      overdueOwnerReason: item.sla?.ownerReason ?? undefined,
      overdueReason: item.sla?.reason ?? undefined,
    }));
  };

  return {
    counts: {
      forClassification: data.counts?.classification || 0,
      forReview: data.counts?.review || 0,
      forExempted: data.counts?.exempted || 0,
      awaitingRevisions: data.counts?.revision || 0,
      completed: data.counts?.completed || 0,
    },
    classificationQueue: transformQueue(data.classificationQueue || [], "classification"),
    reviewQueue: transformQueue(data.reviewQueue || [], "review"),
    exemptedQueue: transformQueue(data.exemptedQueue || [], "review"),
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

export async function archiveProjectRecord(
  projectId: number,
  payload: {
    mode: "CLOSED" | "WITHDRAWN";
    reason: string;
  }
) {
  const response = await api.post(`/projects/${projectId}/archive`, payload);
  return response.data as {
    project: {
      id: number;
      overallStatus: string;
    };
    history: {
      id: number;
      oldStatus: string | null;
      newStatus: string;
      effectiveDate: string;
      reason: string | null;
    };
  };
}

export async function restoreProjectRecord(
  projectId: number,
  payload: {
    reason: string;
  }
) {
  const response = await api.post(`/projects/${projectId}/restore`, payload);
  return response.data as {
    project: {
      id: number;
      overallStatus: string;
    };
    history: {
      id: number;
      oldStatus: string | null;
      newStatus: string;
      effectiveDate: string;
      reason: string | null;
    };
  };
}

export async function deleteProjectRecord(
  projectId: number,
  payload: {
    reason: string;
  }
) {
  const response = await api.post(`/projects/${projectId}/delete`, payload, {
    _retryOnColdStart: true,
  } as never);
  return response.data as {
    project: {
      id: number;
      projectCode?: string | null;
      overallStatus: string;
      deletedAt: string | null;
      deletePurgeAt: string | null;
      deletedReason: string | null;
      deletedFromStatus: string | null;
      deletedBy: {
        id: number;
        fullName: string;
        email: string;
      } | null;
    };
  };
}

export async function deleteProjectRecordsBulk(payload: {
  projectIds: number[];
  reason: string;
}) {
  const response = await api.post("/projects/bulk/delete", payload, {
    _retryOnColdStart: true,
  } as never);
  return response.data as BulkProjectDeleteResponse;
}

export async function restoreDeletedProjectRecord(
  projectId: number,
  payload: {
    reason: string;
    targetStatus: "DRAFT" | "ACTIVE" | "INACTIVE" | "WITHDRAWN" | "CLOSED";
  }
) {
  const response = await api.post(`/projects/${projectId}/restore-deleted`, payload, {
    _retryOnColdStart: true,
  } as never);
  return response.data as {
    project: {
      id: number;
      overallStatus: string;
    };
    history: {
      id: number;
      oldStatus: string | null;
      newStatus: string;
      effectiveDate: string;
      reason: string | null;
    };
  };
}

export async function fetchSubmissionDetail(submissionId: number) {
  const response = await api.get(`/submissions/${submissionId}`);
  return response.data as SubmissionDetail;
}

export async function submitAssignedReviewDecision(
  reviewId: number,
  payload: {
    decision: ReviewDecision;
    remarks?: string | null;
  }
) {
  const response = await api.post(`/submissions/reviews/${reviewId}/decision`, payload);
  return response.data;
}

export async function fetchReviewerCandidates() {
  const response = await api.get("/submissions/reviewer-candidates");
  return response.data as ReviewerCandidate[];
}

export async function bulkAssignReviewers(payload: {
  submissionIds: number[];
  reviewerId: number;
  reviewerRole: "SCIENTIST" | "LAY" | "INDEPENDENT_CONSULTANT";
  dueDate?: string | null;
  isPrimary?: boolean;
}) {
  const response = await api.post("/submissions/bulk/assign-reviewer", payload);
  return response.data as BulkActionResponse;
}

export async function bulkRunStatusAction(payload: {
  submissionIds: number[];
  action: BulkStatusAction;
  reason?: string | null;
  completenessStatus?:
    | "COMPLETE"
    | "MINOR_MISSING"
    | "MAJOR_MISSING"
    | "MISSING_SIGNATURES"
    | "OTHER";
  completenessRemarks?: string | null;
}) {
  const response = await api.post("/submissions/bulk/status-action", payload);
  return response.data as BulkActionResponse;
}

export async function bulkCreateReminders(payload: {
  submissionIds: number[];
  target: BulkReminderTarget;
  note: string;
}) {
  const response = await api.post("/submissions/bulk/reminders", payload);
  return response.data as BulkActionResponse;
}

export async function updateSubmissionOverview(
  submissionId: number,
  payload: {
    submissionType?: string;
    receivedDate?: string;
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

export async function updateSubmissionWorkflowStage(
  submissionId: number,
  payload: {
    newStatus:
      | "AWAITING_CLASSIFICATION"
      | "UNDER_CLASSIFICATION"
      | "CLASSIFIED";
    reason?: string;
  }
) {
  const response = await api.patch(`/submissions/${submissionId}/status`, payload);
  return response.data as {
    submission: { id: number; status: string };
    history: { id: number; newStatus: string; oldStatus?: string | null };
  };
}

export async function setSubmissionReviewTrack(
  submissionId: number,
  payload: {
    reviewType: "EXEMPT" | "EXPEDITED" | "FULL_BOARD" | null;
    classificationDate?: string;
    rationale?: string;
    panelId?: number | null;
  }
) {
  const response = await api.post(`/submissions/${submissionId}/classifications`, payload);
  return response.data as {
    id: number;
    submissionId: number;
    reviewType: string;
    classificationDate: string;
  };
}

export async function startSubmissionReview(submissionId: number) {
  const response = await api.post(`/submissions/${submissionId}/start-review`, {});
  return response.data as {
    submission: { id: number; status: string };
    history: { id: number; oldStatus: string | null; newStatus: string };
  };
}

export async function fetchSubmissionSlaSummary(submissionId: number) {
  const response = await api.get(`/submissions/${submissionId}/sla-summary`);
  return response.data as SubmissionSlaSummary;
}

export async function fetchCommittees() {
  const response = await api.get("/committees");
  return response.data as CommitteeSummary[];
}

export async function fetchCommitteePanels(committeeCode: string) {
  const response = await api.get(`/committees/${committeeCode}/panels`);
  const data = response.data as {
    panels: Array<{ id: number; name: string; code: string | null; isActive: boolean }>;
  };
  return data.panels.filter((p) => p.isActive);
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

export async function fetchAcademicTerms(params?: { year?: string }) {
  const search = new URLSearchParams();
  if (params?.year) search.set("year", params.year);
  const suffix = search.toString();
  const response = await api.get(`/academic-terms${suffix ? `?${suffix}` : ""}`);
  return response.data as { items: AcademicTerm[] };
}

export async function createAcademicTerm(payload: CreateAcademicTermPayload) {
  const response = await api.post("/academic-terms", payload);
  return response.data as AcademicTerm;
}

export async function updateAcademicTerm(id: number, payload: UpdateAcademicTermPayload) {
  const response = await api.patch(`/academic-terms/${id}`, payload);
  return response.data as AcademicTerm;
}

export async function deleteAcademicTerm(id: number) {
  const response = await api.delete(`/academic-terms/${id}`);
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

export interface CsvUploadProgress {
  loaded: number;
  total: number | null;
  percent: number | null;
}

const normalizeUploadProgress = (
  event: AxiosProgressEvent
): CsvUploadProgress => {
  const total =
    typeof event.total === "number" && Number.isFinite(event.total)
      ? event.total
      : null;
  const loaded =
    typeof event.loaded === "number" && Number.isFinite(event.loaded)
      ? event.loaded
      : 0;
  const percent =
    total && total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : null;

  return {
    loaded,
    total,
    percent,
  };
};

export async function previewProjectsCsv(
  file: File,
  options?: {
    onUploadProgress?: (progress: CsvUploadProgress) => void;
  }
) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/imports/projects/preview", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: options?.onUploadProgress
      ? (event) => options.onUploadProgress?.(normalizeUploadProgress(event))
      : undefined,
  });
  return response.data as ProjectImportPreview;
}

export async function commitProjectsCsvImport(
  file: File,
  mapping?: Record<string, string | null>,
  rowEdits?: ProjectImportRowEdit[],
  options?: {
    onUploadProgress?: (progress: CsvUploadProgress) => void;
  }
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
    onUploadProgress: options?.onUploadProgress
      ? (event) => options.onUploadProgress?.(normalizeUploadProgress(event))
      : undefined,
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
 * Fetch explicitly archived projects (project overallStatus CLOSED or WITHDRAWN)
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
  sortBy?: "lastModified" | "submitted";
  sortDir?: "asc" | "desc";
}) {
  const searchParams = new URLSearchParams();
  if (params?.committeeCode) searchParams.set("committeeCode", params.committeeCode);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  if (params?.search) searchParams.set("search", params.search);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.reviewType) searchParams.set("reviewType", params.reviewType);
  if (params?.college) searchParams.set("college", params.college);
  if (params?.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params?.sortDir) searchParams.set("sortDir", params.sortDir);
  
  const query = searchParams.toString();
  const url = `/projects/archived${query ? `?${query}` : ""}`;
  const response = await api.get(url);
  return response.data as ArchivedProjectsResponse;
}

export async function fetchRecentlyDeletedProjects(params?: {
  committeeCode?: string;
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  reviewType?: string;
  college?: string;
  sortBy?: "lastModified" | "submitted";
  sortDir?: "asc" | "desc";
}) {
  const searchParams = new URLSearchParams();
  if (params?.committeeCode) searchParams.set("committeeCode", params.committeeCode);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  if (params?.search) searchParams.set("search", params.search);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.reviewType) searchParams.set("reviewType", params.reviewType);
  if (params?.college) searchParams.set("college", params.college);
  if (params?.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params?.sortDir) searchParams.set("sortDir", params.sortDir);

  const query = searchParams.toString();
  const url = `/projects/recently-deleted${query ? `?${query}` : ""}`;
  const response = await api.get(url);
  return response.data as RecentlyDeletedProjectsResponse;
}

export async function fetchExemptedQueue(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  college?: string;
  committee?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params?.q) searchParams.set("q", params.q);
  if (params?.college) searchParams.set("college", params.college);
  if (params?.committee) searchParams.set("committee", params.committee);

  const query = searchParams.toString();
  const url = `/queues/exempted${query ? `?${query}` : ""}`;
  const response = await api.get(url);
  return response.data as ExemptedQueueResponse;
}

export async function issueExemption(submissionId: number, payload: { resultsNotifiedAt: string }) {
  const response = await api.post(`/submissions/${submissionId}/issue-exemption`, payload);
  return response.data;
}

export async function fetchReportAcademicYears() {
  const response = await api.get("/reports/academic-years");
  return response.data as ReportsAcademicYearsResponse;
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

export async function fetchAnnualReportSummary(params: {
  periodMode?: "ACADEMIC" | "CUSTOM" | "CALENDAR";
  ay: string;
  term: "ALL" | 1 | 2 | 3;
  startDate?: string;
  endDate?: string;
  startYear?: string;
  endYear?: string;
  committee: string;
  college: string;
  panel: string;
  category: "ALL" | "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING";
  reviewType?: "ALL" | "EXEMPT" | "EXPEDITED" | "FULL_BOARD" | "UNCLASSIFIED" | "WITHDRAWN";
  status?: "ALL" | string;
  q?: string;
}) {
  const search = new URLSearchParams({
    periodMode: params.periodMode ?? "ACADEMIC",
    ay: params.ay,
    term: String(params.term),
    committee: params.committee,
    college: params.college,
    panel: params.panel,
    category: params.category,
  });
  if (params.startDate) search.set("startDate", params.startDate);
  if (params.endDate) search.set("endDate", params.endDate);
  if (params.startYear) search.set("startYear", params.startYear);
  if (params.endYear) search.set("endYear", params.endYear);
  if (params.reviewType && params.reviewType !== "ALL") search.set("reviewType", params.reviewType);
  if (params.status && params.status !== "ALL") search.set("status", params.status);
  if (params.q) search.set("q", params.q);

  const response = await api.get(`/reports/annual-summary?${search.toString()}`);
  return response.data as AnnualReportSummaryResponse;
}

export async function fetchAnnualReportSubmissions(params: {
  periodMode?: "ACADEMIC" | "CUSTOM" | "CALENDAR";
  ay: string;
  term: "ALL" | 1 | 2 | 3;
  startDate?: string;
  endDate?: string;
  startYear?: string;
  endYear?: string;
  committee: string;
  college: string;
  panel: string;
  category: "ALL" | "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING";
  reviewType?: "ALL" | "EXEMPT" | "EXPEDITED" | "FULL_BOARD" | "UNCLASSIFIED" | "WITHDRAWN";
  status?: "ALL" | string;
  q?: string;
  page: number;
  pageSize: number;
  sort: string;
}) {
  const search = new URLSearchParams({
    periodMode: params.periodMode ?? "ACADEMIC",
    ay: params.ay,
    term: String(params.term),
    committee: params.committee,
    college: params.college,
    panel: params.panel,
    category: params.category,
    page: String(params.page),
    pageSize: String(params.pageSize),
    sort: params.sort,
  });
  if (params.startDate) search.set("startDate", params.startDate);
  if (params.endDate) search.set("endDate", params.endDate);
  if (params.startYear) search.set("startYear", params.startYear);
  if (params.endYear) search.set("endYear", params.endYear);
  if (params.reviewType && params.reviewType !== "ALL") search.set("reviewType", params.reviewType);
  if (params.status && params.status !== "ALL") search.set("status", params.status);
  if (params.q) search.set("q", params.q);

  const response = await api.get(`/reports/submissions?${search.toString()}`);
  return response.data as AnnualReportSubmissionsResponse;
}

export default api;
