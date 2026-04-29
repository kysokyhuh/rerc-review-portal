import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchRecentlyDeletedProjects,
  fetchColleges,
  restoreDeletedProjectRecord,
  type RecentlyDeletedProject,
  type RecentlyDeletedProjectsResponse,
} from "@/services/api";
import { Breadcrumbs } from "@/components";
import { BRAND } from "@/config/branding";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/utils";
import "../styles/archives.css";

const PROJECT_STATUS_OPTIONS = ["DRAFT", "ACTIVE", "INACTIVE", "WITHDRAWN", "CLOSED"] as const;

type ProjectStatus = (typeof PROJECT_STATUS_OPTIONS)[number];
type ListSort = "lastModifiedDesc" | "lastModifiedAsc" | "submittedDesc" | "submittedAsc";

const RECENTLY_DELETED_CACHE_KEY = "rerc:recently-deleted:last-default-response";
const RECENTLY_DELETED_LOAD_TIMEOUT_MS = 20_000;

type RecentlyDeletedCache = {
  savedAt: string;
  response: RecentlyDeletedProjectsResponse;
};

function readRecentlyDeletedCache(): RecentlyDeletedCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RECENTLY_DELETED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecentlyDeletedCache;
    if (!parsed?.response || !Array.isArray(parsed.response.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRecentlyDeletedCache(response: RecentlyDeletedProjectsResponse) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RECENTLY_DELETED_CACHE_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        response,
      } satisfies RecentlyDeletedCache)
    );
  } catch {
    // Cache is only a UX fallback.
  }
}

function withLoadTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      window.setTimeout(() => {
        reject(
          new Error(
            "The server is taking longer than expected. The page is ready, but the list data may still be waking up."
          )
        );
      }, RECENTLY_DELETED_LOAD_TIMEOUT_MS);
    }),
  ]);
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
};

const formatStatus = (status: string | null) => {
  if (!status) return "—";
  return status.replace(/_/g, " ");
};

const formatReviewType = (reviewType: string | null) => {
  if (!reviewType) return "—";
  switch (reviewType) {
    case "EXEMPT":
      return "Exempt";
    case "EXPEDITED":
      return "Expedited";
    case "FULL_BOARD":
      return "Full Board";
    default:
      return reviewType;
  }
};

export default function RecentlyDeletedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cachedSnapshot, setCachedSnapshot] = useState<RecentlyDeletedCache | null>(
    () => readRecentlyDeletedCache()
  );
  const [items, setItems] = useState<RecentlyDeletedProject[]>(
    () => cachedSnapshot?.response.items ?? []
  );
  const [loading, setLoading] = useState(!cachedSnapshot);
  const [isRefreshing, setIsRefreshing] = useState(Boolean(cachedSnapshot));
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [total, setTotal] = useState(cachedSnapshot?.response.total ?? 0);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [reviewTypeFilter, setReviewTypeFilter] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [sort, setSort] = useState<ListSort>("lastModifiedDesc");
  const [collegeOptions, setCollegeOptions] = useState<string[]>([]);
  const [restoreTarget, setRestoreTarget] = useState<RecentlyDeletedProject | null>(null);
  const [restoreReason, setRestoreReason] = useState("");
  const [restoreStatus, setRestoreStatus] = useState<ProjectStatus>("ACTIVE");
  const [restoreSubmitting, setRestoreSubmitting] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);
  const limit = 50;
  const canManageDeleted = Boolean(
    user?.roles.some((role) => role === "CHAIR" || role === "ADMIN")
  );

  useEffect(() => {
    fetchColleges(BRAND.defaultCommitteeCode)
      .then(setCollegeOptions)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setOffset(0);
  }, [statusFilter, reviewTypeFilter, collegeFilter, sort]);

  const sortParams = (() => {
    if (sort === "submittedAsc") return { sortBy: "submitted" as const, sortDir: "asc" as const };
    if (sort === "submittedDesc") return { sortBy: "submitted" as const, sortDir: "desc" as const };
    if (sort === "lastModifiedAsc") {
      return { sortBy: "lastModified" as const, sortDir: "asc" as const };
    }
    return { sortBy: "lastModified" as const, sortDir: "desc" as const };
  })();

  const loadDeleted = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    const hasVisibleRows = items.length > 0;
    const isDefaultListView =
      offset === 0 &&
      !debouncedSearch &&
      !statusFilter &&
      !reviewTypeFilter &&
      !collegeFilter &&
      sort === "lastModifiedDesc";

    try {
      setLoading(!hasVisibleRows);
      setIsRefreshing(hasVisibleRows);
      setError(null);
      const response = await withLoadTimeout(
        fetchRecentlyDeletedProjects({
          committeeCode: BRAND.defaultCommitteeCode,
          limit,
          offset,
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          reviewType: reviewTypeFilter || undefined,
          college: collegeFilter || undefined,
          sortBy: sortParams.sortBy,
          sortDir: sortParams.sortDir,
        })
      );
      if (requestId !== loadRequestIdRef.current) return;
      setItems(response.items);
      setTotal(response.total);
      if (isDefaultListView) {
        writeRecentlyDeletedCache(response);
        setCachedSnapshot({
          savedAt: new Date().toISOString(),
          response,
        });
      }
    } catch (err: unknown) {
      if (requestId !== loadRequestIdRef.current) return;
      console.error("Failed to load recently deleted protocols:", err);
      setError(getErrorMessage(err, "Failed to load recently deleted protocols"));
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [items.length, offset, debouncedSearch, statusFilter, reviewTypeFilter, collegeFilter, sort, sortParams.sortBy, sortParams.sortDir]);

  useEffect(() => {
    loadDeleted();
  }, [loadDeleted]);

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(offset + limit);
    }
  };

  const handlePrevPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  const openRestoreDialog = (item: RecentlyDeletedProject) => {
    setRestoreTarget(item);
    setRestoreReason("");
    setRestoreStatus("ACTIVE");
    setRestoreError(null);
  };

  const closeRestoreDialog = () => {
    if (restoreSubmitting) return;
    setRestoreTarget(null);
    setRestoreReason("");
    setRestoreStatus("ACTIVE");
    setRestoreError(null);
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    const trimmedReason = restoreReason.trim();
    if (!trimmedReason) {
      setRestoreError("Reason is required.");
      return;
    }

    try {
      setRestoreSubmitting(true);
      setRestoreError(null);
      await restoreDeletedProjectRecord(restoreTarget.projectId, {
        reason: trimmedReason,
        targetStatus: restoreStatus,
      });
      closeRestoreDialog();
      await loadDeleted();
    } catch (err: unknown) {
      setRestoreError(getErrorMessage(err, "Failed to restore deleted protocol."));
    } finally {
      setRestoreSubmitting(false);
    }
  };

  return (
    <div className="archives-page detail-v2 portal-page portal-page--dense">
      <header className="detail-hero archives-hero portal-context">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Recently Deleted" },
          ]}
        />
        <div className="detail-hero-content">
          <div className="detail-hero-text">
            <span className="detail-project-code">RECENTLY DELETED</span>
            <h1 className="detail-title">Recently Deleted Protocols</h1>
            <span className="detail-subtitle">
              Deleted protocols are kept for 30 days and can be restored during that window.
            </span>
          </div>
          <span className="badge badge-lg badge-neutral">
            {loading && total === 0 ? "Loading..." : `${total} total`}
          </span>
        </div>
      </header>

      <section className="card detail-card archives-toolbar-card portal-controls">
        <div className="section-title">
          <h2>Search & Filters</h2>
        </div>
        <div className="archives-toolbar">
          <div className="archives-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search by code, title, or PI name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="archives-stats">
            {!loading && (
              <span>
                Showing {items.length} of {total} deleted protocols
                {isRefreshing ? " - refreshing" : ""}
                {cachedSnapshot && error ? " - showing last saved list" : ""}
              </span>
            )}
          </div>
        </div>

        <div className="archives-filter-row">
          <label className="archives-filter-field">
            <span className="archives-filter-label">Deleted from status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {PROJECT_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{formatStatus(status)}</option>
              ))}
            </select>
          </label>

          <label className="archives-filter-field">
            <span className="archives-filter-label">Review type</span>
            <select value={reviewTypeFilter} onChange={(e) => setReviewTypeFilter(e.target.value)}>
              <option value="">All review types</option>
              <option value="EXEMPT">Exempt</option>
              <option value="EXPEDITED">Expedited</option>
              <option value="FULL_BOARD">Full Board</option>
            </select>
          </label>

          <label className="archives-filter-field">
            <span className="archives-filter-label">College</span>
            <select value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)}>
              <option value="">All colleges</option>
              {collegeOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="archives-filter-field">
            <span className="archives-filter-label">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as ListSort)}>
              <option value="lastModifiedDesc">Date Deleted (Newest)</option>
              <option value="lastModifiedAsc">Date Deleted (Oldest)</option>
              <option value="submittedDesc">Date Submitted (Newest)</option>
              <option value="submittedAsc">Date Submitted (Oldest)</option>
            </select>
          </label>

          {(statusFilter || reviewTypeFilter || collegeFilter || sort !== "lastModifiedDesc") && (
            <button
              type="button"
              className="archives-clear-btn"
              onClick={() => {
                setStatusFilter("");
                setReviewTypeFilter("");
                setCollegeFilter("");
                setSort("lastModifiedDesc");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="archives-error card detail-card">
          <p>{error}</p>
          <div className="archives-error-actions">
            <button type="button" onClick={loadDeleted}>Retry loading</button>
            <a href={`${window.location.origin}/live`} target="_blank" rel="noreferrer">
              Wake server
            </a>
            <a href={`${window.location.origin}/ready`} target="_blank" rel="noreferrer">
              Check database
            </a>
          </div>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="archives-loading card detail-card">
          <div className="loading-spinner" />
          <p>Loading recently deleted protocols...</p>
          <span className="archives-loading-note">
            The page is loaded. Waiting for the protected database list.
          </span>
        </div>
      ) : items.length === 0 ? (
        <div className="archives-empty card detail-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18"/>
            <path d="M8 6V4h8v2"/>
            <path d="M6 6l1 14h10l1-14"/>
          </svg>
          <h3>No recently deleted protocols found</h3>
          <p>
            {debouncedSearch
              ? "Try adjusting your search terms"
              : "Deleted protocols will appear here for 30 days before they expire"}
          </p>
        </div>
      ) : (
        <>
          <section className="card detail-card portal-content">
            <div className="section-title">
              <h2>Recently Deleted List</h2>
            </div>
            <div className="archives-table-container">
              <table className="archives-table">
                <thead>
                  <tr>
                    <th>Protocol Code</th>
                    <th>Title</th>
                    <th>PI</th>
                    <th>Deleted From</th>
                    <th>Date Received</th>
                    <th>Review Type</th>
                    {canManageDeleted ? <th>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.projectId}>
                      <td className="code-cell">{item.projectCode}</td>
                      <td className="title-cell" title={item.title ?? "—"}>
                        <div className="archives-title-stack">
                          <span className="archives-title-main">{item.title || "—"}</span>
                          <span className="archives-title-meta">
                            Deleted {formatDate(item.deletedAt)}
                            {item.deletePurgeAt ? ` • Expires ${formatDate(item.deletePurgeAt)}` : ""}
                            {item.deletedReason ? ` • ${item.deletedReason}` : ""}
                          </span>
                        </div>
                      </td>
                      <td>{item.piName || "—"}</td>
                      <td className="archives-status-cell">
                        <span className="status-badge status-neutral">
                          {formatStatus(item.deletedFromStatus)}
                        </span>
                      </td>
                      <td>{formatDate(item.receivedDate)}</td>
                      <td>{formatReviewType(item.reviewType)}</td>
                      {canManageDeleted ? (
                        <td>
                          <div className="archives-row-actions">
                            <button
                              type="button"
                              className="view-btn"
                              onClick={() => openRestoreDialog(item)}
                            >
                              Restore
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {totalPages > 1 && (
            <div className="archives-pagination card detail-card">
              <button
                className="pagination-btn"
                onClick={handlePrevPage}
                disabled={offset === 0}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="pagination-btn"
                onClick={handleNextPage}
                disabled={offset + limit >= total}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {restoreTarget ? (
        <div
          className="archive-dialog-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={closeRestoreDialog}
        >
          <div className="archive-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="archive-dialog-header">
              <div>
                <h3>Restore Deleted Protocol</h3>
                <p>
                  Restoring removes this protocol from Recently Deleted and returns it to the selected status.
                </p>
              </div>
              <button
                type="button"
                className="archive-dialog-close"
                onClick={closeRestoreDialog}
                aria-label="Close restore dialog"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>
            <div className="archive-dialog-body">
              <label htmlFor="restore-status" className="archive-dialog-label">
                Target status
              </label>
              <select
                id="restore-status"
                className="archive-filter-select"
                value={restoreStatus}
                onChange={(event) => setRestoreStatus(event.target.value as ProjectStatus)}
                disabled={restoreSubmitting}
              >
                {PROJECT_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>

              <label htmlFor="restore-reason" className="archive-dialog-label" style={{ marginTop: "1rem" }}>
                Reason
              </label>
              <textarea
                id="restore-reason"
                className="archive-dialog-textarea"
                value={restoreReason}
                onChange={(event) => setRestoreReason(event.target.value)}
                placeholder="Explain why this protocol should be restored."
                disabled={restoreSubmitting}
              />
              {restoreError ? (
                <p className="archive-dialog-error" role="alert">
                  {restoreError}
                </p>
              ) : null}
            </div>
            <div className="archive-dialog-footer">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closeRestoreDialog}
                disabled={restoreSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleRestore}
                disabled={restoreSubmitting}
              >
                {restoreSubmitting ? "Restoring..." : "Confirm Restore"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="archives-pagination card detail-card" style={{ marginTop: "1rem" }}>
        <button className="pagination-btn" onClick={() => navigate("/archives")}>
          View Archives
        </button>
        <button className="pagination-btn" onClick={() => navigate("/dashboard")}>Back to Dashboard</button>
      </div>
    </div>
  );
}
