import React, { type RefObject } from "react";
import {
  DashboardFilters,
  type DashboardFilterValues,
  filtersToParams,
} from "@/components/DashboardFilters";
import {
  OWNER_BADGE_META,
  formatStatusLabel,
  isOverdue,
  isDueSoon,
  isBlocked,
  isPaused,
  blockReasonFor,
  slaChipText,
  renderOverdueOwnerBadge,
} from "./utils";

type QueueFilter =
  | "all"
  | "classification"
  | "review"
  | "revision"
  | "due-soon"
  | "overdue"
  | "blocked"
  | "unassigned";

type OverdueOwnerFilter =
  | "all"
  | "PROJECT_LEADER_RESEARCHER_PROPONENT"
  | "REVIEWER_GROUP"
  | "RESEARCH_ASSOCIATE_PROCESSING_STAFF"
  | "COMMITTEE_CHAIRPERSON_DESIGNATE"
  | "UNASSIGNED_PROCESS_GAP";

interface SubmissionsTableProps {
  loading: boolean;
  filteredItems: any[];
  allItems: any[];
  classificationQueue: any[];
  reviewQueue: any[];
  revisionQueue: any[];
  overdueSubmissions: any[];
  dueSoonSubmissions: any[];
  dueSoonThreshold: number;

  // Filters
  queueFilter: QueueFilter;
  onQueueFilterChange: (f: QueueFilter) => void;
  searchTerm: string;
  onSearchTermChange: (t: string) => void;
  hasActiveFilters: boolean;
  activeFilters: Array<{ id: string; label: string; onClear: () => void }>;
  overdueOwnerFilter: OverdueOwnerFilter;
  onOverdueOwnerFilterChange: (f: OverdueOwnerFilter) => void;
  onDashboardFilterChange: (values: DashboardFilterValues) => void;

  // Selection
  selectedIds: Set<number>;
  allVisibleSelected: boolean;
  selectedCount: number;
  onToggleSelectAll: () => void;
  onToggleSelection: (id: number) => void;
  onClearSelection: () => void;

  // Pagination
  currentPage: number;
  totalPages: number;
  safePage: number;
  startIdx: number;
  endIdx: number;
  totalFiltered: number;
  onPageChange: (page: number) => void;

  // Actions
  onQuickView: (item: any) => void;
  onNavigate: (path: string) => void;
  onExportFiltered: () => void;
  onExportSelected: () => void;
  onBulkAssign: () => void;
  onBulkReminder: () => void;
  onBulkStatusChange: () => void;

  tableRef: RefObject<HTMLDivElement>;
}

const SKELETON_ROWS = Array.from({ length: 6 }, (_, i) => i);

export function SubmissionsTable({
  loading,
  filteredItems,
  allItems,
  classificationQueue,
  reviewQueue,
  revisionQueue,
  overdueSubmissions,
  dueSoonSubmissions,
  dueSoonThreshold,
  queueFilter,
  onQueueFilterChange,
  searchTerm,
  onSearchTermChange,
  hasActiveFilters,
  activeFilters,
  overdueOwnerFilter,
  onOverdueOwnerFilterChange,
  onDashboardFilterChange,
  selectedIds,
  allVisibleSelected,
  selectedCount,
  onToggleSelectAll,
  onToggleSelection,
  onClearSelection,
  currentPage,
  totalPages,
  safePage,
  startIdx,
  endIdx,
  totalFiltered,
  onPageChange,
  onQuickView,
  onNavigate,
  onExportFiltered,
  onExportSelected,
  onBulkAssign,
  onBulkReminder,
  onBulkStatusChange,
  tableRef,
}: SubmissionsTableProps) {
  return (
    <>
      <div className="content-grid rail-collapsed">
        <div className="panel" ref={tableRef}>
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Queue workspace</h3>
            </div>
            <div className="panel-actions">
              <span className="panel-count">{filteredItems.length} submissions</span>
              <button
                className="topbar-btn"
                title="Export"
                style={{ width: 36, height: 36 }}
                onClick={onExportFiltered}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              </button>
            </div>
          </div>

          <DashboardFilters onChange={onDashboardFilterChange} />

          {/* Filter tabs */}
          <div className="filter-bar">
            <div className="filter-row">
              <div className="filter-group">
                <span className="filter-label">Queues</span>
                <div className="filter-tabs">
                  {[
                    { key: "all", label: "All", count: allItems.length },
                    { key: "due-soon", label: "Due ≤3 days", count: dueSoonSubmissions.length },
                    { key: "overdue", label: "Overdue", count: overdueSubmissions.length },
                    { key: "blocked", label: "Blocked", count: allItems.filter(isBlocked).length },
                    { key: "classification", label: "Awaiting classification", count: classificationQueue.length },
                    { key: "review", label: "Under review", count: reviewQueue.length },
                    { key: "revision", label: "Revisions", count: revisionQueue.length },
                    { key: "unassigned", label: "Unassigned", count: allItems.filter((i: any) => !i.staffInChargeName).length },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      className={`filter-tab ${queueFilter === tab.key ? "active" : ""} ${
                        tab.key === "overdue" ? "tab-danger" : tab.key === "due-soon" ? "tab-warning" : tab.key === "blocked" ? "tab-info" : ""
                      }`}
                      onClick={() => onQueueFilterChange(tab.key as QueueFilter)}
                    >
                      {tab.label}
                      <span className="filter-tab-count">{tab.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="filter-row filter-row-reset">
                <button className="ghost-btn" type="button" onClick={() => { onQueueFilterChange("all"); onSearchTermChange(""); }}>
                  Reset filters
                </button>
              </div>
            )}

            {activeFilters.length > 0 && (
              <div className="active-filters">
                {activeFilters.map((chip) => (
                  <button key={chip.id} type="button" className="filter-chip" onClick={chip.onClear}>
                    {chip.label}
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            )}

            {(queueFilter === "overdue" || queueFilter === "due-soon") && (
              <div className="overdue-owner-filters" role="group" aria-label="Filter by responsible role">
                <span className="owner-filter-label">Responsible role</span>
                <button
                  type="button"
                  className={`owner-filter-chip ${overdueOwnerFilter === "all" ? "active" : ""}`}
                  onClick={() => onOverdueOwnerFilterChange("all")}
                >
                  All
                </button>
                {(
                  [
                    "PROJECT_LEADER_RESEARCHER_PROPONENT",
                    "REVIEWER_GROUP",
                    "RESEARCH_ASSOCIATE_PROCESSING_STAFF",
                    "COMMITTEE_CHAIRPERSON_DESIGNATE",
                    "UNASSIGNED_PROCESS_GAP",
                  ] as const
                ).map((roleKey) => {
                  const meta = OWNER_BADGE_META[roleKey];
                  return (
                    <button
                      key={roleKey}
                      type="button"
                      className={`owner-filter-chip role-${meta.cssClass} ${overdueOwnerFilter === roleKey ? "active" : ""}`}
                      onClick={() => onOverdueOwnerFilterChange(roleKey)}
                      title={meta.reason}
                    >
                      <span aria-hidden="true">{meta.icon}</span>
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Table body */}
          <div className="panel-body no-padding">
            {loading && filteredItems.length === 0 ? (
              <table className="data-table table-skeleton">
                <thead>
                  <tr>
                    <th className="table-select" scope="col"><span className="skeleton-box"></span></th>
                    <th scope="col">Submission</th>
                    <th scope="col">Stage / SLA</th>
                    <th scope="col" className="table-actions-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {SKELETON_ROWS.map((row) => (
                    <tr key={row} className="skeleton-row">
                      <td><span className="skeleton-box"></span></td>
                      <td>
                        <div className="skeleton-line wide"></div>
                        <div className="skeleton-line"></div>
                        <div className="skeleton-line small"></div>
                      </td>
                      <td>
                        <div className="skeleton-pill"></div>
                        <div className="skeleton-pill"></div>
                      </td>
                      <td className="table-actions"><div className="skeleton-actions"></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : filteredItems.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3>No submissions match this view</h3>
                <p>Clear filters or switch to “All” to see more.</p>
                <button className="ghost-btn" type="button" onClick={() => { onQueueFilterChange("all"); onSearchTermChange(""); }}>
                  Reset filters
                </button>
              </div>
            ) : (
              <table className={`data-table ${loading ? "is-loading" : ""}`}>
                <thead>
                  <tr>
                    <th className="table-select" scope="col">
                      <input type="checkbox" aria-label="Select all visible submissions" checked={allVisibleSelected} onChange={onToggleSelectAll} />
                    </th>
                    <th scope="col">Submission</th>
                    <th scope="col">Stage / SLA</th>
                    <th scope="col" className="table-actions-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const itemStatus = item.status ?? "UNKNOWN";

                    return (
                      <tr
                        key={item.id}
                        className={selectedIds.has(item.id) ? "is-selected" : ""}
                        onClick={() => onNavigate(`/submissions/${item.id}`)}
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select ${item.projectCode}`}
                            checked={selectedIds.has(item.id)}
                            onChange={(e) => { e.stopPropagation(); onToggleSelection(item.id); }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td>
                          <div className="table-title">
                            {item.projectCode}
                            {isBlocked(item) && (
                              <span className="blocked-indicator" title={blockReasonFor(item)} aria-label="Blocked">⚠</span>
                            )}
                          </div>
                          <div className="table-subtitle" title={item.projectTitle}>{item.projectTitle}</div>
                          <div className="table-meta">{item.piName}</div>
                        </td>
                        <td>
                          <span className={`status-badge ${
                            itemStatus.includes("REVISION") ? "pending" :
                            itemStatus.includes("REVIEW") ? "on-track" : "pending"
                          }`}>
                            <span className="status-dot"></span>
                            {formatStatusLabel(itemStatus)}
                          </span>
                          <span className={`status-badge sla-inline ${
                            isPaused(item) ? "pending" :
                            isOverdue(item) ? "overdue" :
                            isDueSoon(item, dueSoonThreshold) ? "due-soon" : "on-track"
                          }`}>
                            {slaChipText(item, dueSoonThreshold)}
                          </span>
                          {(isOverdue(item) || isDueSoon(item, dueSoonThreshold)) &&
                            renderOverdueOwnerBadge(item, isOverdue(item) ? "overdue" : "pending")}
                        </td>
                        <td className="table-actions">
                          <div className="row-actions">
                            <button type="button" className="row-action-btn" title="Quick view" aria-label="Quick view"
                              onClick={(e) => { e.stopPropagation(); onQuickView(item); }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                            <button type="button" className="row-action-btn" title="Open details" aria-label="Open submission details"
                              onClick={(e) => { e.stopPropagation(); onNavigate(`/submissions/${item.id}`); }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 5l7 7-7 7M3 12h18" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {totalFiltered > 0 && (
              <div className="table-pagination">
                <span className="pagination-info">Showing {startIdx + 1}–{endIdx} of {totalFiltered}</span>
                <div className="pagination-controls">
                  <button type="button" className="pagination-btn" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} aria-label="Previous page">
                    ← Previous
                  </button>
                  <span className="pagination-current">Page {safePage} of {totalPages}</span>
                  <button type="button" className="pagination-btn" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)} aria-label="Next page">
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* Bulk action bar */}
            {selectedCount > 0 && (
              <div className="bulk-action-bar" role="region" aria-label="Bulk actions">
                <div className="bulk-selection">
                  {selectedCount} selected
                  <button className="bulk-clear" type="button" onClick={onClearSelection}>Clear</button>
                </div>
                <div className="bulk-actions">
                  <button className="ghost-btn" type="button" onClick={onBulkAssign}>Assign reviewers</button>
                  <button className="ghost-btn" type="button" onClick={onBulkReminder}>Send reminders</button>
                  <button className="ghost-btn" type="button" onClick={onBulkStatusChange}>Change status</button>
                  <button className="primary-btn" type="button" onClick={onExportSelected}>Export selected</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
