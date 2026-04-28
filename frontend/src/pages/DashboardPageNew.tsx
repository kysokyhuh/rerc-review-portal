import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDashboardQueues } from "@/hooks/useDashboardQueues";
import { useDashboardOverdue } from "@/hooks/useDashboardOverdue";
import { type DashboardFilterValues, filtersToParams } from "@/components/DashboardFilters";
import {
  fetchSubmissionDetail,
  fetchSubmissionSlaSummary,
  searchProjects,
} from "@/services/api";
import type { DecoratedQueueItem, ProjectSearchResult, SubmissionDetail, SubmissionSlaSummary } from "@/types";
import { DUE_SOON_THRESHOLD } from "@/constants";
import { BRAND } from "@/config/branding";
import {
  DashboardTopBar,
  AnnouncementBanner,
  StatsGrid,
  SubmissionsTable,
  QuickViewModal,
} from "@/components/dashboard";
import {
  AssignReviewersBulkModal,
  ChangeStatusBulkModal,
  DeleteProtocolsBulkModal,
  SendRemindersBulkModal,
} from "@/components/dashboard/BulkActionModals";
import {
  getGreeting,
  PAGE_SIZE,
  isOverdue,
  isDueSoon,
  isBlocked,
  isUnassigned,
  priorityScore,
  resolveOwnerRoleKey,
  exportRowsToCsv,
} from "@/components/dashboard/utils";
import "../styles/dashboard.css";

type QueueFilter =
  | "all" | "classification" | "review" | "revision"
  | "due-soon" | "overdue" | "blocked" | "unassigned";

type OverdueOwnerFilter =
  | "all"
  | "PROJECT_LEADER_RESEARCHER_PROPONENT"
  | "REVIEWER_GROUP"
  | "RESEARCH_ASSOCIATE_PROCESSING_STAFF"
  | "COMMITTEE_CHAIRPERSON_DESIGNATE"
  | "UNASSIGNED_PROCESS_GAP";

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // ── State ──────────────────────────────────────────────
  const [greeting] = useState(getGreeting());
  const [searchTerm, setSearchTerm] = useState("");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);
  const [overdueOwnerFilter, setOverdueOwnerFilter] = useState<OverdueOwnerFilter>("all");
  const [searchResults, setSearchResults] = useState<ProjectSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [quickViewId, setQuickViewId] = useState<number | null>(null);
  const [quickViewSummary, setQuickViewSummary] = useState<{
    projectCode: string; projectTitle: string; piName: string; staffInChargeName?: string | null;
  } | null>(null);
  const [quickViewDetail, setQuickViewDetail] = useState<SubmissionDetail | null>(null);
  const [quickViewSla, setQuickViewSla] = useState<SubmissionSlaSummary | null>(null);
  const [quickViewLoading, setQuickViewLoading] = useState(false);
  const [quickViewError, setQuickViewError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkModal, setBulkModal] = useState<
    "assign" | "reminders" | "status" | "delete" | null
  >(null);
  const [dashboardFilters, setDashboardFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);

  const tableRef = useRef<HTMLDivElement>(null!);
  const searchInputRef = useRef<HTMLInputElement>(null!);
  const fromLogin = Boolean((location.state as { fromLogin?: boolean } | null)?.fromLogin);

  // ── Effects ────────────────────────────────────────────
  useEffect(() => { document.title = "URERB Portal — Dashboard Overview"; }, []);
  useEffect(() => { if (queueFilter !== "overdue" && queueFilter !== "due-soon") setOverdueOwnerFilter("all"); }, [queueFilter]);
  useEffect(() => { setCurrentPage(1); }, [queueFilter, searchTerm, overdueOwnerFilter]);

  const handleDashboardFilterChange = useCallback((values: DashboardFilterValues) => {
    setDashboardFilters(filtersToParams(values));
  }, []);

  // ── Data hooks ─────────────────────────────────────────
  const {
    counts, classificationQueue, reviewQueue, revisionQueue,
    attention, allItems, lastUpdated, refresh, loading, error,
  } = useDashboardQueues(BRAND.defaultCommitteeCode, dashboardFilters);

  const { refresh: refreshOverdue } = useDashboardOverdue(
    BRAND.defaultCommitteeCode,
    dashboardFilters
  );

  const handleRefresh = () => { refresh(); refreshOverdue(); };

  // ── Announcements ──────────────────────────────────────
  const announcements = [
    { id: "policy-jan", tone: "info", title: "Policy reminder",
      message: "Contract coverage starts January 1. Submissions dated earlier will not count toward the reporting period." },
  ];
  const visibleAnnouncements = announcements.filter((a) => !dismissedAnnouncements.includes(a.id));

  // ── Owner filter helpers ───────────────────────────────
  const matchesOwnerFilter = useCallback(
    (item: DecoratedQueueItem) =>
      overdueOwnerFilter === "all" || resolveOwnerRoleKey(item) === overdueOwnerFilter,
    [overdueOwnerFilter]
  );

  // ── Derived data ───────────────────────────────────────
  const baseItems = useMemo(() => {
    switch (queueFilter) {
      case "classification": return classificationQueue;
      case "review": return reviewQueue;
      case "revision": return revisionQueue;
      case "due-soon": return allItems.filter((i) => isDueSoon(i, DUE_SOON_THRESHOLD)).filter(matchesOwnerFilter);
      case "overdue": return allItems.filter(isOverdue).filter(matchesOwnerFilter);
      case "blocked": return allItems.filter(isBlocked);
      case "unassigned": return allItems.filter(isUnassigned);
      default: return allItems;
    }
  }, [queueFilter, classificationQueue, reviewQueue, revisionQueue, allItems, matchesOwnerFilter]);

  const searchedItems = useMemo(() => {
    if (!searchTerm) return baseItems;
    const s = searchTerm.toLowerCase();
    return baseItems.filter((item) =>
      item.projectCode.toLowerCase().includes(s) ||
      item.projectTitle.toLowerCase().includes(s) ||
      item.piName.toLowerCase().includes(s)
    );
  }, [baseItems, searchTerm]);

  const sortedItems = useMemo(
    () => [...searchedItems].sort((a, b) => {
      const d = priorityScore(b, DUE_SOON_THRESHOLD) - priorityScore(a, DUE_SOON_THRESHOLD);
      return d !== 0 ? d : new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime();
    }),
    [searchedItems]
  );

  const totalFiltered = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, totalFiltered);
  const filteredItems = sortedItems.slice(startIdx, endIdx);
  const visibleItemIds = useMemo(() => filteredItems.map((i) => i.id), [filteredItems]);
  const allVisibleSelected = visibleItemIds.length > 0 && visibleItemIds.every((id) => selectedIds.has(id));
  const selectedItems = useMemo(() => {
    const itemMap = new Map<number, DecoratedQueueItem>(
      allItems.map((item) => [item.id, item])
    );
    return Array.from(selectedIds)
      .map((id) => itemMap.get(id))
      .filter((item): item is DecoratedQueueItem => Boolean(item));
  }, [allItems, selectedIds]);

  // ── Selection handlers ─────────────────────────────────
  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleItemIds.forEach((id) => next.delete(id));
      else visibleItemIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      return n;
    });
  };

  const hasActiveFilters = queueFilter !== "all" || Boolean(searchTerm);
  const activeFilters = useMemo(() => {
    const chips: Array<{ id: string; label: string; onClear: () => void }> = [];
    if (queueFilter !== "all") {
      const m: Record<string, string> = {
        classification: "Awaiting classification", review: "Under review", revision: "Awaiting revisions",
        "due-soon": "Due ≤3 days", overdue: "Overdue", blocked: "Blocked", unassigned: "Unassigned",
      };
      chips.push({ id: "queue", label: m[queueFilter] ?? queueFilter, onClear: () => setQueueFilter("all") });
    }
    if (searchTerm) chips.push({ id: "search", label: `Search: ${searchTerm}`, onClear: () => setSearchTerm("") });
    return chips;
  }, [queueFilter, searchTerm]);

  // ── Bulk / export handlers ─────────────────────────────
  const handleExportFiltered = () => exportRowsToCsv(sortedItems, `submissions_export_${Date.now()}.csv`);
  const handleBulkAssign = () => { if (selectedIds.size) setBulkModal("assign"); };
  const handleBulkReminder = () => { if (selectedIds.size) setBulkModal("reminders"); };
  const handleBulkStatusChange = () => { if (selectedIds.size) setBulkModal("status"); };
  const handleBulkDelete = () => { if (selectedIds.size) setBulkModal("delete"); };
  const handleExportSelected = () => {
    const rows = sortedItems.filter((r) => selectedIds.has(r.id));
    exportRowsToCsv(rows, `submissions_selected_${Date.now()}.csv`);
  };
  const handleBulkActionApplied = () => {
    handleRefresh();
    setSelectedIds(new Set());
  };

  // ── Overdue data ───────────────────────────────────────
  const overdueSubmissions = useMemo(() => allItems.filter(isOverdue), [allItems]);
  const dueSoonSubmissions = useMemo(() => allItems.filter((i) => isDueSoon(i, DUE_SOON_THRESHOLD)), [allItems]);

  // ── Search effect ──────────────────────────────────────
  useEffect(() => {
    const q = searchTerm.trim();
    if (q.length < 2) { setSearchResults([]); setSearchOpen(false); setSearchError(null); return; }
    const t = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const data = await searchProjects(q, BRAND.defaultCommitteeCode, 6);
        setSearchResults(data.items ?? []); setSearchOpen(true); setSearchError(null);
      } catch (err) { setSearchError(err instanceof Error ? err.message : "Search failed"); }
      finally { setSearchLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // ── Quick-view effects ─────────────────────────────────
  useEffect(() => {
    if (!quickViewOpen || !quickViewId) { setQuickViewDetail(null); setQuickViewSla(null); setQuickViewError(null); return; }
    let cancelled = false;
    (async () => {
      try {
        setQuickViewLoading(true);
        const detail = await fetchSubmissionDetail(quickViewId);
        if (cancelled) return;
        setQuickViewDetail(detail); setQuickViewError(null);
        try { const sla = await fetchSubmissionSlaSummary(quickViewId); if (!cancelled) setQuickViewSla(sla); }
        catch { if (!cancelled) setQuickViewSla(null); }
      } catch (err) { if (!cancelled) setQuickViewError(err instanceof Error ? err.message : "Failed to load"); }
      finally { if (!cancelled) setQuickViewLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [quickViewOpen, quickViewId]);

  useEffect(() => {
    if (!quickViewOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setQuickViewOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [quickViewOpen]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchInputRef.current?.focus(); return; }
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) { e.preventDefault(); searchInputRef.current?.focus(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const openQuickView = (item: { id: number; projectCode: string; projectTitle: string; piName: string; staffInChargeName?: string | null }) => {
    setQuickViewId(item.id);
    setQuickViewSummary({ projectCode: item.projectCode, projectTitle: item.projectTitle, piName: item.piName, staffInChargeName: item.staffInChargeName ?? null });
    setQuickViewOpen(true);
  };

  // ── Render ─────────────────────────────────────────────
  return (
    <div className={`dashboard-content portal-page portal-page--dense ${fromLogin ? "dashboard-enter" : ""} ${loading ? "is-loading" : "is-ready"}`}>
      <section className="portal-context">
        <DashboardTopBar
          greeting={greeting}
          lastUpdated={lastUpdated}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          searchResults={searchResults}
          searchOpen={searchOpen}
          searchLoading={searchLoading}
          searchError={searchError}
          searchInputRef={searchInputRef}
          onSearchFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
          onSearchBlur={() => { setTimeout(() => setSearchOpen(false), 150); }}
          onRefresh={handleRefresh}
          onNavigate={(p) => navigate(p)}
        />
      </section>

      {visibleAnnouncements.length > 0 ? (
        <section className="portal-support">
          <AnnouncementBanner
            announcements={visibleAnnouncements}
            onDismiss={(id) => setDismissedAnnouncements((prev) => [...prev, id])}
          />
        </section>
      ) : null}

      {error ? (
        <section className="portal-support">
          <div
            className="panel"
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              padding: "16px 18px",
              borderColor: "rgba(175, 48, 41, 0.18)",
              background: "linear-gradient(135deg, rgba(255, 243, 240, 0.96), rgba(255, 255, 255, 0.98))",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <strong style={{ color: "#8A2E24" }}>Dashboard data is temporarily unavailable</strong>
              <span style={{ color: "#5A5F6B" }}>{error}</span>
            </div>
            <button
              type="button"
              className="topbar-btn"
              onClick={handleRefresh}
              style={{ whiteSpace: "nowrap" }}
            >
              Retry
            </button>
          </div>
        </section>
      ) : null}

      <section className="portal-summary">
        <StatsGrid
          counts={counts}
          attention={attention}
          onFilterChange={(f) => setQueueFilter(f as QueueFilter)}
          tableRef={tableRef}
        />
      </section>

      <section className="portal-content">
        <SubmissionsTable
          loading={loading}
          loadError={error}
          onRetryLoad={handleRefresh}
          filteredItems={filteredItems}
          allItems={allItems}
          classificationQueue={classificationQueue}
          reviewQueue={reviewQueue}
          revisionQueue={revisionQueue}
          overdueSubmissions={overdueSubmissions}
          dueSoonSubmissions={dueSoonSubmissions}
          dueSoonThreshold={DUE_SOON_THRESHOLD}
          queueFilter={queueFilter}
          onQueueFilterChange={setQueueFilter}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          hasActiveFilters={hasActiveFilters}
          activeFilters={activeFilters}
          overdueOwnerFilter={overdueOwnerFilter}
          onOverdueOwnerFilterChange={setOverdueOwnerFilter}
          onDashboardFilterChange={handleDashboardFilterChange}
          selectedIds={selectedIds}
          allVisibleSelected={allVisibleSelected}
          selectedCount={selectedIds.size}
          onToggleSelectAll={toggleSelectAllVisible}
          onToggleSelection={toggleSelection}
          onClearSelection={() => setSelectedIds(new Set())}
          currentPage={currentPage}
          totalPages={totalPages}
          safePage={safePage}
          startIdx={startIdx}
          endIdx={endIdx}
          totalFiltered={totalFiltered}
          onPageChange={setCurrentPage}
          onQuickView={openQuickView}
          onNavigate={(p) => navigate(p)}
          onExportFiltered={handleExportFiltered}
          onExportSelected={handleExportSelected}
          onBulkAssign={handleBulkAssign}
          onBulkReminder={handleBulkReminder}
          onBulkStatusChange={handleBulkStatusChange}
          onBulkDelete={handleBulkDelete}
          tableRef={tableRef}
        />
      </section>

      <QuickViewModal
        open={quickViewOpen}
        onClose={() => setQuickViewOpen(false)}
        summary={quickViewSummary}
        detail={quickViewDetail}
        sla={quickViewSla}
        loading={quickViewLoading}
        error={quickViewError}
        submissionId={quickViewId}
        onNavigate={(p) => navigate(p)}
        onRetry={() => { setQuickViewOpen(false); setTimeout(() => setQuickViewOpen(true), 100); }}
      />

      <AssignReviewersBulkModal
        open={bulkModal === "assign"}
        onClose={() => setBulkModal(null)}
        selectedItems={selectedItems}
        onApplied={handleBulkActionApplied}
      />
      <SendRemindersBulkModal
        open={bulkModal === "reminders"}
        onClose={() => setBulkModal(null)}
        selectedItems={selectedItems}
        onApplied={handleBulkActionApplied}
      />
      <ChangeStatusBulkModal
        open={bulkModal === "status"}
        onClose={() => setBulkModal(null)}
        selectedItems={selectedItems}
        onApplied={handleBulkActionApplied}
      />
      <DeleteProtocolsBulkModal
        open={bulkModal === "delete"}
        onClose={() => setBulkModal(null)}
        selectedItems={selectedItems}
        onApplied={handleBulkActionApplied}
      />
    </div>
  );
};
