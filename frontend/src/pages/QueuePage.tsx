import React, { useEffect, useMemo } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { QueueDataTable } from "@/components/queue/QueueDataTable";
import { QueueFilters } from "@/components/queue/QueueFilters";
import { QueueKpiCards } from "@/components/queue/QueueKpiCards";
import { BRAND } from "@/config/branding";
import { useDashboardQueues } from "@/hooks/useDashboardQueues";
import type { DecoratedQueueItem } from "@/types";

type QueueRouteKey = "classification" | "under-review" | "exempted" | "revisions";

const QUEUE_META: Record<
  QueueRouteKey,
  { title: string; description: string; emptyTitle: string; emptyHint: string }
> = {
  classification: {
    title: "Classification Queue",
    description:
      "Protocols waiting for initial ethics classification. Prioritize overdue entries and assign next action.",
    emptyTitle: "No protocols are awaiting classification.",
    emptyHint:
      "New submissions will appear here after intake. Try widening the queue filters or switch to another classification state.",
  },
  "under-review": {
    title: "Under Review Queue",
    description:
      "Protocols currently under ethics review. Track due dates and resolve blockers to keep reviews moving.",
    emptyTitle: "No protocols are currently under review.",
    emptyHint:
      "This lane is clear for now. Check another review state or widen the filters to review more records.",
  },
  exempted: {
    title: "Exempted Queue",
    description:
      "Protocols classified as exempt. Track final closure actions and documentation.",
    emptyTitle: "No exempted protocols were found.",
    emptyHint:
      "Try adjusting the search terms or SLA filter, or return later when new exempted records are routed here.",
  },
  revisions: {
    title: "Revisions Queue",
    description:
      "Protocols awaiting revisions from proponents. Monitor stalled submissions and follow up on overdue responses.",
    emptyTitle: "No protocols are awaiting revisions.",
    emptyHint:
      "This queue is currently clear. Try another state filter if you expected submissions to appear here.",
  },
};

const matchesSearch = (item: DecoratedQueueItem, rawSearch: string) => {
  const query = rawSearch.trim().toLowerCase();
  if (!query) return true;
  return `${item.projectCode} ${item.projectTitle} ${item.piName}`
    .toLowerCase()
    .includes(query);
};

const formatLabel = (value?: string | null) =>
  (value || "UNKNOWN")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function QueuePage() {
  const { queueKey } = useParams<{ queueKey: QueueRouteKey }>();
  const [searchParams, setSearchParams] = useSearchParams();

  if (!queueKey || !(queueKey in QUEUE_META)) {
    return <Navigate to="/dashboard" replace />;
  }

  const meta = QUEUE_META[queueKey];
  const search = searchParams.get("search") ?? "";
  const segment = searchParams.get("segment") ?? "ALL";
  const effectiveSegment =
    queueKey === "under-review" && !["ALL", "EXPEDITED", "FULL_BOARD"].includes(segment)
      ? "ALL"
      : segment;
  const sla = (searchParams.get("sla") ?? "all") as
    | "all"
    | "on-track"
    | "due-soon"
    | "overdue"
    | "blocked";

  const { classificationQueue, reviewQueue, exemptedQueue, revisionQueue, loading, error } =
    useDashboardQueues(BRAND.defaultCommitteeCode);

  useEffect(() => {
    document.title = `URERB Portal — ${meta.title}`;
  }, [meta.title]);

  const queueItems = useMemo(() => {
    if (queueKey === "classification") return classificationQueue;
    if (queueKey === "under-review") return reviewQueue;
    if (queueKey === "exempted") return exemptedQueue;
    return revisionQueue;
  }, [queueKey, classificationQueue, reviewQueue, exemptedQueue, revisionQueue]);

  const filteredItems = useMemo(() => {
    return queueItems.filter((item: DecoratedQueueItem) => {
      if (!matchesSearch(item, search)) return false;
      if (effectiveSegment !== "ALL") {
        if (queueKey === "classification") {
          if (
            effectiveSegment === "AWAITING_CLASSIFICATION" &&
            item.status !== "AWAITING_CLASSIFICATION"
          ) {
            return false;
          }
          if (
            effectiveSegment === "UNDER_CLASSIFICATION" &&
            item.status !== "UNDER_CLASSIFICATION"
          ) {
            return false;
          }
        }
        if (queueKey === "under-review" && item.reviewType !== effectiveSegment) return false;
      }
      if (sla === "all") return true;
      if (sla === "on-track") return item.slaStatus === "ON_TRACK";
      if (sla === "due-soon") return item.slaStatus === "DUE_SOON";
      if (sla === "overdue") return item.slaStatus === "OVERDUE";
      return item.missingFields.length > 0;
    });
  }, [queueItems, search, sla, queueKey, effectiveSegment]);

  const kpis = useMemo(() => {
    const overdue = queueItems.filter((item) => item.slaStatus === "OVERDUE").length;
    const dueSoon = queueItems.filter((item) => item.slaStatus === "DUE_SOON").length;
    const blocked = queueItems.filter((item) => item.missingFields.length > 0).length;
    return {
      total: queueItems.length,
      overdue,
      dueSoon,
      blocked,
    };
  }, [queueItems]);

  const queueFocus = useMemo(() => {
    if (kpis.overdue > 0) {
      return {
        title: "Resolve overdue protocols",
        description: `${kpis.overdue} item${kpis.overdue === 1 ? "" : "s"} are already past SLA target and should be reviewed first.`,
      };
    }

    if (kpis.blocked > 0) {
      return {
        title: "Clear blockers next",
        description: `${kpis.blocked} submission${kpis.blocked === 1 ? "" : "s"} need missing information or follow-through before the queue can move.`,
      };
    }

    if (kpis.dueSoon > 0) {
      return {
        title: "Watch due-soon work",
        description: `${kpis.dueSoon} record${kpis.dueSoon === 1 ? "" : "s"} are approaching SLA threshold and should stay visible to staff.`,
      };
    }

    if (kpis.total === 0) {
      return {
        title: "Queue is currently clear",
        description: "No protocols are waiting in this lane right now. New records will appear here as work arrives.",
      };
    }

    return {
      title: "Queue is on track",
      description: `${kpis.total} protocol${kpis.total === 1 ? "" : "s"} are active here with no immediate SLA pressure.`,
    };
  }, [kpis]);

  const updateParam = (key: "search" | "sla", value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "all") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  const updateSegment = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "ALL") next.delete("segment");
    else next.set("segment", value);
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const segmentTabs =
    queueKey === "classification"
      ? [
          { value: "ALL", label: "View All", count: queueItems.length },
          {
            value: "AWAITING_CLASSIFICATION",
            label: "Awaiting Classification",
            count: queueItems.filter((item) => item.status === "AWAITING_CLASSIFICATION").length,
          },
          {
            value: "UNDER_CLASSIFICATION",
            label: "Under Classification",
            count: queueItems.filter((item) => item.status === "UNDER_CLASSIFICATION").length,
          },
        ]
      : queueKey === "under-review"
      ? [
          { value: "ALL", label: "View All", count: queueItems.length },
          {
            value: "EXPEDITED",
            label: "Expedited",
            count: queueItems.filter((item) => item.reviewType === "EXPEDITED").length,
          },
          {
            value: "FULL_BOARD",
            label: "Full Review",
            count: queueItems.filter((item) => item.reviewType === "FULL_BOARD").length,
          },
        ]
      : null;

  const activeFilters = useMemo(() => {
    const filters: string[] = [];

    if (search.trim()) {
      filters.push(`Search: ${search.trim()}`);
    }

    if (sla !== "all") {
      filters.push(`SLA: ${formatLabel(sla)}`);
    }

    if (segmentTabs && effectiveSegment !== "ALL") {
      const activeSegment = segmentTabs.find((tab) => tab.value === effectiveSegment);
      if (activeSegment) {
        filters.push(`State: ${activeSegment.label}`);
      }
    }

    return filters;
  }, [effectiveSegment, search, segmentTabs, sla]);

  return (
    <div className="dashboard-content queue-page-content portal-page">
      <header className="queue-page-header portal-context">
        <div className="portal-context-inline">
          <div className="portal-context-copy">
            <span className="queue-page-eyebrow">Queue operations</span>
            <h1>{meta.title}</h1>
            <p>{meta.description}</p>
          </div>
          <span className="ui-info-pill">
            {filteredItems.length === queueItems.length
              ? `${filteredItems.length} visible`
              : `${filteredItems.length} of ${queueItems.length} visible`}
          </span>
        </div>
      </header>

      <section className="portal-summary">
        <QueueKpiCards
          total={kpis.total}
          overdue={kpis.overdue}
          dueSoon={kpis.dueSoon}
          blocked={kpis.blocked}
        />
      </section>

      <section className="panel queue-control-panel portal-controls">
        <div className="panel-body">
          <div className="queue-control-header">
            <div className="queue-control-header-copy">
              <span className="queue-control-eyebrow">Controls</span>
              <h2>Search, filter, and focus the records that need action now.</h2>
            </div>
            <div className="queue-control-summary">
              <span className="queue-control-summary-value">{filteredItems.length}</span>
              <span className="queue-control-summary-label">visible</span>
            </div>
          </div>

          <QueueFilters
            search={search}
            sla={sla}
            onSearchChange={(value) => updateParam("search", value)}
            onSlaChange={(value) => updateParam("sla", value)}
          />

          {segmentTabs ? (
            <div className="queue-segment-block">
              <div className="queue-segment-block-heading">
                <span className="queue-filter-label">Queue State</span>
                <p>Switch between the operational lanes that matter for this queue.</p>
              </div>
              <div className="queue-segments" role="tablist" aria-label="Queue segment tabs">
                {segmentTabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    className={`queue-segment ${effectiveSegment === tab.value ? "active" : ""}`}
                    onClick={() => updateSegment(tab.value)}
                  >
                    <span className="queue-segment-label">{tab.label}</span>
                    <span className="queue-segment-count">{tab.count}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activeFilters.length > 0 ? (
            <div className="queue-active-filters">
              <div className="queue-active-filters-list">
                {activeFilters.map((filter) => (
                  <span key={filter} className="filter-chip">
                    {filter}
                  </span>
                ))}
              </div>
              <button className="ghost-btn" type="button" onClick={clearFilters}>
                Clear all
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="portal-support portal-section compact">
        <div className="portal-results-line">
          <strong>{queueFocus.title}</strong>
          <span className="portal-results-copy">{queueFocus.description}</span>
        </div>
      </section>

      <QueueDataTable
        title="Queue results"
        subtitle="Review active protocols in this lane, monitor SLA pressure, and open any row for the full submission record."
        resultCountLabel={`${filteredItems.length} visible`}
        items={filteredItems}
        emptyMessage={meta.emptyTitle}
        emptyHint={
          activeFilters.length > 0
            ? "No protocols match the active search or SLA filters. Clear the filters to widen the queue."
            : meta.emptyHint
        }
        loading={loading}
        error={error}
        activeFilters={activeFilters}
        onClearFilters={activeFilters.length > 0 ? clearFilters : undefined}
        showHeader
        showReviewType={queueKey === "under-review"}
      />
    </div>
  );
}
