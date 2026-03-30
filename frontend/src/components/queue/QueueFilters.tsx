import React from "react";

type QueueFiltersProps = {
  search: string;
  sla: "all" | "on-track" | "due-soon" | "overdue" | "blocked";
  onSearchChange: (value: string) => void;
  onSlaChange: (value: "all" | "on-track" | "due-soon" | "overdue" | "blocked") => void;
};

export const QueueFilters: React.FC<QueueFiltersProps> = ({
  search,
  sla,
  onSearchChange,
  onSlaChange,
}) => {
  return (
    <section className="queue-filters portal-toolbar" aria-label="Queue filters">
      <label className="queue-filter-field queue-filter-search">
        <span className="queue-filter-label">Search Queue</span>
        <div className="queue-filter-search-shell portal-search">
          <svg
            className="queue-filter-search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            className="queue-filter-input"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by project code, title, or principal investigator"
          />
          {search ? (
            <button
              type="button"
              className="queue-filter-search-clear"
              onClick={() => onSearchChange("")}
              aria-label="Clear queue search"
            >
              ×
            </button>
          ) : null}
        </div>
      </label>

      <label className="queue-filter-field queue-filter-select-field">
        <span className="queue-filter-label">SLA Status</span>
        <div className="portal-select-shell">
          <select
            className="queue-filter-select"
            value={sla}
            onChange={(event) =>
              onSlaChange(
                event.target.value as "all" | "on-track" | "due-soon" | "overdue" | "blocked"
              )
            }
          >
            <option value="all">All statuses</option>
            <option value="on-track">On Track</option>
            <option value="due-soon">Due Soon</option>
            <option value="overdue">Overdue</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </label>
    </section>
  );
};
