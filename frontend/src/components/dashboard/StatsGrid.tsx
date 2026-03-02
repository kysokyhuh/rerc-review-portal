import React, { type RefObject } from "react";

interface StatsGridProps {
  counts: { forClassification: number; forReview: number; awaitingRevisions: number; completed: number } | null;
  attention: { overdue: number; dueSoon: number; blocked?: number; unassigned?: number } | null;
  onFilterChange: (filter: string) => void;
  tableRef: RefObject<HTMLDivElement | null>;
}

export function StatsGrid({ counts, attention, onFilterChange, tableRef }: StatsGridProps) {
  return (
    <div className="stats-grid">
      <div className="stat-card danger" onClick={() => { onFilterChange("overdue"); tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
        <div className="stat-header">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          {(attention?.overdue ?? 0) > 0 && (
            <span className="stat-trend up">+{attention?.overdue} this week</span>
          )}
        </div>
        <div className="stat-value">{attention?.overdue ?? 0}</div>
        <div className="stat-label">Overdue submissions</div>
      </div>

      <div className="stat-card warning" onClick={() => onFilterChange("due-soon")}>
        <div className="stat-header">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
        </div>
        <div className="stat-value">{attention?.dueSoon ?? 0}</div>
        <div className="stat-label">Due in ≤3 days</div>
      </div>

      <div className="stat-card success" onClick={() => onFilterChange("classification")}>
        <div className="stat-header">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </div>
        </div>
        <div className="stat-value">{counts?.forClassification ?? 0}</div>
        <div className="stat-label">Awaiting classification</div>
      </div>

      <div className="stat-card info" onClick={() => onFilterChange("review")}>
        <div className="stat-header">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        </div>
        <div className="stat-value">{counts?.forReview ?? 0}</div>
        <div className="stat-label">Under review</div>
      </div>
    </div>
  );
}
