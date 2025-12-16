import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { DecoratedQueueItem } from "@/services/api";
import { formatDateDisplay } from "@/utils/dateUtils";
import { SLAStatusChip } from "./SLAStatusChip";
import { EmptyState } from "./EmptyState";

type SortKey =
  | "projectCode"
  | "receivedDate"
  | "slaDueDate"
  | "workingDaysElapsed"
  | "workingDaysRemaining";

interface QueueTableProps {
  title: string;
  description?: string;
  items: DecoratedQueueItem[];
  loading?: boolean;
  anchorId?: string;
  searchTerm?: string;
  preserveQuery?: string;
}

export const QueueTable: React.FC<QueueTableProps> = ({
  title,
  description,
  items,
  loading = false,
  anchorId,
  searchTerm = "",
  preserveQuery,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>("slaDueDate");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const location = useLocation();

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [items, searchTerm]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!normalizedSearch) return items;
    return items.filter((item) => {
      const haystack = `${item.projectCode} ${item.projectTitle} ${item.piName} ${item.submissionType}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [items, normalizedSearch]);

  const sortedItems = useMemo(() => {
    const arr = [...filteredItems];
    arr.sort((a, b) => {
      const factor = direction === "asc" ? 1 : -1;
      if (sortKey === "projectCode") {
        return a.projectCode.localeCompare(b.projectCode) * factor;
      }
      if (sortKey === "receivedDate") {
        return (
          (new Date(a.receivedDate).getTime() -
            new Date(b.receivedDate).getTime()) * factor
        );
      }
      if (sortKey === "slaDueDate") {
        return (
          (new Date(a.slaDueDate).getTime() -
            new Date(b.slaDueDate).getTime()) * factor
        );
      }
      if (sortKey === "workingDaysElapsed") {
        return (a.workingDaysElapsed - b.workingDaysElapsed) * factor;
      }
      if (sortKey === "workingDaysRemaining") {
        return (a.workingDaysRemaining - b.workingDaysRemaining) * factor;
      }
      return 0;
    });
    return arr;
  }, [filteredItems, direction, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const pageItems = sortedItems.slice(pageStart, pageEnd);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setDirection(direction === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setDirection("asc");
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleExpand = (id: number) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  const handleExportSelected = () => {
    const rows = items.filter((item) => selectedIds.has(item.id));
    if (rows.length === 0) return;
    const headers = [
      "submission_id",
      "project_code",
      "project_title",
      "pi_name",
      "submission_type",
      "status",
      "sla_status",
      "working_days_remaining",
      "due_date",
    ];
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        [
          row.id,
          row.projectCode,
          row.projectTitle,
          row.piName,
          row.submissionType,
          row.status,
          row.slaStatus,
          row.workingDaysRemaining,
          formatDateDisplay(row.slaDueDate),
        ]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replace(/\s+/g, "_")}_export.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRequestMissing = () => {
    const rows = items.filter((item) => selectedIds.has(item.id));
    const count = rows.length;
    if (count === 0) return;
    const withMissing = rows.filter((row) => row.missingFields.length > 0);
    const message =
      withMissing.length === 0
        ? "No missing items found for selected submissions."
        : `Trigger request for ${withMissing.length} submissions with missing fields.`;
    window.alert(message);
  };

  const tableId = anchorId ?? title.toLowerCase().replace(/\s+/g, "-");
  const preserve = preserveQuery || location.search;

  if (loading) {
    return (
      <div id={tableId} className="card queue-card">
        <div className="queue-header">
          <div>
            <h2>{title}</h2>
            {description && <p className="section-description">{description}</p>}
          </div>
          <div className="table-tools">
            <div className="table-meta">Loading data...</div>
          </div>
        </div>
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    );
  }

  return (
    <div id={tableId} className="card queue-card">
      <div className="queue-header">
        <div>
          <h2>{title}</h2>
          {description && <p className="section-description">{description}</p>}
        </div>
        <div className="table-tools">
          <div className="table-meta">
            {filteredItems.length} items • page {currentPage} / {totalPages}
          </div>
          <label className="table-meta">
            Page size
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ marginLeft: 6 }}
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bulk-bar">
          <div className="table-meta">
            {selectedIds.size} selected • bulk actions
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExportSelected}>
              Export CSV
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleRequestMissing}>
              Request missing items
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => window.alert("Bulk tag/assign (simulated)")}>
              Tag / Assign
            </button>
          </div>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <EmptyState
          title="No submissions in this view"
          description="Try clearing filters or switch to another stage."
          actions={[
            {
              label: "Show all active",
              onClick: () => (window.location.href = `${location.pathname}`),
            },
            {
              label: "Show overdue",
              onClick: () =>
                (window.location.href = `${location.pathname}?stage=OVERDUE`),
            },
            {
              label: "Go to reports",
              onClick: () =>
                (window.location.href = `${location.pathname}?view=letters`),
            },
          ]}
        />
      ) : (
        <>
          <table className="queue-table">
            <thead>
              <tr>
                <th className="selection-cell">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={
                      filteredItems.length > 0 &&
                      selectedIds.size === filteredItems.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th onClick={() => toggleSort("projectCode")}>Project code</th>
                <th>Title</th>
                <th onClick={() => toggleSort("receivedDate")}>Received</th>
                <th>Stage</th>
                <th onClick={() => toggleSort("slaDueDate")}>SLA</th>
                <th onClick={() => toggleSort("workingDaysRemaining")}>
                  Days left
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item) => {
                const linkSuffix = preserve ? preserve : "";
                const submissionLink = `/submissions/${item.id}${linkSuffix}`;
                return (
                  <React.Fragment key={item.id}>
                    <tr className="queue-row">
                      <td className="selection-cell">
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.projectCode}`}
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                        />
                      </td>
                      <td className="code">
                        <Link to={submissionLink}>{item.projectCode}</Link>
                      </td>
                      <td className="title">
                        {item.projectTitle}
                        <div className="meta">{item.piName}</div>
                      </td>
                      <td>{formatDateDisplay(item.receivedDate)}</td>
                      <td>
                        <span className="badge">
                          {item.queue} • {item.status}
                        </span>
                      </td>
                      <td>
                        <SLAStatusChip
                          status={item.slaStatus}
                          workingDaysRemaining={item.workingDaysRemaining}
                          workingDaysElapsed={item.workingDaysElapsed}
                          targetWorkingDays={item.targetWorkingDays}
                          dueDate={item.slaDueDate}
                          startedAt={item.startedAt}
                        />
                      </td>
                      <td>
                        {item.workingDaysRemaining >= 0 ? (
                          <span className="badge badge-warning">
                            {item.workingDaysRemaining} wd left
                          </span>
                        ) : (
                          <span className="badge badge-danger">
                            {Math.abs(item.workingDaysRemaining)} wd over
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <Link to={submissionLink} className="btn btn-primary btn-sm">
                            View
                          </Link>
                          {item.queue === "classification" && (
                            <Link
                              to={submissionLink}
                              className="btn btn-secondary btn-sm"
                            >
                              Classify
                            </Link>
                          )}
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => toggleExpand(item.id)}
                          >
                            {expandedIds.has(item.id) ? "Hide" : "Details"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedIds.has(item.id) && (
                      <tr>
                        <td colSpan={8}>
                          <div className="row-expand">
                            <dl>
                              <div>
                                <dt>Submission type</dt>
                                <dd>{item.submissionType}</dd>
                              </div>
                              <div>
                                <dt>PI contact</dt>
                                <dd>{item.piName}</dd>
                              </div>
                              <div>
                                <dt>Next action</dt>
                                <dd>{item.nextAction}</dd>
                              </div>
                              <div>
                                <dt>Notes</dt>
                                <dd>{item.notes}</dd>
                              </div>
                              <div>
                                <dt>Missing fields</dt>
                                <dd>
                                  {item.missingFields.length === 0
                                    ? "Ready for letter"
                                    : item.missingFields.join(", ")}
                                </dd>
                              </div>
                            </dl>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          <div className="pagination" style={{ marginTop: 10 }}>
            <button
              className="page-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </button>
            <div className="table-meta">
              Page {currentPage} of {totalPages}
            </div>
            <button
              className="page-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};
