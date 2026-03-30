import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchArchivedProjects,
  fetchColleges,
  restoreProjectRecord,
  type ArchivedProject,
} from "@/services/api";
import { Breadcrumbs } from "@/components";
import { BRAND } from "@/config/branding";
import { useAuth } from "@/contexts/AuthContext";
import "../styles/archives.css";

/**
 * Archives Page
 * 
 * Displays explicitly archived projects.
 * 
 * WHY CSV IMPORTS DON'T APPEAR IN THE DASHBOARD:
 * The main dashboard queues only show submissions with active workflow statuses:
 *   - Classification queue: RECEIVED, UNDER_CLASSIFICATION
 *   - Review queue: UNDER_REVIEW  
 *   - Revisions queue: AWAITING_REVISIONS
 * 
 * A protocol appears here only when the project itself has been archived at
 * the project level as completed or withdrawn.
 */

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

export default function ArchivesPage() {
  type ArchivePreset = "ALL" | "WITHDRAWN" | "CLOSED_EXEMPT" | "CLOSED_EXPEDITED" | "CLOSED_FULL_BOARD";
  type ArchiveSort = "lastModifiedDesc" | "lastModifiedAsc" | "submittedDesc" | "submittedAsc";

  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<ArchivedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [reviewTypeFilter, setReviewTypeFilter] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [preset, setPreset] = useState<ArchivePreset>("ALL");
  const [sort, setSort] = useState<ArchiveSort>("lastModifiedDesc");
  const [collegeOptions, setCollegeOptions] = useState<string[]>([]);
  const [restoreTarget, setRestoreTarget] = useState<ArchivedProject | null>(null);
  const [restoreReason, setRestoreReason] = useState("");
  const [restoreSubmitting, setRestoreSubmitting] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const limit = 50;
  const canManageArchive = Boolean(
    user?.roles.some((role) => role === "CHAIR" || role === "ADMIN")
  );

  // Load distinct college values once
  useEffect(() => {
    fetchColleges(BRAND.defaultCommitteeCode)
      .then(setCollegeOptions)
      .catch(() => {});
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to first page when filters change
  useEffect(() => {
    setOffset(0);
  }, [statusFilter, reviewTypeFilter, collegeFilter, sort]);

  const applyPreset = (nextPreset: ArchivePreset) => {
    setPreset(nextPreset);
    if (nextPreset === "ALL") {
      setStatusFilter("");
      setReviewTypeFilter("");
      return;
    }
    if (nextPreset === "WITHDRAWN") {
      setStatusFilter("WITHDRAWN");
      setReviewTypeFilter("");
      return;
    }
    setStatusFilter("CLOSED");
    if (nextPreset === "CLOSED_EXEMPT") setReviewTypeFilter("EXEMPT");
    if (nextPreset === "CLOSED_EXPEDITED") setReviewTypeFilter("EXPEDITED");
    if (nextPreset === "CLOSED_FULL_BOARD") setReviewTypeFilter("FULL_BOARD");
  };

  const sortParams = (() => {
    if (sort === "submittedAsc") return { sortBy: "submitted" as const, sortDir: "asc" as const };
    if (sort === "submittedDesc") return { sortBy: "submitted" as const, sortDir: "desc" as const };
    if (sort === "lastModifiedAsc")
      return { sortBy: "lastModified" as const, sortDir: "asc" as const };
    return { sortBy: "lastModified" as const, sortDir: "desc" as const };
  })();

  const loadArchives = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchArchivedProjects({
        committeeCode: BRAND.defaultCommitteeCode,
        limit,
        offset,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        reviewType: reviewTypeFilter || undefined,
        college: collegeFilter || undefined,
        sortBy: sortParams.sortBy,
        sortDir: sortParams.sortDir,
      });
      setItems(response.items);
      setTotal(response.total);
    } catch (err: any) {
      console.error("Failed to load archives:", err);
      setError(err?.message || "Failed to load archived projects");
    } finally {
      setLoading(false);
    }
  }, [offset, debouncedSearch, statusFilter, reviewTypeFilter, collegeFilter, sortParams.sortBy, sortParams.sortDir]);

  useEffect(() => {
    loadArchives();
  }, [loadArchives]);

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

  const openRestoreDialog = (item: ArchivedProject) => {
    setRestoreTarget(item);
    setRestoreReason("");
    setRestoreError(null);
  };

  const closeRestoreDialog = () => {
    if (restoreSubmitting) return;
    setRestoreTarget(null);
    setRestoreReason("");
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
      await restoreProjectRecord(restoreTarget.projectId, { reason: trimmedReason });
      closeRestoreDialog();
      await loadArchives();
    } catch (err: any) {
      setRestoreError(
        err?.response?.data?.message || err?.message || "Failed to restore archived protocol."
      );
    } finally {
      setRestoreSubmitting(false);
    }
  };

  return (
    <div className="archives-page detail-v2">
      <header className="detail-hero archives-hero">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Archives" },
          ]}
        />
        <div className="detail-hero-content">
          <div className="detail-hero-text">
            <span className="detail-project-code">ARCHIVES</span>
            <h1 className="detail-title">Archived Protocols</h1>
            <span className="detail-subtitle">
              Protocols explicitly archived as completed or withdrawn.
            </span>
          </div>
          <span className="badge badge-lg badge-neutral">{total} total</span>
        </div>
      </header>

      <section className="card detail-card archives-toolbar-card">
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
                Showing {items.length} of {total} archived protocols
              </span>
            )}
          </div>
        </div>

        <div className="archives-filter-row">
          <div className="archives-subtabs" role="tablist" aria-label="Archive status presets">
            {[
              { key: "ALL", label: "All" },
              { key: "WITHDRAWN", label: "Withdrawn" },
              { key: "CLOSED_EXEMPT", label: "Closed • Exempted" },
              { key: "CLOSED_EXPEDITED", label: "Closed • Expedited" },
              { key: "CLOSED_FULL_BOARD", label: "Closed • Full Board" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`archives-subtab ${preset === tab.key ? "active" : ""}`}
                onClick={() => applyPreset(tab.key as ArchivePreset)}
              >
                {tab.label}
              </button>
            ))}
          </div>

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
            <select value={sort} onChange={(e) => setSort(e.target.value as ArchiveSort)}>
              <option value="lastModifiedDesc">Date Last Modified (Newest)</option>
              <option value="lastModifiedAsc">Date Last Modified (Oldest)</option>
              <option value="submittedDesc">Date Submitted (Newest)</option>
              <option value="submittedAsc">Date Submitted (Oldest)</option>
            </select>
          </label>

          {(preset !== "ALL" || collegeFilter || sort !== "lastModifiedDesc") && (
            <button
              type="button"
              className="archives-clear-btn"
              onClick={() => {
                setPreset("ALL");
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
          <button onClick={loadArchives}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="archives-loading card detail-card">
          <div className="loading-spinner" />
          <p>Loading archives...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="archives-empty card detail-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 8v13H3V8"/>
            <path d="M1 3h22v5H1z"/>
            <path d="M10 12h4"/>
          </svg>
          <h3>No archived protocols found</h3>
          <p>
            {debouncedSearch
              ? "Try adjusting your search terms"
              : "Archived protocols will appear here once protocols are closed or withdrawn"}
          </p>
        </div>
      ) : (
        <>
          <section className="card detail-card">
            <div className="section-title">
              <h2>Archive List</h2>
            </div>
            <div className="archives-table-container">
            <table className="archives-table">
              <thead>
                <tr>
                  <th>Protocol Code</th>
                  <th>Title</th>
                  <th>PI</th>
                  <th>Status</th>
                  <th>Date Received</th>
                  <th>Review Type</th>
                  {canManageArchive ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.projectId} onClick={() => navigate(`/projects/${item.projectId}`)} style={{ cursor: "pointer" }}>
                    <td className="code-cell">
                      <Link to={`/projects/${item.projectId}`}>
                        {item.projectCode}
                      </Link>
                    </td>
                    <td className="title-cell" title={item.title ?? "—"}>
                      <div className="archives-title-stack">
                        <span className="archives-title-main">{item.title || "—"}</span>
                        {item.archiveDate || item.archiveReason ? (
                          <span className="archives-title-meta">
                            Archived {formatDate(item.archiveDate)}
                            {item.archiveReason ? ` • ${item.archiveReason}` : ""}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>{item.piName || "—"}</td>
                    <td className="archives-status-cell">
                      <span className={`status-badge status-${item.overallStatus?.toLowerCase()}`}>
                        {formatStatus(item.overallStatus)}
                      </span>
                    </td>
                    <td>{formatDate(item.receivedDate)}</td>
                    <td>{formatReviewType(item.reviewType)}</td>
                    {canManageArchive ? (
                      <td>
                        <div className="archives-row-actions">
                          <button
                            type="button"
                            className="view-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              openRestoreDialog(item);
                            }}
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
                <h3>Restore Archived Protocol</h3>
                <p>
                  Restoring will move this protocol out of Archives and set the project back to active.
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
              <label htmlFor="restore-reason" className="archive-dialog-label">
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
    </div>
  );
}
