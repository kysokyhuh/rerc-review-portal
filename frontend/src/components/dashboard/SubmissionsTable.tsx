import React, { type RefObject } from "react";
import {
  DashboardFilters,
  type DashboardFilterValues,
} from "@/components/DashboardFilters";
import type { DecoratedQueueItem } from "@/types";
import {
  OWNER_BADGE_META,
  formatStatusLabel,
  isOverdue,
  isDueSoon,
  isBlocked,
  isPaused,
  blockReasonFor,
  slaChipText,
  resolveOwnerRoleKey,
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
  loadError: string | null;
  onRetryLoad: () => void;
  filteredItems: DecoratedQueueItem[];
  allItems: DecoratedQueueItem[];
  classificationQueue: DecoratedQueueItem[];
  reviewQueue: DecoratedQueueItem[];
  revisionQueue: DecoratedQueueItem[];
  overdueSubmissions: DecoratedQueueItem[];
  dueSoonSubmissions: DecoratedQueueItem[];
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
  onQuickView: (item: DecoratedQueueItem) => void;
  onAssignAssistant?: (item: DecoratedQueueItem) => void;
  onAssignReviewer?: (item: DecoratedQueueItem) => void;
  onNavigate: (path: string) => void;
  onExportFiltered: () => void;
  onExportSelected: () => void;
  onBulkAssign: () => void;
  onBulkAssignAssistant: () => void;
  onBulkReminder: () => void;
  onBulkStatusChange: () => void;
  onBulkDelete: () => void;
  canAssignAssistants: boolean;
  canBulkAssignReviewers: boolean;
  canBulkSendReminders: boolean;
  canBulkChangeStatus: boolean;
  canBulkDeleteRecords: boolean;

  tableRef: RefObject<HTMLDivElement>;
  assignedOnly?: boolean;
}

const SKELETON_ROWS = Array.from({ length: 6 }, (_, i) => i);

const getWorkflowTone = (item: DecoratedQueueItem, dueSoonThreshold: number) => {
  if (isPaused(item)) return "paused";
  if (isOverdue(item)) return "overdue";
  if (isDueSoon(item, dueSoonThreshold)) return "due-soon";
  return "on-track";
};

const getStageTone = (status: string) =>
  status.includes("REVISION") || status.includes("REVIEW") ? "active" : "pending";

const getWorkflowOwner = (item: DecoratedQueueItem) => {
  const ownerRole = resolveOwnerRoleKey(item);
  const meta = OWNER_BADGE_META[ownerRole] ?? OWNER_BADGE_META.RESEARCH_ASSOCIATE_PROCESSING_STAFF;

  return {
    label: item.overdueOwnerLabel ?? meta.label,
    cssClass: meta.cssClass,
    title: item.overdueOwnerReason ?? item.overdueReason ?? meta.reason,
  };
};

export function SubmissionsTable({
  loading,
  loadError,
  onRetryLoad,
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
  searchTerm: _searchTerm,
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
  currentPage: _currentPage,
  totalPages,
  safePage,
  startIdx,
  endIdx,
  totalFiltered,
  onPageChange,
  onQuickView,
  onAssignAssistant,
  onAssignReviewer,
  onNavigate,
  onExportFiltered,
  onExportSelected,
  onBulkAssign,
  onBulkAssignAssistant,
  onBulkReminder,
  onBulkStatusChange,
  onBulkDelete,
  canAssignAssistants,
  canBulkAssignReviewers,
  canBulkSendReminders,
  canBulkChangeStatus,
  canBulkDeleteRecords,
  tableRef,
  assignedOnly = false,
}: SubmissionsTableProps) {
  const canSelectRows =
    canAssignAssistants ||
    canBulkAssignReviewers ||
    canBulkSendReminders ||
    canBulkChangeStatus ||
    canBulkDeleteRecords;
  const canDirectAssignReviewer = (item: DecoratedQueueItem) => {
    const reviewType = item.classification?.reviewType ?? item.reviewType;
    return Boolean(
      canBulkAssignReviewers &&
        onAssignReviewer &&
        reviewType &&
        reviewType !== "EXEMPT"
    );
  };
  const canDirectAssignAssistant = Boolean(canAssignAssistants && onAssignAssistant);

  return (
    <>
      <div className="content-grid rail-collapsed">
        <div className="panel" ref={tableRef}>
          <div className="panel-header">
            <div>
              <h3 className="panel-title">
                {assignedOnly ? "My assignments" : "Protocol queues"}
              </h3>
              <p className="panel-subtitle">
                {assignedOnly
                  ? "Protocols assigned to you as assistant or reviewer."
                  : "Track classification, reviewer work, and revision follow-up."}
              </p>
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

          {!assignedOnly ? <DashboardFilters onChange={onDashboardFilterChange} /> : null}

          {/* Filter tabs */}
          <div className="filter-bar">
            <div className="filter-row">
              <div className="filter-group">
                <span className="filter-label">Queues</span>
                <div className="filter-tabs">
                  {(assignedOnly
                    ? [
                        { key: "all", label: "All assigned", count: allItems.length },
                        { key: "review", label: "Needs review", count: reviewQueue.length },
                        { key: "due-soon", label: "Due soon", count: dueSoonSubmissions.length },
                        { key: "overdue", label: "Overdue", count: overdueSubmissions.length },
                      ]
                    : [
                        { key: "all", label: "All", count: allItems.length },
                        { key: "due-soon", label: "Due soon", count: dueSoonSubmissions.length },
                        { key: "overdue", label: "Overdue", count: overdueSubmissions.length },
                        { key: "blocked", label: "Needs info", count: allItems.filter(isBlocked).length },
                        { key: "classification", label: "Classification", count: classificationQueue.length },
                        { key: "review", label: "Reviewer work", count: reviewQueue.length },
                        { key: "revision", label: "Revisions", count: revisionQueue.length },
                        { key: "unassigned", label: "No assistant", count: allItems.filter((item) => !item.staffInChargeName).length },
                      ]).map((tab) => (
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

            {!assignedOnly && (queueFilter === "overdue" || queueFilter === "due-soon") && (
              <div className="overdue-owner-filters" role="group" aria-label="Filter by responsible role">
                <span className="owner-filter-label">Waiting on</span>
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
            {loadError && filteredItems.length === 0 ? (
              <div className="empty-state" role="alert">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <h3>Unable to load queue data</h3>
                <p>{loadError}</p>
                <button className="ghost-btn" type="button" onClick={onRetryLoad}>
                  Retry
                </button>
              </div>
            ) : loading && filteredItems.length === 0 ? (
              <table className="data-table table-skeleton">
                <thead>
                  <tr>
                    {canSelectRows ? (
                      <th className="table-select" scope="col"><span className="skeleton-box"></span></th>
                    ) : null}
                    <th scope="col">Submission</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="table-actions-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {SKELETON_ROWS.map((row) => (
                    <tr key={row} className="skeleton-row">
                      {canSelectRows ? <td><span className="skeleton-box"></span></td> : null}
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
                <h3>{assignedOnly ? "No assigned protocols in this view" : "No protocols in this view"}</h3>
                <p>{assignedOnly ? "Clear filters or switch to “All assigned” to see more." : "Clear filters or switch to “All” to see more."}</p>
                <button className="ghost-btn" type="button" onClick={() => { onQueueFilterChange("all"); onSearchTermChange(""); }}>
                  Reset filters
                </button>
              </div>
            ) : (
              <table className={`data-table ${loading ? "is-loading" : ""}`}>
                <thead>
                  <tr>
                    {canSelectRows ? (
                      <th className="table-select" scope="col">
                        <input type="checkbox" aria-label="Select all visible submissions" checked={allVisibleSelected} onChange={onToggleSelectAll} />
                      </th>
                    ) : null}
                    <th scope="col">Submission</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="table-actions-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const itemStatus = item.status ?? "UNKNOWN";
                    const workflowTone = getWorkflowTone(item, dueSoonThreshold);
                    const stageTone = getStageTone(itemStatus);
                    const owner = getWorkflowOwner(item);
                    const showOwner = workflowTone === "overdue" || workflowTone === "due-soon";

                    return (
                      <tr
                        key={item.id}
                        className={selectedIds.has(item.id) ? "is-selected" : ""}
                        onClick={() => onNavigate(`/submissions/${item.id}`)}
                        style={{ cursor: "pointer" }}
                      >
                        {canSelectRows ? (
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Select ${item.projectCode}`}
                              checked={selectedIds.has(item.id)}
                              onChange={(e) => { e.stopPropagation(); onToggleSelection(item.id); }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                        ) : null}
                        <td>
                          <div className="table-title">
                            {item.projectCode}
                            {isBlocked(item) && (
                              <span className="blocked-indicator" title={blockReasonFor(item)} aria-label="Needs info">⚠</span>
                            )}
                          </div>
                          <div className="table-subtitle" title={item.projectTitle}>{item.projectTitle}</div>
                          <div className="table-meta">{item.piName}</div>
                        </td>
                        <td className="workflow-cell">
                          <div className={`workflow-summary workflow-summary--${workflowTone}`}>
                            <div className="workflow-line">
                              <span className={`workflow-stage workflow-stage--${stageTone}`}>
                                {formatStatusLabel(itemStatus)}
                              </span>
                              <span className={`workflow-target workflow-target--${workflowTone}`}>
                                {slaChipText(item, dueSoonThreshold)}
                              </span>
                            </div>
                            <span className="workflow-meter" aria-hidden="true">
                              <span className={`workflow-meter-fill workflow-meter-fill--${workflowTone}`} />
                            </span>
                            {showOwner ? (
                              <div className={`workflow-owner role-${owner.cssClass}`} title={owner.title}>
                                <span>Waiting on</span>
                                <strong>{owner.label}</strong>
                              </div>
                            ) : null}
                          </div>
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
                            {canDirectAssignAssistant ? (
                              <button
                                type="button"
                                className="row-action-btn"
                                title="Assign protocol assistant"
                                aria-label={`Assign protocol assistant to ${item.projectCode}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAssignAssistant?.(item);
                                }}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="9" cy="8" r="4" />
                                  <path d="M3 21c0-3.5 2.7-6 6-6 1.2 0 2.3.3 3.2.9" />
                                  <path d="M16 12l2 2 4-4" />
                                </svg>
                              </button>
                            ) : null}
                            {canDirectAssignReviewer(item) ? (
                              <button
                                type="button"
                                className="row-action-btn"
                                title="Assign reviewer"
                                aria-label={`Assign reviewer to ${item.projectCode}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAssignReviewer?.(item);
                                }}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="9" cy="8" r="4" />
                                  <path d="M3 21c0-3.5 2.7-6 6-6 1.2 0 2.3.3 3.2.9" />
                                  <path d="M17 11v6" />
                                  <path d="M14 14h6" />
                                </svg>
                              </button>
                            ) : null}
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
            {canSelectRows && selectedCount > 0 && (
              <div className="bulk-action-bar" role="region" aria-label="Bulk actions">
                <div className="bulk-selection">
                  {selectedCount} selected
                  <button className="bulk-clear" type="button" onClick={onClearSelection}>Clear</button>
                </div>
                <div className="bulk-actions">
                  {canBulkAssignReviewers ? (
                    <button className="ghost-btn" type="button" onClick={onBulkAssign}>Assign reviewers</button>
                  ) : null}
                  {canAssignAssistants ? (
                    <button className="ghost-btn" type="button" onClick={onBulkAssignAssistant}>Assign assistant</button>
                  ) : null}
                  {canBulkSendReminders ? (
                    <button className="ghost-btn" type="button" onClick={onBulkReminder}>Send reminders</button>
                  ) : null}
                  {canBulkChangeStatus ? (
                    <button className="ghost-btn" type="button" onClick={onBulkStatusChange}>Change status</button>
                  ) : null}
                  {canBulkDeleteRecords ? (
                    <button className="ghost-btn bulk-delete-btn" type="button" onClick={onBulkDelete}>Delete selected</button>
                  ) : null}
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
