import React from "react";
import { StageFilter } from "@/services/api";
import { formatTimeAgo } from "@/utils/dateUtils";

interface CommandBarProps {
  committeeCode: string;
  roleLabel?: string;
  lastUpdated: Date | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  stageFilter: StageFilter;
  stageCounts: Record<string, number>;
  onStageChange: (stage: StageFilter) => void;
  savedView: string;
  onSavedViewChange: (view: string) => void;
  hasActiveFilter: boolean;
  onClearFilters: () => void;
  onRefresh: () => void;
  onExportReport?: () => void;
}

export const CommandBar: React.FC<CommandBarProps> = ({
  committeeCode,
  roleLabel = "Research Associate",
  lastUpdated,
  searchTerm,
  onSearchChange,
  stageFilter,
  stageCounts,
  onStageChange,
  savedView,
  onSavedViewChange,
  hasActiveFilter,
  onClearFilters,
  onRefresh,
  onExportReport,
}) => {
  const isFresh =
    lastUpdated && Date.now() - lastUpdated.getTime() < 90 * 1000;
  const freshnessLabel = lastUpdated ? formatTimeAgo(lastUpdated) : "loading…";

  const chips: Array<{ key: StageFilter; label: string }> = [
    { key: "ALL", label: "All active" },
    { key: "RECEIVED", label: "Received" },
    { key: "COMPLETENESS", label: "Completeness" },
    { key: "CLASSIFICATION", label: "Classification" },
    { key: "UNDER_REVIEW", label: "Under Review" },
    { key: "REVISIONS", label: "Revisions" },
    { key: "DUE_SOON", label: "Due soon" },
    { key: "OVERDUE", label: "Overdue" },
    { key: "CLOSED", label: "Closed" },
  ];

  return (
    <div className="command-bar">
      <div className="command-row">
        <div className="command-left">
          <span className="pill role-badge">{roleLabel}</span>
          <span className="pill">Committee: {committeeCode}</span>
          <span className={`health-badge ${isFresh ? "ok" : "warn"}`}>
            <span className="pulse-dot" aria-hidden />
            {isFresh ? "Live" : "Stale"} • {freshnessLabel}
          </span>
        </div>
        <div className="command-center">
          <input
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
            placeholder="Search by code, title, or PI"
          />
        </div>
        <div className="command-right">
          <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
            Refresh
          </button>
          <select
            value={savedView}
            onChange={(e) => onSavedViewChange(e.target.value)}
            aria-label="Saved views"
          >
            <option value="queue-first">Queue-first</option>
            <option value="overdue">Overdue only</option>
            <option value="due-soon">Due soon</option>
            <option value="letters">Letter readiness</option>
          </select>
          {onExportReport && (
            <button className="btn btn-secondary btn-sm" onClick={onExportReport}>
              Export report
            </button>
          )}
        </div>
      </div>

      <div className="command-row" style={{ marginTop: 10 }}>
        <div className="stage-chips">
          {chips.map((chip) => (
            <button
              key={chip.key}
              className={`stage-chip ${stageFilter === chip.key ? "active" : ""}`}
              onClick={() => onStageChange(chip.key)}
            >
              <span>{chip.label}</span>
              <span className="chip-count">{stageCounts[chip.key] ?? 0}</span>
            </button>
          ))}
          {hasActiveFilter && (
            <button className="stage-chip clear-chip" onClick={onClearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
