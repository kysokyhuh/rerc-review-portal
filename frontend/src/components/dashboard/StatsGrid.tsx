import React, { type RefObject } from "react";

interface StatsGridProps {
  counts: { forClassification: number; forReview: number; awaitingRevisions: number; completed: number } | null;
  attention: { overdue: number; dueSoon: number; blocked?: number; unassigned?: number } | null;
  onFilterChange: (filter: string) => void;
  tableRef: RefObject<HTMLDivElement | null>;
  assignedOnly?: boolean;
}

// Smooth scroll unless the user has asked for reduced motion (CSS scroll-behavior
// does not apply to programmatic scrollIntoView, so we branch here).
function scrollToTable(tableRef: RefObject<HTMLDivElement | null>) {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  tableRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

export function StatsGrid({ counts, attention, onFilterChange, tableRef, assignedOnly = false }: StatsGridProps) {
  if (assignedOnly) {
    const totalAssigned =
      (counts?.forReview ?? 0) +
      (counts?.forClassification ?? 0) +
      (counts?.awaitingRevisions ?? 0);

    return (
      <div className="stats-grid">
        <button
          type="button"
          className="stat-card info"
          aria-label={`Show all my assigned reviews (${totalAssigned})`}
          onClick={() => { onFilterChange("all"); scrollToTable(tableRef); }}
        >
          <div className="stat-header">
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
          <div className="stat-value">{totalAssigned}</div>
          <div className="stat-label">My assigned reviews</div>
        </button>

        <button
          type="button"
          className="stat-card warning"
          aria-label={`Show reviews due in 3 days or fewer (${attention?.dueSoon ?? 0})`}
          onClick={() => onFilterChange("due-soon")}
        >
          <div className="stat-header">
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
          </div>
          <div className="stat-value">{attention?.dueSoon ?? 0}</div>
          <div className="stat-label">Due in ≤3 days</div>
        </button>

        <button
          type="button"
          className="stat-card danger"
          aria-label={`Show overdue reviews (${attention?.overdue ?? 0})`}
          onClick={() => { onFilterChange("overdue"); scrollToTable(tableRef); }}
        >
          <div className="stat-header">
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
          </div>
          <div className="stat-value">{attention?.overdue ?? 0}</div>
          <div className="stat-label">Overdue reviews</div>
        </button>
      </div>
    );
  }

  return (
    <div className="stats-grid">
      <button
        type="button"
        className="stat-card danger"
        aria-label={`Show overdue submissions (${attention?.overdue ?? 0})`}
        onClick={() => { onFilterChange("overdue"); scrollToTable(tableRef); }}
      >
        <div className="stat-header">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
        </div>
        <div className="stat-value">{attention?.overdue ?? 0}</div>
        <div className="stat-label">Overdue submissions</div>
      </button>

      <button
        type="button"
        className="stat-card warning"
        aria-label={`Show submissions due in 3 days or fewer (${attention?.dueSoon ?? 0})`}
        onClick={() => onFilterChange("due-soon")}
      >
        <div className="stat-header">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
        </div>
        <div className="stat-value">{attention?.dueSoon ?? 0}</div>
        <div className="stat-label">Due in ≤3 days</div>
      </button>

      <button
        type="button"
        className="stat-card success"
        aria-label={`Show submissions awaiting classification (${counts?.forClassification ?? 0})`}
        onClick={() => onFilterChange("classification")}
      >
        <div className="stat-header">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </div>
        </div>
        <div className="stat-value">{counts?.forClassification ?? 0}</div>
        <div className="stat-label">Intake/classification</div>
      </button>

      <button
        type="button"
        className="stat-card info"
        aria-label={`Show submissions under review (${counts?.forReview ?? 0})`}
        onClick={() => onFilterChange("review")}
      >
        <div className="stat-header">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        </div>
        <div className="stat-value">{counts?.forReview ?? 0}</div>
        <div className="stat-label">Under review</div>
      </button>
    </div>
  );
}
