import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDashboardQueues } from "@/hooks/useDashboardQueues";
import { useDashboardActivity } from "@/hooks/useDashboardActivity";
import { useDashboardOverdue } from "@/hooks/useDashboardOverdue";
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

type CollapsedPanels = {
  actionNow: boolean;
  overdue: boolean;
  quickActions: boolean;
  activity: boolean;
};

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
  const [slaFilter, setSlaFilter] = useState<
    "all" | "on-track" | "due-soon" | "overdue" | "paused"
  >("all");
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);
  const [overdueTab, setOverdueTab] = useState<
    "submissions" | "reviewers" | "endorsements" | "due-soon"
  >("submissions");
  const [letterModalOpen, setLetterModalOpen] = useState(false);
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
  const [railCollapsed, setRailCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("dashboardRailCollapsed") === "true";
  });
  const [density, setDensity] = useState<"compact" | "comfortable">(() => {
    if (typeof window === "undefined") return "comfortable";
    return (window.localStorage.getItem("dashboardDensity") as "compact" | "comfortable") ?? "comfortable";
  });
  const [collapsedPanels, setCollapsedPanels] = useState<CollapsedPanels>(() => {
    if (typeof window === "undefined") {
      return {
        actionNow: false,
        overdue: false,
        quickActions: false,
        activity: false,
      };
    }
    try {
      const stored = window.localStorage.getItem("dashboardCollapsedPanels");
      return stored
        ? JSON.parse(stored)
        : {
            actionNow: false,
            overdue: false,
            quickActions: false,
            activity: false,
          };
    } catch {
      return {
        actionNow: false,
        overdue: false,
        quickActions: false,
        activity: false,
      };
    }
  });
  const [activityFilter, setActivityFilter] = useState<
    "all" | "classification" | "review" | "revision"
  >("all");
  const tableRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fromLogin = Boolean((location.state as { fromLogin?: boolean } | null)?.fromLogin);

  const {
    counts,
    classificationQueue,
    reviewQueue,
    revisionQueue,
    letterReadiness,
    attention,
    allItems,
    lastUpdated,
    refresh,
    loading,
    error,
  } = useDashboardQueues("RERC-HUMAN");

  const {
    activity,
    loading: activityLoading,
    error: activityError,
    refresh: refreshActivity,
  } = useDashboardActivity("RERC-HUMAN");

  const {
    overdueReviews,
    overdueEndorsements,
    loading: overdueLoading,
    error: overdueError,
    refresh: refreshOverdue,
  } = useDashboardOverdue("RERC-HUMAN");

  const handleRefresh = () => {
    refresh();
    refreshActivity();
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

  const baseItems = useMemo(() => {
    switch (queueFilter) {
      case "classification":
        return classificationQueue;
      case "review":
        return reviewQueue;
      case "revision":
        return revisionQueue;
      case "due-soon":
        return allItems.filter(isDueSoon);
      case "overdue":
        return allItems.filter(isOverdue);
      case "blocked":
        return allItems.filter(isBlocked);
      case "unassigned":
        return allItems.filter(isUnassigned);
      default:
        return allItems;
    }
  }, [
    queueFilter,
    classificationQueue,
    reviewQueue,
    revisionQueue,
    allItems,
  ]);

  const slaCounts = useMemo(() => {
    return {
      all: baseItems.length,
      onTrack: baseItems.filter((item) => item.slaStatus === "ON_TRACK").length,
      dueSoon: baseItems.filter((item) => item.slaStatus === "DUE_SOON").length,
      overdue: baseItems.filter((item) => item.slaStatus === "OVERDUE").length,
      paused: baseItems.filter((item) => isPaused(item)).length,
    };
  }, [baseItems, isPaused]);

  const slaFilteredItems = useMemo(() => {
    if (slaFilter === "all") return baseItems;
    if (slaFilter === "paused") return baseItems.filter((item) => isPaused(item));
    const target =
      slaFilter === "overdue"
        ? "OVERDUE"
        : slaFilter === "due-soon"
        ? "DUE_SOON"
        : "ON_TRACK";
    return baseItems.filter((item) => item.slaStatus === target);
  }, [baseItems, slaFilter, isPaused]);

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
  const filteredItems = sortedItems.slice(0, 10);
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
    if (slaFilter !== "all") {
      const labelMap: Record<string, string> = {
        "on-track": "On track",
        "due-soon": "Due soon",
        overdue: "Overdue",
        paused: "SLA paused",
      };
      chips.push({
        id: "sla",
        label: `SLA: ${labelMap[slaFilter] ?? slaFilter}`,
        onClear: () => setSlaFilter("all"),
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
  }, [queueFilter, slaFilter, searchTerm]);

  const handleLetterExport = (templateCode: string) => {
    const rows = allItems.filter((row) =>
      templateCode === "ALL" ? true : row.templateCode === templateCode
    );
    if (rows.length === 0) {
      window.alert("No rows available for export.");
      return;
    }
    const headers = [
      "template_code",
      "submission_id",
      "project_code",
      "project_title",
      "pi_name",
      "status",
      "sla_status",
      "missing_fields",
    ];
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        [
          row.templateCode,
          row.id,
          row.projectCode,
          row.projectTitle,
          row.piName,
          row.status,
          row.slaStatus,
          row.missingFields.join("|"),
        ]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `letter_readiness_${templateCode}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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

  const handleViewMissing = (templateCode: string, fields: string[]) => {
    const message = fields.length ? fields.join(", ") : "none";
    window.alert(`Missing fields for ${templateCode}: ${message}`);
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

  const actionNowItems = useMemo(() => {
    const actionable = allItems.filter(
      (item) => isOverdue(item) || isDueSoon(item) || isBlocked(item)
    );
    return actionable
      .sort((a, b) => priorityScore(b) - priorityScore(a))
      .slice(0, 6);
  }, [allItems]);

  const letterTotals = useMemo(() => {
    return letterReadiness.reduce(
      (acc, row) => {
        acc.ready += row.ready;
        acc.missing += row.missingFields;
        return acc;
      },
      { ready: 0, missing: 0 }
    );
  }, [letterReadiness]);

  const filteredActivity = useMemo(() => {
    if (activityFilter === "all") return activity;
    return activity.filter((entry) => {
      const status = entry.newStatus?.toUpperCase() ?? "";
      if (activityFilter === "classification") {
        return status.includes("CLASS");
      }
      if (activityFilter === "review") {
        return status.includes("REVIEW");
      }
      return status.includes("REVISION");
    });
  }, [activity, activityFilter]);

  const activityToShow = useMemo(
    () => filteredActivity.slice(0, 3),
    [filteredActivity]
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
        const data = await searchProjects(query, "RERC-HUMAN", 6);
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
        const [detail, sla] = await Promise.all([
          fetchSubmissionDetail(quickViewId),
          fetchSubmissionSlaSummary(quickViewId),
        ]);
        if (cancelled) return;
        setQuickViewDetail(detail);
        setQuickViewSla(sla);
        setQuickViewError(null);
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
      "dashboardRailCollapsed",
      railCollapsed ? "true" : "false"
    );
  }, [railCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dashboardDensity", density);
  }, [density]);

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
      <div className="dashboard-page">
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
      className={`dashboard-page ${fromLogin ? "dashboard-enter" : ""} ${
        loading ? "is-loading" : "is-ready"
      }`}
    >
      <div className="dashboard-layout">
        {/* Sidebar */}
        <aside className="dashboard-sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <div className="sidebar-logo-icon">R</div>
              <div>
                <h1>RERC Portal</h1>
                <span>Research Ethics</span>
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-section">
              <div className="nav-section-title">Main</div>
              <button
                className={`nav-item ${
                  queueFilter === "all" ? "active" : ""
                }`}
                onClick={() => setQueueFilter("all")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
                Dashboard
              </button>
              <button className="nav-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                All Submissions
              </button>
              <button className="nav-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
                Reviewers
              </button>
            </div>

            <div className="nav-section">
              <div className="nav-section-title">Queues</div>
              <button
                className={`nav-item ${
                  queueFilter === "classification" ? "active" : ""
                }`}
                onClick={() => setQueueFilter("classification")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h7"/>
                </svg>
                Classification
                {(counts?.forClassification ?? 0) > 0 && (
                  <span className="nav-item-badge">{counts?.forClassification}</span>
                )}
              </button>
              <button
                className={`nav-item ${
                  queueFilter === "review" ? "active" : ""
                }`}
                onClick={() => setQueueFilter("review")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                </svg>
                Under Review
              </button>
              <button
                className={`nav-item ${
                  queueFilter === "revision" ? "active" : ""
                }`}
                onClick={() => setQueueFilter("revision")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Revisions
              </button>
            </div>

            <div className="nav-section">
              <div className="nav-section-title">Tools</div>
              <button className="nav-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                </svg>
                Letter Generator
              </button>
              <button className="nav-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                Reports
              </button>
            </div>
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-avatar">RA</div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">Research Associate</div>
                <div className="sidebar-user-role">RERC-HUMAN</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="dashboard-main">
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

          {/* Action Now */}
          <div className="panel action-now-panel">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Action now</h3>
                <p className="panel-subtitle">
                  Prioritized by SLA risk, blocked fields, and ownership.
                </p>
              </div>
              <button
                className="panel-toggle"
                type="button"
                onClick={() =>
                    setCollapsedPanels((prev: CollapsedPanels) => ({
                    ...prev,
                    actionNow: !prev.actionNow,
                  }))
                }
                aria-expanded={!collapsedPanels.actionNow}
              >
                {collapsedPanels.actionNow ? "Expand" : "Collapse"}
              </button>
            </div>
            <div
              className={`panel-body collapsible ${
                collapsedPanels.actionNow ? "is-collapsed" : ""
              }`}
              aria-hidden={collapsedPanels.actionNow}
            >
                {actionNowItems.length === 0 ? (
                  <div className="empty-state compact">
                    <h3>Nothing urgent right now</h3>
                    <p>Review the full queue or check “Due ≤3 days”.</p>
                  </div>
                ) : (
                  <div className="action-now-list">
                    {actionNowItems.map((item) => (
                      <div key={item.id} className="action-now-item">
                        <div className="action-now-main">
                          <div className="action-now-title">
                            <span
                              className={`priority-dot ${
                                isOverdue(item)
                                  ? "overdue"
                                  : isDueSoon(item)
                                  ? "due-soon"
                                  : "blocked"
                              }`}
                              aria-hidden="true"
                            />
                            {item.projectCode} • {item.projectTitle}
                          </div>
                          <div className="action-now-meta">
                            {item.piName} •{" "}
                            {item.staffInChargeName
                              ? `Owner: ${item.staffInChargeName}`
                              : "Unassigned"}
                          </div>
                          <div className="action-now-tags">
                            <span
                              className={`sla-chip-badge ${
                                isOverdue(item)
                                  ? "overdue"
                                  : isDueSoon(item)
                                  ? "due-soon"
                                  : "on-track"
                              }`}
                            >
                              {slaChipText(item)}
                            </span>
                            {isBlocked(item) && (
                              <span className="block-chip">
                                {blockReasonFor(item)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="action-now-actions">
                          <button
                            className="ghost-btn"
                            type="button"
                            onClick={() => navigate(`/submissions/${item.id}`)}
                          >
                            Open
                          </button>
                          <button
                            className="ghost-btn"
                            type="button"
                            onClick={() => {
                              const confirmed = window.confirm(
                                "Send reminder for this submission?"
                              );
                              if (confirmed) {
                                window.alert("Reminder queued (UI only).");
                              }
                            }}
                          >
                            Remind
                          </button>
                          <button
                            className="primary-btn"
                            type="button"
                            onClick={() =>
                              window.alert(
                                "Assign reviewer (UI only; backend pending)."
                              )
                            }
                          >
                            Assign
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card danger" onClick={() => setQueueFilter("overdue")}>
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
            <button
              className="ghost-btn"
              type="button"
              onClick={() => setRailCollapsed((prev) => !prev)}
            >
              {railCollapsed ? "Show insights" : "Hide insights"}
            </button>
          </div>

          {/* Content Grid */}
          <div className={`content-grid ${railCollapsed ? "rail-collapsed" : ""}`}>
            {/* Main Table Panel */}
            <div className="panel" ref={tableRef}>
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">Submissions Queue</h3>
                  <p className="panel-subtitle">
                    Showing {filteredItems.length} of {totalFiltered} submissions • newest first
                  </p>
                </div>
                <div className="panel-actions">
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
                          }`}
                          onClick={() =>
                            setQueueFilter(tab.key as typeof queueFilter)
                          }
                        >
                          {tab.label}
                          <span className="filter-tab-count">
                            ({tab.count})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="filter-row">
                  <div className="filter-group">
                    <span className="filter-label">SLA</span>
                    <div className="sla-chips">
                      {[
                        { key: "all", label: `All (${slaCounts.all})` },
                        {
                          key: "on-track",
                          label: `On track (${slaCounts.onTrack})`,
                        },
                        {
                          key: "due-soon",
                          label: `Due soon (${slaCounts.dueSoon})`,
                        },
                        {
                          key: "overdue",
                          label: `Overdue (${slaCounts.overdue})`,
                        },
                        {
                          key: "paused",
                          label: `Paused (${slaCounts.paused})`,
                        },
                      ].map((chip) => (
                        <button
                          key={chip.key}
                          className={`sla-chip ${
                            slaFilter === chip.key ? "active" : ""
                          }`}
                          onClick={() =>
                            setSlaFilter(chip.key as typeof slaFilter)
                          }
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="filter-group filter-actions">
                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={() =>
                        setDensity((prev: "compact" | "comfortable") =>
                          prev === "compact" ? "comfortable" : "compact"
                        )
                      }
                    >
                      Density: {density === "compact" ? "Compact" : "Comfortable"}
                    </button>
                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={() => {
                        setQueueFilter("all");
                        setSlaFilter("all");
                        setSearchTerm("");
                      }}
                    >
                      Reset filters
                    </button>
                  </div>
                </div>
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
              </div>

              <div className="panel-body no-padding">
                {loading && filteredItems.length === 0 ? (
                  <table className="data-table table-skeleton">
                    <thead>
                      <tr>
                        <th className="table-select" scope="col">
                          <span className="skeleton-box"></span>
                        </th>
                        <th scope="col">Code / Title</th>
                        <th scope="col">PI / Queue</th>
                        <th scope="col">Stage</th>
                        <th scope="col">SLA</th>
                        <th scope="col" className="hide-mobile">Owner</th>
                        <th scope="col" className="hide-mobile">Block</th>
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
                          </td>
                          <td>
                            <div className="skeleton-line"></div>
                            <div className="skeleton-line small"></div>
                          </td>
                          <td>
                            <div className="skeleton-pill"></div>
                          </td>
                          <td>
                            <div className="skeleton-pill"></div>
                          </td>
                          <td className="hide-mobile">
                            <div className="skeleton-line small"></div>
                          </td>
                          <td className="hide-mobile">
                            <div className="skeleton-line small"></div>
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
                        setSlaFilter("all");
                        setSearchTerm("");
                      }}
                    >
                      Reset filters
                    </button>
                  </div>
                ) : (
                  <table
                    className={`data-table ${
                      density === "compact" ? "compact" : ""
                    } ${loading ? "is-loading" : ""}`}
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
                        <th scope="col">Code / Title</th>
                        <th scope="col">PI / Queue</th>
                        <th scope="col">Stage</th>
                        <th scope="col">SLA</th>
                        <th scope="col" className="hide-mobile">Owner</th>
                        <th scope="col" className="hide-mobile">Block</th>
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
                              <span
                                className={`audit-icon ${
                                  isOverdue(item)
                                    ? "overdue"
                                    : isDueSoon(item)
                                    ? "due-soon"
                                    : isBlocked(item)
                                    ? "blocked"
                                    : "on-track"
                                }`}
                                title={
                                  isOverdue(item)
                                    ? "Overdue"
                                    : isDueSoon(item)
                                    ? "Due soon"
                                    : isBlocked(item)
                                    ? "Blocked"
                                    : "On track"
                                }
                                aria-hidden="true"
                              />
                              {item.projectCode}
                            </div>
                            <div className="table-subtitle">{item.projectTitle}</div>
                          </td>
                          <td>
                            <div className="table-title">{item.piName}</div>
                            <div className="table-subtitle">
                              Queue: {formatStatusLabel(item.queue)}
                            </div>
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
                            {item.status === "REVISION_SUBMITTED" && (
                              <span className="status-tag">Reopened</span>
                            )}
                          </td>
                          <td>
                            <div className="sla-stack">
                              <span className={`status-badge ${
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
                              <span className="table-meta">
                                Due {formatShortDate(item.slaDueDate)}
                              </span>
                            </div>
                          </td>
                          <td className="hide-mobile">
                            <span className="table-owner">
                              {item.staffInChargeName ?? "Unassigned"}
                            </span>
                          </td>
                          <td className="hide-mobile">
                            <span className="table-block">{blockReasonFor(item)}</span>
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
                              <button
                                type="button"
                                className="row-action-btn"
                                title="Assign reviewer"
                                aria-label="Assign reviewer"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  window.alert("Assign reviewer (UI only).");
                                }}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
                                  <circle cx="9" cy="7" r="4" />
                                  <path d="M19 8v6M22 11h-6" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                className="row-action-btn"
                                title="Generate letter"
                                aria-label="Generate letter"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  window.alert("Generate letter (UI only).");
                                }}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                  <path d="M14 2v6h6M8 13h8M8 17h5" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

            {/* Right Column */}
            {!railCollapsed && (
            <div className="dashboard-rail">
              {/* Overdue Panel */}
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">Overdue queue</h3>
                    <p className="panel-subtitle">Focus on the most urgent items first.</p>
                  </div>
                  <button
                    className="panel-toggle"
                    type="button"
                    onClick={() =>
                      setCollapsedPanels((prev: CollapsedPanels) => ({
                        ...prev,
                        overdue: !prev.overdue,
                      }))
                    }
                    aria-expanded={!collapsedPanels.overdue}
                  >
                    {collapsedPanels.overdue ? "Expand" : "Collapse"}
                  </button>
                  {!collapsedPanels.overdue && (
                    <div className="panel-tabs">
                      <button
                        className={`panel-tab ${
                          overdueTab === "submissions" ? "active" : ""
                        }`}
                        onClick={() => setOverdueTab("submissions")}
                      >
                        Submissions ({overdueSubmissions.length})
                      </button>
                      <button
                        className={`panel-tab ${
                          overdueTab === "reviewers" ? "active" : ""
                        }`}
                        onClick={() => setOverdueTab("reviewers")}
                      >
                        Reviewers ({overdueReviews.length})
                      </button>
                      <button
                        className={`panel-tab ${
                          overdueTab === "due-soon" ? "active" : ""
                        }`}
                        onClick={() => setOverdueTab("due-soon")}
                      >
                        Due ≤3 days ({dueSoonSubmissions.length})
                      </button>
                      <button
                        className={`panel-tab ${
                          overdueTab === "endorsements" ? "active" : ""
                        }`}
                        onClick={() => setOverdueTab("endorsements")}
                      >
                        Endorsements ({overdueEndorsements.length})
                      </button>
                    </div>
                  )}
                </div>
                <div
                  className={`panel-body collapsible ${
                    collapsedPanels.overdue ? "is-collapsed" : ""
                  }`}
                  aria-hidden={collapsedPanels.overdue}
                >
                  {overdueLoading ? (
                    <div className="empty-state compact">
                      <p>Loading overdue items...</p>
                    </div>
                  ) : overdueError ? (
                    <div className="empty-state compact">
                      <p>{overdueError}</p>
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={refreshOverdue}
                      >
                        Retry
                      </button>
                    </div>
                  ) : overdueTab === "submissions" ? (
                    overdueSubmissions.length === 0 ? (
                      <div className="empty-state compact">
                        <p>No overdue submissions.</p>
                      </div>
                    ) : (
                      <div className="overdue-list">
                        {overdueSubmissions.slice(0, 5).map((item) => (
                          <div key={item.id} className="overdue-item">
                            <div className="overdue-main">
                              <div className="overdue-title">
                                {item.projectCode} • {item.piName}
                              </div>
                              <div className="overdue-meta">
                                Due {formatShortDate(item.slaDueDate)} •{" "}
                                {formatStatusLabel(item.status)}
                              </div>
                            </div>
                            <button
                              className="overdue-link"
                              type="button"
                              onClick={() => navigate(`/submissions/${item.id}`)}
                            >
                              Open
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  ) : overdueTab === "due-soon" ? (
                    dueSoonSubmissions.length === 0 ? (
                      <div className="empty-state compact">
                        <p>No submissions due in ≤3 days.</p>
                      </div>
                    ) : (
                      <div className="overdue-list">
                        {dueSoonSubmissions.slice(0, 5).map((item) => (
                          <div key={item.id} className="overdue-item">
                            <div className="overdue-main">
                              <div className="overdue-title">
                                {item.projectCode} • {item.piName}
                              </div>
                              <div className="overdue-meta">
                                Due {formatShortDate(item.slaDueDate)} •{" "}
                                {formatStatusLabel(item.status)}
                              </div>
                            </div>
                            <button
                              className="overdue-link"
                              type="button"
                              onClick={() => navigate(`/submissions/${item.id}`)}
                            >
                              Open
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  ) : overdueTab === "reviewers" ? (
                    overdueReviews.length === 0 ? (
                      <div className="empty-state compact">
                        <p>No overdue reviewer tasks.</p>
                      </div>
                    ) : (
                      <div className="overdue-list">
                        {overdueReviews.slice(0, 5).map((review) => (
                          <div key={review.id} className="overdue-item">
                            <div className="overdue-main">
                              <div className="overdue-title">
                                {review.projectCode} • {review.reviewerName}
                              </div>
                              <div className="overdue-meta">
                                Due {formatShortDate(review.dueDate)} •{" "}
                                {review.daysOverdue}d overdue
                              </div>
                            </div>
                            <button
                              className="overdue-link"
                              type="button"
                              onClick={() => navigate(`/submissions/${review.submissionId}`)}
                            >
                              Open
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  ) : overdueEndorsements.length === 0 ? (
                    <div className="empty-state compact">
                      <p>No overdue endorsements.</p>
                    </div>
                  ) : (
                    <div className="overdue-list">
                      {overdueEndorsements.slice(0, 5).map((review) => (
                        <div key={review.id} className="overdue-item">
                          <div className="overdue-main">
                            <div className="overdue-title">
                              {review.projectCode} • {review.reviewerName}
                            </div>
                            <div className="overdue-meta">
                              Due {formatShortDate(review.dueDate)} •{" "}
                              {review.daysOverdue}d overdue
                            </div>
                          </div>
                          <button
                            className="overdue-link"
                            type="button"
                            onClick={() => navigate(`/submissions/${review.submissionId}`)}
                          >
                            Open
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">Quick actions</h3>
                    <p className="panel-subtitle">
                      {selectedCount > 0
                        ? `Actions for ${selectedCount} selected submissions.`
                        : "Select submissions to unlock bulk actions."}
                    </p>
                  </div>
                  <button
                    className="panel-toggle"
                    type="button"
                    onClick={() =>
                      setCollapsedPanels((prev: CollapsedPanels) => ({
                        ...prev,
                        quickActions: !prev.quickActions,
                      }))
                    }
                    aria-expanded={!collapsedPanels.quickActions}
                  >
                    {collapsedPanels.quickActions ? "Expand" : "Collapse"}
                  </button>
                </div>
                <div
                  className={`panel-body collapsible ${
                    collapsedPanels.quickActions ? "is-collapsed" : ""
                  }`}
                  aria-hidden={collapsedPanels.quickActions}
                >
                  <div className="quick-actions">
                    <button
                      type="button"
                      className="quick-action"
                      onClick={() => window.alert("Create new submission (UI only).")}
                    >
                      <div className="quick-action-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <path d="M14 2v6h6M12 18v-6M9 15h6"/>
                        </svg>
                      </div>
                      <span className="quick-action-text">New submission</span>
                    </button>
                    <button
                      type="button"
                      className={`quick-action ${selectedCount === 0 ? "disabled" : ""}`}
                      onClick={handleBulkStatusChange}
                      disabled={selectedCount === 0}
                    >
                      <div className="quick-action-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                        </svg>
                      </div>
                      <span className="quick-action-text">Change status</span>
                    </button>
                    <button
                      type="button"
                      className={`quick-action ${selectedCount === 0 ? "disabled" : ""}`}
                      onClick={handleBulkAssign}
                      disabled={selectedCount === 0}
                    >
                      <div className="quick-action-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                        </svg>
                      </div>
                      <span className="quick-action-text">Assign reviewer</span>
                    </button>
                    <button
                      type="button"
                      className={`quick-action ${selectedCount === 0 ? "disabled" : ""}`}
                      onClick={handleBulkReminder}
                      disabled={selectedCount === 0}
                    >
                      <div className="quick-action-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                        </svg>
                      </div>
                      <span className="quick-action-text">Send reminder</span>
                    </button>
                  </div>
                  <div className="quick-actions-summary">
                    <div className="quick-actions-metrics">
                      <div>
                        <div className="quick-actions-label">Letters ready</div>
                        <div className="quick-actions-value">
                          {letterTotals.ready}
                        </div>
                      </div>
                      <div>
                        <div className="quick-actions-label">Missing fields</div>
                        <div className="quick-actions-value warning">
                          {letterTotals.missing}
                        </div>
                      </div>
                    </div>
                    <div className="quick-actions-buttons">
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={() => setLetterModalOpen(true)}
                      >
                        View details
                      </button>
                      <button
                        className="primary-btn"
                        type="button"
                        onClick={() => handleLetterExport("ALL")}
                      >
                        Export all
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">Recent Activity</h3>
                    <p className="panel-subtitle">Latest 3 updates</p>
                  </div>
                  <button
                    className="panel-toggle"
                    type="button"
                    onClick={() =>
                      setCollapsedPanels((prev: CollapsedPanels) => ({
                        ...prev,
                        activity: !prev.activity,
                      }))
                    }
                    aria-expanded={!collapsedPanels.activity}
                  >
                    {collapsedPanels.activity ? "Expand" : "Collapse"}
                  </button>
                </div>
                <div
                  className={`panel-body collapsible ${
                    collapsedPanels.activity ? "is-collapsed" : ""
                  }`}
                  aria-hidden={collapsedPanels.activity}
                >
                  <div className="activity-filters">
                    {[
                      { key: "all", label: "All" },
                      { key: "classification", label: "Classification" },
                      { key: "review", label: "Review" },
                      { key: "revision", label: "Revision" },
                    ].map((filter) => (
                      <button
                        key={filter.key}
                        className={`panel-tab ${
                          activityFilter === filter.key ? "active" : ""
                        }`}
                        onClick={() =>
                          setActivityFilter(filter.key as typeof activityFilter)
                        }
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                  {activityLoading && activity.length === 0 ? (
                    <div className="empty-state compact">
                      <p>Loading recent activity...</p>
                    </div>
                  ) : activityError ? (
                    <div className="empty-state compact">
                      <p>{activityError}</p>
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={refreshActivity}
                      >
                        Retry
                      </button>
                    </div>
                  ) : activityToShow.length === 0 ? (
                    <div className="empty-state compact">
                      <p>No recent activity yet.</p>
                    </div>
                  ) : (
                    <div className="activity-list">
                      {activityToShow.map((entry) => (
                        <div key={entry.id} className="activity-item">
                          <div className="activity-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                          <div className="activity-content">
                            <div className="activity-text">
                              <strong>{entry.projectCode}</strong> moved to{" "}
                              {formatStatusLabel(entry.newStatus)}
                            </div>
                            <div className="activity-meta">
                              {entry.projectTitle} |{" "}
                              {entry.changedBy?.fullName ?? "System"}
                            </div>
                            <div className="activity-time">
                              {formatTimeAgo(new Date(entry.effectiveDate))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}
          </div>

          {letterModalOpen && (
            <div
              className="letter-modal-backdrop"
              role="dialog"
              aria-modal="true"
              onClick={() => setLetterModalOpen(false)}
            >
              <div
                className="letter-modal"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="letter-modal-header">
                  <div>
                    <h3>Letter readiness</h3>
                    <p>Ready vs. missing fields by template.</p>
                  </div>
                  <button
                    className="quick-view-close"
                    type="button"
                    onClick={() => setLetterModalOpen(false)}
                    aria-label="Close letter details"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="letter-modal-body">
                  {letterReadiness.length === 0 ? (
                    <div className="empty-state compact">
                      <p>No letter readiness data yet.</p>
                    </div>
                  ) : (
                    <div className="letter-grid compact">
                      <div className="letter-grid-row header">
                        <div>Template</div>
                        <div>Ready</div>
                        <div>Missing</div>
                        <div>Actions</div>
                      </div>
                      {letterReadiness.map((row) => (
                        <div key={row.templateCode} className="letter-grid-row">
                          <div className="letter-template">{row.templateCode}</div>
                          <div className="letter-count">{row.ready}</div>
                          <div
                            className={`letter-missing ${
                              row.missingFields > 0 ? "has-missing" : ""
                            }`}
                          >
                            {row.missingFields}
                          </div>
                          <div className="letter-actions">
                            <button
                              className="letter-action-btn"
                              type="button"
                              onClick={() => handleLetterExport(row.templateCode)}
                            >
                              Export CSV
                            </button>
                            <button
                              className="letter-action-btn ghost"
                              type="button"
                              disabled={row.missingFields === 0}
                              onClick={() =>
                                handleViewMissing(
                                  row.templateCode,
                                  row.samples.flatMap((sample) => sample.fields)
                                )
                              }
                            >
                              View missing
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="letter-modal-footer">
                  <button
                    className="ghost-btn"
                    type="button"
                    onClick={() => setLetterModalOpen(false)}
                  >
                    Close
                  </button>
                  <button
                    className="primary-btn"
                    type="button"
                    onClick={() => handleLetterExport("ALL")}
                  >
                    Export all
                  </button>
                </div>
              </div>
            </div>
          )}

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
                <div className="quick-view-header">
                  <div>
                    <h3>Submission quick view</h3>
                    <p>
                      {quickViewSummary?.projectCode ?? "—"} •{" "}
                      {quickViewSummary?.projectTitle ?? "—"}
                    </p>
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
                    <div className="empty-state compact">
                      <p>Loading submission details...</p>
                    </div>
                  </div>
                ) : quickViewError ? (
                  <div className="quick-view-body">
                    <div className="empty-state compact">
                      <p>{quickViewError}</p>
                    </div>
                  </div>
                ) : (
                  <div className="quick-view-body">
                    <div className="quick-view-grid">
                      <div className="quick-view-section">
                        <h4>General</h4>
                        <dl>
                          <div>
                            <dt>Project code</dt>
                            <dd>{quickViewSummary?.projectCode ?? "—"}</dd>
                          </div>
                          <div>
                            <dt>Title</dt>
                            <dd>{quickViewSummary?.projectTitle ?? "—"}</dd>
                          </div>
                          <div>
                            <dt>PI</dt>
                            <dd>{quickViewSummary?.piName ?? "—"}</dd>
                          </div>
                          <div>
                            <dt>Staff in charge</dt>
                            <dd>{quickViewSummary?.staffInChargeName ?? "—"}</dd>
                          </div>
                          <div>
                            <dt>Submission type</dt>
                            <dd>{quickViewDetail?.submissionType ?? "—"}</dd>
                          </div>
                          <div>
                            <dt>Status</dt>
                            <dd>{formatStatusLabel(quickViewDetail?.status ?? null)}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="quick-view-section">
                        <h4>Specific</h4>
                        <dl>
                          <div>
                            <dt>Received</dt>
                            <dd>{formatShortDate(quickViewDetail?.receivedDate)}</dd>
                          </div>
                          <div>
                            <dt>Review type</dt>
                            <dd>{quickViewDetail?.classification?.reviewType ?? "—"}</dd>
                          </div>
                          <div>
                            <dt>SLA due</dt>
                            <dd>{formatShortDate(quickViewSla?.classification.end ?? null)}</dd>
                          </div>
                          <div>
                            <dt>Final decision</dt>
                            <dd>{quickViewDetail?.finalDecision ?? "—"}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>

                    <div className="quick-view-section">
                      <h4>Recent status updates</h4>
                      {quickViewDetail?.statusHistory?.length ? (
                        <div className="quick-view-timeline">
                          {quickViewDetail.statusHistory
                            .slice(-3)
                            .reverse()
                            .map((entry) => (
                              <div key={entry.id} className="quick-view-event">
                                <div className="quick-view-dot"></div>
                                <div>
                                  <div className="quick-view-event-title">
                                    {formatStatusLabel(entry.newStatus)}
                                  </div>
                                  <div className="quick-view-event-meta">
                                    {formatShortDate(entry.effectiveDate)} •{" "}
                                    {entry.changedBy?.fullName ?? "System"}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="quick-view-empty">No status history yet.</p>
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
                      Open full record
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
