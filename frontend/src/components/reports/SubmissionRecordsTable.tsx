import type { AnnualReportSubmissionsResponse } from "@/types";

type SubmissionRecordsTableProps = {
  data: AnnualReportSubmissionsResponse | null;
  loading: boolean;
  sort: string;
  onSort: (sort: string) => void;
  onPageChange: (page: number) => void;
  onRowClick: (item: AnnualReportSubmissionsResponse["items"][number]) => void;
};

const formatDate = (value: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US");
};

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const SortButton = ({
  field,
  label,
  sort,
  onSort,
}: {
  field: string;
  label: string;
  sort: string;
  onSort: (sort: string) => void;
}) => {
  const [currentField, currentDir] = sort.split(":");
  const active = currentField === field;
  const next = active && currentDir === "asc" ? `${field}:desc` : `${field}:asc`;
  return (
    <button type="button" className={`sort-btn ${active ? "active" : ""}`} onClick={() => onSort(next)}>
      {label}
    </button>
  );
};

export default function SubmissionRecordsTable({
  data,
  loading,
  sort,
  onSort,
  onPageChange,
  onRowClick,
}: SubmissionRecordsTableProps) {
  if (loading) return <section className="report-loading">Loading submission records…</section>;
  if (!data || data.items.length === 0) return <section className="report-empty">No records for this filter.</section>;

  const totalPages = Math.max(1, Math.ceil(data.totalCount / data.pageSize));

  return (
    <section className="records-table-panel">
      <div className="records-meta">
        <div>
          <strong>{data.totalCount.toLocaleString("en-US")}</strong> matching submissions
        </div>
        <p>Click any row to open the submission or linked project record.</p>
      </div>
      <div className="report-table-wrap">
        <table className="report-table">
          <thead>
            <tr>
              <th><SortButton field="projectCode" label="Project code" sort={sort} onSort={onSort} /></th>
              <th><SortButton field="title" label="Title" sort={sort} onSort={onSort} /></th>
              <th className="col-proponent">Proponent</th>
              <th><SortButton field="college" label="College / Unit" sort={sort} onSort={onSort} /></th>
              <th><SortButton field="department" label="Department" sort={sort} onSort={onSort} /></th>
              <th><SortButton field="reviewType" label="Review path" sort={sort} onSort={onSort} /></th>
              <th className="col-status"><SortButton field="status" label="Status" sort={sort} onSort={onSort} /></th>
              <th><SortButton field="receivedDate" label="Received" sort={sort} onSort={onSort} /></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.submissionId} className="clickable-row" onClick={() => onRowClick(item)}>
                <td>{item.projectCode}</td>
                <td>{item.title}</td>
                <td className="col-proponent">{item.proponent}</td>
                <td>{item.college}</td>
                <td>{item.department}</td>
                <td>{formatLabel(item.reviewType)}</td>
                <td className="col-status">{formatLabel(item.status)}</td>
                <td>{formatDate(item.receivedDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination-row">
        <button type="button" className="report-btn-secondary" onClick={() => onPageChange(data.page - 1)} disabled={data.page <= 1}>
          Previous
        </button>
        <span>
          Page {data.page} of {totalPages}
        </span>
        <button
          type="button"
          className="report-btn-secondary"
          onClick={() => onPageChange(data.page + 1)}
          disabled={data.page >= totalPages}
        >
          Next
        </button>
      </div>
    </section>
  );
}
