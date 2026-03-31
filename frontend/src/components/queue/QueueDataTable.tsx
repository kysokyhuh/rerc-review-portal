import React from "react";
import { useNavigate } from "react-router-dom";
import type { DecoratedQueueItem } from "@/types";

const toDate = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatLabel = (value?: string | null) =>
  (value || "UNKNOWN")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getStatusTone = (value?: string | null) => {
  const normalized = (value || "UNKNOWN").toUpperCase();

  if (normalized.includes("OVERDUE") || normalized.includes("REJECT")) return "danger";
  if (
    normalized.includes("AWAITING") ||
    normalized.includes("PENDING") ||
    normalized.includes("REVISION") ||
    normalized.includes("DUE SOON")
  ) {
    return "warning";
  }
  if (normalized.includes("UNDER") || normalized.includes("EXPEDITED") || normalized.includes("FULL")) {
    return "info";
  }
  if (normalized.includes("EXEMPT") || normalized.includes("APPROVED")) return "success";
  return "neutral";
};

const getSlaMeta = (item: DecoratedQueueItem) => {
  if (item.missingFields.length > 0) {
    return "Missing required supporting details.";
  }

  const remaining = item.daysRemaining ?? item.workingDaysRemaining;
  const target = item.targetDays ?? item.targetWorkingDays;
  const unitLabel = item.slaDayMode === "CALENDAR" ? "day" : "working day";

  if (target == null || remaining == null || !item.slaDueDate) {
    return "SLA will start once the current workflow deadline is set.";
  }

  if (item.slaStatus === "OVERDUE") {
    return `${Math.abs(remaining)} ${unitLabel}${
      Math.abs(remaining) === 1 ? "" : "s"
    } overdue`;
  }

  if (remaining === 0) {
    return "Due today";
  }

  return `${remaining} ${unitLabel}${
    remaining === 1 ? "" : "s"
  } remaining`;
};

type QueueDataTableProps = {
  title: string;
  subtitle?: string;
  resultCountLabel?: string;
  items: DecoratedQueueItem[];
  emptyMessage: string;
  emptyHint?: string;
  loading: boolean;
  error: string | null;
  activeFilters?: string[];
  onClearFilters?: () => void;
  showHeader?: boolean;
  showReviewType?: boolean;
};

export const QueueDataTable: React.FC<QueueDataTableProps> = ({
  title,
  subtitle,
  resultCountLabel,
  items,
  emptyMessage,
  emptyHint,
  loading,
  error,
  activeFilters = [],
  onClearFilters,
  showHeader = true,
  showReviewType = false,
}) => {
  const navigate = useNavigate();

  const renderState = (stateTitle: string, stateBody: string, isError = false) => (
    <div className={`queue-focused-state ${isError ? "error" : ""}`} role={isError ? "alert" : undefined}>
      <div className="queue-focused-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h10" />
        </svg>
      </div>
      <h3>{stateTitle}</h3>
      <p>{stateBody}</p>
      {onClearFilters && activeFilters.length > 0 && !isError ? (
        <button className="ghost-btn" type="button" onClick={onClearFilters}>
          Clear filters
        </button>
      ) : null}
    </div>
  );

  return (
    <section className="panel queue-focused-table portal-content">
      {showHeader ? (
        <div className="panel-header queue-results-header">
          <div className="queue-results-header-copy">
            <div className="queue-results-title-row">
              <h2 className="panel-title">{title}</h2>
              {resultCountLabel ? <span className="panel-count">{resultCountLabel}</span> : null}
            </div>
            {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
          </div>
          {onClearFilters && activeFilters.length > 0 ? (
            <button className="ghost-btn queue-results-clear" type="button" onClick={onClearFilters}>
              Reset filters
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="panel-body no-padding">
        {loading ? (
          renderState("Loading queue data", "Pulling the latest submissions and SLA signals for this queue.")
        ) : error ? (
          renderState("Queue unavailable", `Failed to load queue: ${error}`, true)
        ) : items.length === 0 ? (
          renderState(emptyMessage, emptyHint ?? "Try changing filters or check another queue state.")
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table queue-results-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Principal Investigator</th>
                    <th>{showReviewType ? "Review Type" : "Status"}</th>
                    <th>Received</th>
                    <th>SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const displayStatus = showReviewType
                      ? formatLabel(item.reviewType || "UNCLASSIFIED")
                      : formatLabel(item.status);

                    return (
                      <tr
                        key={item.id}
                        className="queue-table-row"
                        onClick={() => navigate(`/submissions/${item.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigate(`/submissions/${item.id}`);
                          }
                        }}
                        tabIndex={0}
                      >
                        <td>
                          <div className="queue-project-cell">
                            <span className="queue-project-code">{item.projectCode}</span>
                            <div className="queue-project-title">{item.projectTitle}</div>
                            <div className="queue-project-meta">
                              <span>{formatLabel(item.submissionType)}</span>
                              {item.staffInChargeName ? (
                                <>
                                  <span className="queue-project-meta-sep">•</span>
                                  <span>Owner: {item.staffInChargeName}</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="queue-pi-cell">
                            <span className="queue-pi-name">{item.piName}</span>
                            <span className="queue-pi-meta">
                              {item.piAffiliation || item.piEmail || "Principal investigator record"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="queue-status-cell">
                            <span className={`queue-status-chip ${getStatusTone(displayStatus)}`}>
                              {displayStatus}
                            </span>
                            {item.missingFields.length > 0 ? (
                              <span className="queue-status-note">Missing inputs</span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <div className="queue-date-cell">
                            <span className="queue-date-value">{toDate(item.receivedDate)}</span>
                            <span className="queue-date-meta">Intake date</span>
                          </div>
                        </td>
                        <td>
                          <div className="queue-sla-cell">
                            <span className={`queue-sla-chip ${(item.slaStatus || "ON_TRACK").toLowerCase()}`}>
                              {formatLabel(item.slaStatus)}
                            </span>
                            <span className="queue-sla-meta">{getSlaMeta(item)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="queue-results-footer">
              <span>Showing {items.length} protocol{items.length === 1 ? "" : "s"} in this view.</span>
              <span>Open any row for the full submission record.</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
