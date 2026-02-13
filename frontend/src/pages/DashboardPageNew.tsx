import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDashboardQueues } from "@/hooks/useDashboardQueues";
import { useDashboardOverdue } from "@/hooks/useDashboardOverdue";
import {
  DashboardFilters,
  type DashboardFilterValues,
  filtersToParams,
} from "@/components/DashboardFilters";
import {
  fetchSubmissionDetail,
  fetchSubmissionSlaSummary,
  searchProjects,
} from "@/services/api";
import type {
  ProjectSearchResult,
  SubmissionDetail,
  SubmissionSlaSummary,
} from "@/types";
import { DUE_SOON_THRESHOLD } from "@/constants";
import { BRAND } from "@/config/branding";
import "../styles/dashboard.css";

// Get greeting based on time of day
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

// Format relative time
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatStatusLabel(status: string | null): string {
  if (!status) return "Unknown";
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatShortDate(value?: string | Date | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const OWNER_BADGE_META: Record<
  string,
  { label: string; icon: string; cssClass: string; reason: string }
> = {
  PROJECT_LEADER_RESEARCHER_PROPONENT: {
    label: "Researcher",
    icon: "\u25CE",
    cssClass: "researcher",
    reason: "Waiting on project leader/researcher/proponent action",
  },
  REVIEWER_GROUP: {
    label: "Reviewer",
    icon: "\u2611",
    cssClass: "reviewer",
    reason: "Waiting on reviewer or consultant action",
  },
  RESEARCH_ASSOCIATE_PROCESSING_STAFF: {
    label: "Staff",
    icon: "\u25A3",
    cssClass: "staff",
    reason: "Waiting on staff processing/routing",
  },
  COMMITTEE_CHAIRPERSON_DESIGNATE: {
    label: "Chairperson",
    icon: "\u2713",
    cssClass: "chairperson",
    reason: "Waiting on chairperson decision/finalization",
  },
  UNASSIGNED_PROCESS_GAP: {
    label: "Unassigned",
    icon: "\u26A0",
    cssClass: "unassigned",
    reason: "Missing actionable assignee or routing metadata",
  },
};

type CollapsedPanels = {
  overdue: boolean;
};

const PAGE_SIZE = 15;

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [greeting] = useState(getGreeting());
  const [searchTerm, setSearchTerm] = useState("");
  const [queueFilter, setQueueFilter] = useState<
    | "all"
    | "classification"
    | "review"
    | "revision"
    | "due-soon"
    | "overdue"
    | "blocked"
    | "unassigned"
  >("all");
  // Removed separate slaFilter — merged into queueFilter
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);
  const [overdueTab, setOverdueTab] = useState<
    "submissions" | "reviewers" | "endorsements" | "due-soon"
  >("submissions");
  const [overdueOwnerFilter, setOverdueOwnerFilter] = useState<
    | "all"
    | "PROJECT_LEADER_RESEARCHER_PROPONENT"
    | "REVIEWER_GROUP"
    | "RESEARCH_ASSOCIATE_PROCESSING_STAFF"
    | "COMMITTEE_CHAIRPERSON_DESIGNATE"
    | "UNASSIGNED_PROCESS_GAP"
  >("all");
  const [searchResults, setSearchResults] = useState<ProjectSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [quickViewId, setQuickViewId] = useState<number | null>(null);
  const [quickViewSummary, setQuickViewSummary] = useState<{
    projectCode: string;
    projectTitle: string;
    piName: string;
    staffInChargeName?: string | null;
  } | null>(null);
  const [quickViewDetail, setQuickViewDetail] = useState<SubmissionDetail | null>(null);
  const [quickViewSla, setQuickViewSla] = useState<SubmissionSlaSummary | null>(null);
  const [quickViewLoading, setQuickViewLoading] = useState(false);
  const [quickViewError, setQuickViewError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const density = "comfortable" as const;
  const [collapsedPanels, setCollapsedPanels] = useState<CollapsedPanels>(() => {
    if (typeof window === "undefined") {
      return {
        overdue: false,
      };
    }
    try {
      const stored = window.localStorage.getItem("dashboardCollapsedPanels");
      return stored
        ? JSON.parse(stored)
        : {
            overdue: false,
          };
    } catch {
      return {
        overdue: false,
      };
    }
  });
  const [dashboardFilters, setDashboardFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fromLogin = Boolean((location.state as { fromLogin?: boolean } | null)?.fromLogin);

  useEffect(() => {
    document.title = "URERB Portal — Dashboard Overview";
  }, []);

  // Reset owner role filter when not on overdue/due-soon tabs
  useEffect(() => {
    if (queueFilter !== "overdue" && queueFilter !== "due-soon") {
      setOverdueOwnerFilter("all");
    }
  }, [queueFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [queueFilter, searchTerm, overdueOwnerFilter]);

  // Callback from DashboardFilters component — converts FilterValues to a plain
  // Record<string,string> suitable for passing into API hooks.
  const handleDashboardFilterChange = useCallback(
    (values: DashboardFilterValues) => {
      const params = filtersToParams(values);
      setDashboardFilters(params);
    },
    []
  );

  const {
    counts,
    classificationQueue,
    reviewQueue,
    revisionQueue,
    attention,
    allItems,
    lastUpdated,
    refresh,
    loading,
    error,
  } = useDashboardQueues(BRAND.defaultCommitteeCode, dashboardFilters);

  const {
    overdueReviews,
    overdueEndorsements,
    loading: overdueLoading,
    error: overdueError,
    refresh: refreshOverdue,
  } = useDashboardOverdue(BRAND.defaultCommitteeCode, dashboardFilters);

  const handleRefresh = () => {
    refresh();
    refreshOverdue();
  };

  const announcements = [
    {
      id: "policy-jan",
      tone: "info",
      title: "Policy reminder",
      message:
        "Contract coverage starts January 1. Submissions dated earlier will not count toward the reporting period.",
    },
  ];

  const visibleAnnouncements = announcements.filter(
    (announcement) => !dismissedAnnouncements.includes(announcement.id)
  );

  const isOverdue = (item: SubmissionDetail | any) => item.slaStatus === "OVERDUE";
  const isDueSoon = (item: SubmissionDetail | any) =>
    item.workingDaysRemaining <= DUE_SOON_THRESHOLD &&
    item.workingDaysRemaining >= 0;
  const isBlocked = (item: SubmissionDetail | any) =>
    item.missingFields && item.missingFields.length > 0;
  const isUnassigned = (item: SubmissionDetail | any) =>
    !item.staffInChargeName;
  const isPaused = useCallback(
    (item: SubmissionDetail | any) => ["WITHDRAWN", "CLOSED"].includes(item.status),
    []
  );

  const resolveOwnerRoleKey = (item: {
    overdueOwnerRole?: string;
    overdueOwner?: "PANEL" | "RESEARCHER";
  }) => {
    if (item.overdueOwnerRole) return item.overdueOwnerRole;
    if (item.overdueOwner === "RESEARCHER") {
      return "PROJECT_LEADER_RESEARCHER_PROPONENT";
    }
    if (item.overdueOwner === "PANEL") {
      return "RESEARCH_ASSOCIATE_PROCESSING_STAFF";
    }
    return "UNASSIGNED_PROCESS_GAP";
  };

  const matchesOwnerFilter = (item: {
    overdueOwnerRole?: string;
    overdueOwner?: "PANEL" | "RESEARCHER";
  }) =>
    overdueOwnerFilter === "all" ||
    resolveOwnerRoleKey(item) === overdueOwnerFilter;

  const baseItems = useMemo(() => {
    switch (queueFilter) {
      case "classification":
        return classificationQueue;
      case "review":
        return reviewQueue;
      case "revision":
        return revisionQueue;
      case "due-soon":
        return allItems.filter(isDueSoon).filter(matchesOwnerFilter);
      case "overdue":
        return allItems.filter(isOverdue).filter(matchesOwnerFilter);
      case "blocked":
        return allItems.filter(isBlocked);
      case "unassigned":
        return allItems.filter(isUnassigned);
      default:
        return allItems;
    }
  }, [
    queueFilter,
    overdueOwnerFilter,
    classificationQueue,
    reviewQueue,
    revisionQueue,
    allItems,
  ]);

  // SLA filter merged into queue filter — baseItems is now the filtered set
  const slaFilteredItems = baseItems;

  const searchedItems = useMemo(() => {
    if (!searchTerm) return slaFilteredItems;
    const search = searchTerm.toLowerCase();
    return slaFilteredItems.filter(
      (item) =>
        item.projectCode.toLowerCase().includes(search) ||
        item.projectTitle.toLowerCase().includes(search) ||
        item.piName.toLowerCase().includes(search)
    );
  }, [slaFilteredItems, searchTerm]);

  const priorityScore = (item: any) => {
    let score = 0;
    if (isOverdue(item)) score += 100;
    if (isDueSoon(item)) score += 60;
    if (isBlocked(item)) score += 40;
    if (isUnassigned(item)) score += 15;
    if (item.queue === "classification") score += 10;
    return score;
  };

  const blockReasonFor = (item: any) => {
    if (!item.missingFields || item.missingFields.length === 0) return "—";
    const preview = item.missingFields.slice(0, 2).join(", ");
    return item.missingFields.length > 2
      ? `Missing: ${preview} +${item.missingFields.length - 2}`
      : `Missing: ${preview}`;
  };

  const slaChipText = (item: any) => {
    if (isPaused(item)) return "SLA paused";
    if (!item.targetWorkingDays || !item.slaDueDate) return "SLA not set";
    if (isOverdue(item)) {
      return `Overdue ${Math.abs(item.workingDaysRemaining)} wd`;
    }
    if (isDueSoon(item)) {
      return `Due in ${item.workingDaysRemaining} wd`;
    }
    return `${item.workingDaysRemaining} wd left`;
  };

  const renderOverdueOwnerBadge = (
    item: {
      overdueOwnerRole?: string;
      overdueOwnerLabel?: string;
      overdueOwnerIcon?: string;
      overdueOwnerReason?: string;
      overdueOwner?: "PANEL" | "RESEARCHER";
      overdueReason?: string;
    },
    tone: "overdue" | "pending" = "overdue"
  ) => {
    const fallbackRole =
      item.overdueOwner === "RESEARCHER"
        ? "PROJECT_LEADER_RESEARCHER_PROPONENT"
        : item.overdueOwner
          ? "RESEARCH_ASSOCIATE_PROCESSING_STAFF"
          : undefined;
    const ownerRole = item.overdueOwnerRole ?? fallbackRole;
    if (!ownerRole) return null;

    const meta =
      OWNER_BADGE_META[ownerRole] ??
      OWNER_BADGE_META.RESEARCH_ASSOCIATE_PROCESSING_STAFF;
    const label = item.overdueOwnerLabel ?? meta.label;
    const icon = item.overdueOwnerIcon ?? meta.icon;
    const title = item.overdueOwnerReason ?? item.overdueReason ?? meta.reason;

    return (
      <span
        className={`overdue-owner-badge role-${meta.cssClass}`}
        title={title}
      >
        <span className="overdue-owner-icon" aria-hidden="true">
          {icon}
        </span>
        <span>{`${label} ${tone}`}</span>
      </span>
    );
  };

  const sortedItems = useMemo(
    () =>
      [...searchedItems].sort((a, b) => {
        const scoreDelta = priorityScore(b) - priorityScore(a);
        if (scoreDelta !== 0) return scoreDelta;
        return new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime();
      }),
    [searchedItems]
  );

  const totalFiltered = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  // Clamp page if filter change shrinks the list
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, totalFiltered);
  const filteredItems = sortedItems.slice(startIdx, endIdx);
  const visibleItemIds = useMemo(
    () => filteredItems.map((item) => item.id),
    [filteredItems]
  );
  const allVisibleSelected =
    visibleItemIds.length > 0 &&
    visibleItemIds.every((id) => selectedIds.has(id));
  const selectedCount = selectedIds.size;

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleItemIds.forEach((id) => next.delete(id));
      } else {
        visibleItemIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const hasActiveFilters = queueFilter !== "all" || Boolean(searchTerm);

  const activeFilters = useMemo(() => {
    const chips: Array<{ id: string; label: string; onClear: () => void }> = [];
    if (queueFilter !== "all") {
      const labelMap: Record<string, string> = {
        classification: "Awaiting classification",
        review: "Under review",
        revision: "Awaiting revisions",
        "due-soon": "Due ≤3 days",
        overdue: "Overdue",
        blocked: "Blocked",
        unassigned: "Unassigned",
      };
      chips.push({
        id: "queue",
        label: labelMap[queueFilter] ?? queueFilter,
        onClear: () => setQueueFilter("all"),
      });
    }
    if (searchTerm) {
      chips.push({
        id: "search",
        label: `Search: ${searchTerm}`,
        onClear: () => setSearchTerm(""),
      });
    }
    return chips;
  }, [queueFilter, searchTerm]);

  const handleExportFiltered = () => {
    if (sortedItems.length === 0) {
      window.alert("No submissions in the current view.");
      return;
    }
    const headers = [
      "submission_id",
      "project_code",
      "project_title",
      "pi_name",
      "status",
      "queue",
      "sla_status",
      "sla_due_date",
      "owner",
    ];
    const csv = [
      headers.join(","),
      ...sortedItems.map((row) =>
        [
          row.id,
          row.projectCode,
          row.projectTitle,
          row.piName,
          row.status,
          row.queue,
          row.slaStatus,
          row.slaDueDate,
          row.staffInChargeName ?? "",
        ]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `submissions_export_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBulkAssign = () => {
    if (selectedCount === 0) return;
    window.alert(`Assign reviewers for ${selectedCount} submissions (UI only).`);
  };

  const handleBulkReminder = () => {
    if (selectedCount === 0) return;
    const confirmed = window.confirm(
      `Send reminders for ${selectedCount} submissions?`
    );
    if (!confirmed) return;
    window.alert("Reminder emails queued (UI only).");
  };

  const handleBulkStatusChange = () => {
    if (selectedCount === 0) return;
    const confirmed = window.confirm(
      `Change status for ${selectedCount} submissions?`
    );
    if (!confirmed) return;
    window.alert("Status updated (UI only).");
  };

  const handleExportSelected = () => {
    if (selectedCount === 0) return;
    const selectedRows = sortedItems.filter((row) => selectedIds.has(row.id));
    if (selectedRows.length === 0) {
      window.alert("No selected submissions in this view.");
      return;
    }
    const headers = [
      "submission_id",
      "project_code",
      "project_title",
      "pi_name",
      "status",
      "queue",
      "sla_status",
      "sla_due_date",
      "owner",
    ];
    const csv = [
      headers.join(","),
      ...selectedRows.map((row) =>
        [
          row.id,
          row.projectCode,
          row.projectTitle,
          row.piName,
          row.status,
          row.queue,
          row.slaStatus,
          row.slaDueDate,
          row.staffInChargeName ?? "",
        ]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `submissions_selected_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const overdueSubmissions = useMemo(
    () => allItems.filter((item) => item.slaStatus === "OVERDUE"),
    [allItems]
  );
  const dueSoonSubmissions = useMemo(
    () =>
      allItems.filter(
        (item) =>
          item.workingDaysRemaining <= DUE_SOON_THRESHOLD &&
          item.workingDaysRemaining >= 0
      ),
    [allItems]
  );

  const filteredOverdueSubmissions = useMemo(
    () => overdueSubmissions.filter(matchesOwnerFilter),
    [overdueSubmissions, overdueOwnerFilter]
  );
  const filteredDueSoonSubmissions = useMemo(
    () => dueSoonSubmissions.filter(matchesOwnerFilter),
    [dueSoonSubmissions, overdueOwnerFilter]
  );
  const filteredOverdueReviews = useMemo(
    () => overdueReviews.filter(matchesOwnerFilter),
    [overdueReviews, overdueOwnerFilter]
  );
  const filteredOverdueEndorsements = useMemo(
    () => overdueEndorsements.filter(matchesOwnerFilter),
    [overdueEndorsements, overdueOwnerFilter]
  );

  useEffect(() => {
    const query = searchTerm.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      setSearchError(null);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const data = await searchProjects(query, BRAND.defaultCommitteeCode, 6);
        setSearchResults(data.items ?? []);
        setSearchOpen(true);
        setSearchError(null);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    if (!quickViewOpen || !quickViewId) {
      setQuickViewDetail(null);
      setQuickViewSla(null);
      setQuickViewError(null);
      return;
    }

    let cancelled = false;
    const loadQuickView = async () => {
      try {
        setQuickViewLoading(true);
        // Load detail first — always works
        const detail = await fetchSubmissionDetail(quickViewId);
        if (cancelled) return;
        setQuickViewDetail(detail);
        setQuickViewError(null);

        // SLA may 400 for unclassified submissions — that's OK
        try {
          const sla = await fetchSubmissionSlaSummary(quickViewId);
          if (!cancelled) setQuickViewSla(sla);
        } catch {
          // SLA not available — leave null silently
          if (!cancelled) setQuickViewSla(null);
        }
      } catch (err) {
        if (cancelled) return;
        setQuickViewError(
          err instanceof Error ? err.message : "Failed to load submission details"
        );
      } finally {
        if (!cancelled) {
          setQuickViewLoading(false);
        }
      }
    };

    loadQuickView();
    return () => {
      cancelled = true;
    };
  }, [quickViewOpen, quickViewId]);

  useEffect(() => {
    if (!quickViewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setQuickViewOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [quickViewOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "dashboardCollapsedPanels",
      JSON.stringify(collapsedPanels)
    );
  }, [collapsedPanels]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (event.key === "/") {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          ["INPUT", "TEXTAREA"].includes(target.tagName)
        ) {
          return;
        }
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openQuickView = (item: {
    id: number;
    projectCode: string;
    projectTitle: string;
    piName: string;
    staffInChargeName?: string | null;
  }) => {
    setQuickViewId(item.id);
    setQuickViewSummary({
      projectCode: item.projectCode,
      projectTitle: item.projectTitle,
      piName: item.piName,
      staffInChargeName: item.staffInChargeName ?? null,
    });
    setQuickViewOpen(true);
  };

  if (error) {
    return (
      <div className="dashboard-content">
        <div className="empty-state" style={{ minHeight: "50vh", display: "flex", flexDirection: "column", justifyContent: "center" }} role="alert">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <h3>Unable to load dashboard</h3>
          <p>{error}</p>
          <button 
            onClick={handleRefresh}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              background: "#0F7744",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const skeletonRows = Array.from({ length: 6 }, (_, index) => index);

  return (
    <div
      className={`dashboard-content ${fromLogin ? "dashboard-enter" : ""} ${
        loading ? "is-loading" : "is-ready"
      }`}
    >
          {/* Top Bar */}
          <div className="dashboard-topbar">
            <div className="topbar-left">
              <div className="topbar-greeting">
                <h2>{greeting}, Research Associate</h2>
                <p>
                  {lastUpdated 
                    ? `Last synced ${formatTimeAgo(lastUpdated)}`
                    : "Syncing data..."}
                </p>
              </div>
            </div>
            <div className="topbar-right">
              <div className="system-status" role="status" aria-live="polite">
                <span className="system-dot" aria-hidden="true"></span>
                System online
              </div>
              <div className="topbar-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search submissions (⌘/Ctrl + K)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  ref={searchInputRef}
                  aria-label="Search submissions"
                  onFocus={() => {
                    if (searchResults.length > 0) setSearchOpen(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setSearchOpen(false), 150);
                  }}
                />
                {searchOpen && (
                  <div className="search-dropdown">
                    {searchLoading ? (
                      <div className="search-item muted">Searching...</div>
                    ) : searchError ? (
                      <div className="search-item muted">{searchError}</div>
                    ) : searchResults.length === 0 ? (
                      <div className="search-item muted">No matches</div>
                    ) : (
                      searchResults.map((result) => (
                        <button
                          key={result.id}
                          className="search-item"
                          type="button"
                          onClick={() => navigate(`/projects/${result.id}`)}
                        >
                          <span className="search-code">{result.projectCode}</span>
                          <span className="search-title">{result.title}</span>
                          <span className="search-pi">{result.piName}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button
                className="topbar-btn"
                onClick={handleRefresh}
                title="Refresh"
                aria-label="Refresh dashboard"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
              </button>
              <button className="topbar-btn" title="Notifications" aria-label="Notifications">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
                </svg>
              </button>
              <button
                className="topbar-btn"
                title="Logout"
                aria-label="Log out"
                onClick={() => navigate("/login")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
              </button>
            </div>
          </div>

          {visibleAnnouncements.length > 0 && (
            <div className="announcement-stack">
              {visibleAnnouncements.map((announcement) => (
                <div
                  key={announcement.id}
                  className={`announcement-banner ${announcement.tone}`}
                  role="status"
                >
                  <div className="announcement-content">
                    <strong>{announcement.title}</strong>
                    <span>{announcement.message}</span>
                  </div>
                  <button
                    className="announcement-dismiss"
                    type="button"
                    onClick={() =>
                      setDismissedAnnouncements((prev) => [
                        ...prev,
                        announcement.id,
                      ])
                    }
                    aria-label="Dismiss announcement"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card danger" onClick={() => { setQueueFilter("overdue"); tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
              <div className="stat-header">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8v4M12 16h.01"/>
                  </svg>
                </div>
                {(attention?.overdue ?? 0) > 0 && (
                  <span className="stat-trend up">+{attention?.overdue} this week</span>
                )}
              </div>
              <div className="stat-value">{attention?.overdue ?? 0}</div>
              <div className="stat-label">Overdue submissions</div>
            </div>

            <div className="stat-card warning" onClick={() => setQueueFilter("due-soon")}>
              <div className="stat-header">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                </div>
              </div>
              <div className="stat-value">{attention?.dueSoon ?? 0}</div>
              <div className="stat-label">Due in ≤3 days</div>
            </div>

            <div className="stat-card success" onClick={() => setQueueFilter("classification")}>
              <div className="stat-header">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16M4 12h16M4 18h7"/>
                  </svg>
                </div>
              </div>
              <div className="stat-value">{counts?.forClassification ?? 0}</div>
              <div className="stat-label">Awaiting classification</div>
            </div>

            <div className="stat-card info" onClick={() => setQueueFilter("review")}>
              <div className="stat-header">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                  </svg>
                </div>
              </div>
              <div className="stat-value">{counts?.forReview ?? 0}</div>
              <div className="stat-label">Under review</div>
            </div>
          </div>

          <div className="content-grid-header">
            <div className="content-grid-title">
              <h3>Queue workspace</h3>
              <p>Filters, triage, and bulk actions in one place.</p>
            </div>
          </div>

          {/* Content Grid */}
          <div className="content-grid rail-collapsed">
            {/* Main Table Panel */}
            <div className="panel" ref={tableRef}>
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">Submissions Queue</h3>
                </div>
                <div className="panel-actions">
                  <span className="panel-count">{filteredItems.length} submissions</span>
                  <button 
                    className="topbar-btn" 
                    title="Export"
                    style={{ width: 36, height: 36 }}
                    onClick={handleExportFiltered}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Filter Bar */}
              <DashboardFilters onChange={handleDashboardFilterChange} />
              <div className="filter-bar">
                <div className="filter-row">
                  <div className="filter-group">
                    <span className="filter-label">Queues</span>
                    <div className="filter-tabs">
                      {[
                        { key: "all", label: "All", count: allItems.length },
                        {
                          key: "due-soon",
                          label: "Due ≤3 days",
                          count: dueSoonSubmissions.length,
                        },
                        {
                          key: "overdue",
                          label: "Overdue",
                          count: overdueSubmissions.length,
                        },
                        {
                          key: "blocked",
                          label: "Blocked",
                          count: allItems.filter(isBlocked).length,
                        },
                        {
                          key: "classification",
                          label: "Awaiting classification",
                          count: classificationQueue.length,
                        },
                        {
                          key: "review",
                          label: "Under review",
                          count: reviewQueue.length,
                        },
                        {
                          key: "revision",
                          label: "Revisions",
                          count: revisionQueue.length,
                        },
                        {
                          key: "unassigned",
                          label: "Unassigned",
                          count: allItems.filter(isUnassigned).length,
                        },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          className={`filter-tab ${
                            queueFilter === tab.key ? "active" : ""
                          } ${tab.key === "overdue" ? "tab-danger" : tab.key === "due-soon" ? "tab-warning" : tab.key === "blocked" ? "tab-info" : ""}`}
                          onClick={() =>
                            setQueueFilter(tab.key as typeof queueFilter)
                          }
                        >
                          {tab.label}
                          <span className="filter-tab-count">
                            {tab.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Reset filter — only when filters are active */}
                {hasActiveFilters && (
                  <div className="filter-row filter-row-reset">
                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={() => {
                        setQueueFilter("all");
                        setSearchTerm("");
                      }}
                    >
                      Reset filters
                    </button>
                  </div>
                )}
                {activeFilters.length > 0 && (
                  <div className="active-filters">
                    {activeFilters.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        className="filter-chip"
                        onClick={chip.onClear}
                      >
                        {chip.label}
                        <span aria-hidden="true">×</span>
                      </button>
                    ))}
                  </div>
                )}
                {(queueFilter === "overdue" || queueFilter === "due-soon") && (
                  <div
                    className="overdue-owner-filters"
                    role="group"
                    aria-label="Filter by responsible role"
                  >
                    <span className="owner-filter-label">Responsible role</span>
                    <button
                      type="button"
                      className={`owner-filter-chip ${overdueOwnerFilter === "all" ? "active" : ""}`}
                      onClick={() => setOverdueOwnerFilter("all")}
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
                          onClick={() => setOverdueOwnerFilter(roleKey)}
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

              <div className="panel-body no-padding">
                {loading && filteredItems.length === 0 ? (
                  <table className="data-table table-skeleton">
                    <thead>
                      <tr>
                        <th className="table-select" scope="col">
                          <span className="skeleton-box"></span>
                        </th>
                        <th scope="col">Submission</th>
                        <th scope="col">Stage / SLA</th>
                        <th scope="col" className="table-actions-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skeletonRows.map((row) => (
                        <tr key={row} className="skeleton-row">
                          <td>
                            <span className="skeleton-box"></span>
                          </td>
                          <td>
                            <div className="skeleton-line wide"></div>
                            <div className="skeleton-line"></div>
                            <div className="skeleton-line small"></div>
                          </td>
                          <td>
                            <div className="skeleton-pill"></div>
                            <div className="skeleton-pill"></div>
                          </td>
                          <td className="table-actions">
                            <div className="skeleton-actions"></div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : filteredItems.length === 0 ? (
                  <div className="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <h3>No submissions match this view</h3>
                    <p>Clear filters or switch to “All” to see more.</p>
                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={() => {
                        setQueueFilter("all");
                        setSearchTerm("");
                      }}
                    >
                      Reset filters
                    </button>
                  </div>
                ) : (
                  <table
                    className={`data-table ${loading ? "is-loading" : ""}`}
                  >
                    <thead>
                      <tr>
                        <th className="table-select" scope="col">
                          <input
                            type="checkbox"
                            aria-label="Select all visible submissions"
                            checked={allVisibleSelected}
                            onChange={toggleSelectAllVisible}
                          />
                        </th>
                        <th scope="col">Submission</th>
                        <th scope="col">Stage / SLA</th>
                        <th scope="col" className="table-actions-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => (
                        <tr 
                          key={item.id}
                          className={selectedIds.has(item.id) ? "is-selected" : ""}
                          onClick={() => navigate(`/submissions/${item.id}`)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Select ${item.projectCode}`}
                              checked={selectedIds.has(item.id)}
                              onChange={(event) => {
                                event.stopPropagation();
                                toggleSelection(item.id);
                              }}
                              onClick={(event) => event.stopPropagation()}
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
                              item.status.includes("REVISION") ? "pending" :
                              item.status.includes("REVIEW") ? "on-track" :
                              "pending"
                            }`}>
                              <span className="status-dot"></span>
                              {formatStatusLabel(item.status)}
                            </span>
                            <span className={`status-badge sla-inline ${
                              isPaused(item)
                                ? "pending"
                                : isOverdue(item)
                                ? "overdue"
                                : isDueSoon(item)
                                ? "due-soon"
                                : "on-track"
                            }`}>
                              {slaChipText(item)}
                            </span>
                            {(isOverdue(item) || isDueSoon(item)) && renderOverdueOwnerBadge(item, isOverdue(item) ? "overdue" : "pending")}
                          </td>
                          <td className="table-actions">
                            <div className="row-actions">
                              <button
                                type="button"
                                className="row-action-btn"
                                title="Quick view"
                                aria-label="Quick view"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openQuickView(item);
                                }}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                className="row-action-btn"
                                title="Open details"
                                aria-label="Open submission details"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  navigate(`/submissions/${item.id}`);
                                }}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 5l7 7-7 7M3 12h18" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {/* Pagination footer */}
                {totalFiltered > 0 && (
                  <div className="table-pagination">
                    <span className="pagination-info">
                      Showing {startIdx + 1}–{endIdx} of {totalFiltered}
                    </span>
                    <div className="pagination-controls">
                      <button
                        type="button"
                        className="pagination-btn"
                        disabled={safePage <= 1}
                        onClick={() => setCurrentPage(safePage - 1)}
                        aria-label="Previous page"
                      >
                        ← Previous
                      </button>
                      <span className="pagination-current">
                        Page {safePage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        className="pagination-btn"
                        disabled={safePage >= totalPages}
                        onClick={() => setCurrentPage(safePage + 1)}
                        aria-label="Next page"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
                {selectedCount > 0 && (
                  <div className="bulk-action-bar" role="region" aria-label="Bulk actions">
                    <div className="bulk-selection">
                      {selectedCount} selected
                      <button
                        className="bulk-clear"
                        type="button"
                        onClick={clearSelection}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="bulk-actions">
                      <button className="ghost-btn" type="button" onClick={handleBulkAssign}>
                        Assign reviewers
                      </button>
                      <button className="ghost-btn" type="button" onClick={handleBulkReminder}>
                        Send reminders
                      </button>
                      <button className="ghost-btn" type="button" onClick={handleBulkStatusChange}>
                        Change status
                      </button>
                      <button className="primary-btn" type="button" onClick={handleExportSelected}>
                        Export selected
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {quickViewOpen && (
            <div
              className="quick-view-backdrop"
              role="dialog"
              aria-modal="true"
              onClick={() => setQuickViewOpen(false)}
            >
              <div
                className="quick-view-modal"
                onClick={(event) => event.stopPropagation()}
              >
                {/* Header with project code accent */}
                <div className="quick-view-header">
                  <div className="quick-view-header-left">
                    <span className="quick-view-code">{quickViewSummary?.projectCode ?? "—"}</span>
                    <h3>{quickViewSummary?.projectTitle ?? "—"}</h3>
                    <div className="quick-view-header-meta">
                      <span>{quickViewSummary?.piName ?? "—"}</span>
                      {quickViewSummary?.staffInChargeName && (
                        <>
                          <span className="quick-view-sep">•</span>
                          <span>Assigned to {quickViewSummary.staffInChargeName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    className="quick-view-close"
                    type="button"
                    onClick={() => setQuickViewOpen(false)}
                    aria-label="Close quick view"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {quickViewLoading ? (
                  <div className="quick-view-body">
                    <div className="quick-view-skeleton">
                      <div className="skeleton-pill" style={{ width: 80 }}></div>
                      <div className="skeleton-line wide" style={{ marginTop: 16 }}></div>
                      <div className="skeleton-line" style={{ marginTop: 8 }}></div>
                      <div className="skeleton-line small" style={{ marginTop: 8 }}></div>
                      <div className="skeleton-pill" style={{ width: 120, marginTop: 20 }}></div>
                      <div className="skeleton-line" style={{ marginTop: 8 }}></div>
                      <div className="skeleton-line small" style={{ marginTop: 8 }}></div>
                    </div>
                  </div>
                ) : quickViewError ? (
                  <div className="quick-view-body">
                    <div className="quick-view-error">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4M12 16h.01" />
                      </svg>
                      <p>{quickViewError}</p>
                      <button className="ghost-btn" onClick={() => { setQuickViewOpen(false); setTimeout(() => { setQuickViewOpen(true); }, 100); }}>
                        Retry
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="quick-view-body">
                    {/* Status badges row */}
                    <div className="quick-view-badges">
                      <span className={`status-badge ${
                        (quickViewDetail?.status ?? "").includes("REVISION") ? "pending" :
                        (quickViewDetail?.status ?? "").includes("REVIEW") ? "on-track" :
                        "pending"
                      }`}>
                        <span className="status-dot"></span>
                        {formatStatusLabel(quickViewDetail?.status ?? null)}
                      </span>
                      {quickViewDetail?.classification?.reviewType && (
                        <span className="status-badge neutral">
                          {quickViewDetail.classification.reviewType}
                        </span>
                      )}
                      {quickViewDetail?.finalDecision && (
                        <span className={`status-badge ${
                          quickViewDetail.finalDecision === "APPROVED" ? "on-track" : "pending"
                        }`}>
                          {formatStatusLabel(quickViewDetail.finalDecision)}
                        </span>
                      )}
                    </div>

                    {/* Key details — horizontal cards */}
                    <div className="quick-view-details">
                      <div className="qv-detail-item">
                        <span className="qv-detail-label">Submission type</span>
                        <span className="qv-detail-value">{quickViewDetail?.submissionType ?? "—"}</span>
                      </div>
                      <div className="qv-detail-item">
                        <span className="qv-detail-label">Received</span>
                        <span className="qv-detail-value">{formatShortDate(quickViewDetail?.receivedDate)}</span>
                      </div>
                      <div className="qv-detail-item">
                        <span className="qv-detail-label">SLA due</span>
                        <span className="qv-detail-value">{quickViewSla ? formatShortDate(quickViewSla.classification?.end ?? null) : "Not set"}</span>
                      </div>
                      <div className="qv-detail-item">
                        <span className="qv-detail-label">Staff in charge</span>
                        <span className="qv-detail-value">{quickViewSummary?.staffInChargeName ?? "Unassigned"}</span>
                      </div>
                    </div>

                    {/* Recent activity */}
                    <div className="quick-view-section">
                      <h4>Recent activity</h4>
                      {quickViewDetail?.statusHistory?.length ? (
                        <div className="quick-view-timeline">
                          {quickViewDetail.statusHistory
                            .slice(-4)
                            .reverse()
                            .map((entry, idx) => (
                              <div key={entry.id} className={`quick-view-event ${idx === 0 ? "latest" : ""}`}>
                                <div className={`quick-view-dot ${idx === 0 ? "dot-active" : ""}`}></div>
                                <div className="quick-view-event-content">
                                  <div className="quick-view-event-title">
                                    {formatStatusLabel(entry.newStatus)}
                                  </div>
                                  <div className="quick-view-event-meta">
                                    {formatShortDate(entry.effectiveDate)}
                                    {entry.changedBy?.fullName && ` — ${entry.changedBy.fullName}`}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="quick-view-empty">No activity recorded yet.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="quick-view-footer">
                  <button
                    className="ghost-btn"
                    type="button"
                    onClick={() => setQuickViewOpen(false)}
                  >
                    Close
                  </button>
                  {quickViewId && (
                    <button
                      className="primary-btn"
                      type="button"
                      onClick={() => navigate(`/submissions/${quickViewId}`)}
                    >
                      Open full record →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
    </div>
  );
};
