import type { LegacyDashboardProjectsResponse } from "@/types";

type LegacyImportsPanelProps = {
  totalLegacyCount: number;
  data: LegacyDashboardProjectsResponse | null;
  loading: boolean;
  error: string | null;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onNavigate: (path: string) => void;
};

const formatDate = (value: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatLabel = (value: string | null) => {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export function LegacyImportsPanel({
  totalLegacyCount,
  data,
  loading,
  error,
  searchTerm,
  onSearchTermChange,
  onPageChange,
  onNavigate,
}: LegacyImportsPanelProps) {
  if (totalLegacyCount <= 0 && !loading) {
    return null;
  }

  const page = data?.page ?? 1;
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / data.pageSize)) : 1;
  const items = data?.items ?? [];

  return (
    <section className="panel legacy-imports-panel">
      <div className="panel-header legacy-imports-header">
        <div>
          <h3 className="panel-title">Legacy imports</h3>
          <p className="legacy-imports-copy">
            Reference-only historical records imported from CSV/XLSX. They are searchable and included in reports, but they do not enter the live workflow queues.
          </p>
        </div>
        <div className="legacy-imports-actions">
          <span className="panel-count">
            {data?.totalCount ?? totalLegacyCount} legacy record{(data?.totalCount ?? totalLegacyCount) === 1 ? "" : "s"}
          </span>
          <input
            type="search"
            className="legacy-imports-search"
            placeholder="Search legacy records"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            aria-label="Search legacy imported records"
          />
        </div>
      </div>

      {error ? <div className="legacy-imports-empty">{error}</div> : null}

      {!error && loading ? (
        <div className="legacy-imports-empty">Loading legacy imports…</div>
      ) : null}

      {!error && !loading && items.length === 0 ? (
        <div className="legacy-imports-empty">
          {searchTerm.trim()
            ? "No legacy imported records match this search."
            : "Legacy imports will appear here after a historical CSV/XLSX upload."}
        </div>
      ) : null}

      {!error && !loading && items.length > 0 ? (
        <>
          <div className="legacy-imports-table-wrap">
            <table className="legacy-imports-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>PI / Proponent</th>
                  <th>Received</th>
                  <th>Review path</th>
                  <th>Status</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.projectId}
                    className="clickable-row"
                    onClick={() => onNavigate(`/projects/${item.projectId}`)}
                  >
                    <td>
                      <div className="legacy-imports-code">{item.projectCode}</div>
                      <div className="legacy-imports-title">{item.title}</div>
                    </td>
                    <td>{item.piName}</td>
                    <td>{formatDate(item.receivedDate)}</td>
                    <td>{formatLabel(item.reviewType)}</td>
                    <td>{formatLabel(item.status)}</td>
                    <td>{item.sourceFilename ?? "Imported file"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination-row legacy-imports-pagination">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
