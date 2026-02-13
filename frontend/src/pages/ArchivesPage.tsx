import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchArchivedProjects, type ArchivedProject } from "@/services/api";
import { Breadcrumbs } from "@/components";
import { BRAND } from "@/config/branding";
import "../styles/archives.css";

/**
 * Archives Page
 * 
 * Displays archived projects - those with terminal submission statuses (CLOSED, WITHDRAWN).
 * 
 * WHY CSV IMPORTS DON'T APPEAR IN THE DASHBOARD:
 * The main dashboard queues only show submissions with active workflow statuses:
 *   - Classification queue: RECEIVED, UNDER_CLASSIFICATION
 *   - Review queue: UNDER_REVIEW  
 *   - Revisions queue: AWAITING_REVISIONS
 * 
 * When CSV data is imported, protocols are typically set to CLOSED (approved) or 
 * WITHDRAWN status because they represent historical data that has already been
 * processed. These terminal statuses are intentionally excluded from active queues
 * since they require no further action.
 * 
 * This Archives page provides access to all historical/completed protocols.
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
  const navigate = useNavigate();
  const [items, setItems] = useState<ArchivedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadArchives = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchArchivedProjects({
        committeeCode: BRAND.defaultCommitteeCode,
        limit,
        offset,
        search: debouncedSearch || undefined,
      });
      setItems(response.items);
      setTotal(response.total);
    } catch (err: any) {
      console.error("Failed to load archives:", err);
      setError(err?.message || "Failed to load archived projects");
    } finally {
      setLoading(false);
    }
  }, [offset, debouncedSearch]);

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
              Historical protocols with completed or withdrawn status.
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
                      {item.title || "—"}
                    </td>
                    <td>{item.piName || "—"}</td>
                    <td>
                      <span className={`status-badge status-${item.latestSubmissionStatus?.toLowerCase()}`}>
                        {formatStatus(item.latestSubmissionStatus)}
                      </span>
                    </td>
                    <td>{formatDate(item.receivedDate)}</td>
                    <td>{formatReviewType(item.reviewType)}</td>
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
    </div>
  );
}
