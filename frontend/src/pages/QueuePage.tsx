import React, { useEffect, useMemo } from "react";
import { Navigate, useSearchParams, useParams } from "react-router-dom";
import { QueueFilters } from "@/components/queue/QueueFilters";
import { QueueKpiCards } from "@/components/queue/QueueKpiCards";
import { QueueDataTable } from "@/components/queue/QueueDataTable";
import { useDashboardQueues } from "@/hooks/useDashboardQueues";
import { BRAND } from "@/config/branding";
import type { DecoratedQueueItem } from "@/types";

type QueueRouteKey = "classification" | "under-review" | "revisions";

const QUEUE_META: Record<
  QueueRouteKey,
  { title: string; description: string; empty: string }
> = {
  classification: {
    title: "Classification Queue",
    description:
      "Protocols waiting for initial ethics classification. Prioritize overdue entries and assign next action.",
    empty: "No submissions awaiting classification.",
  },
  "under-review": {
    title: "Under Review Queue",
    description:
      "Protocols currently under ethics review. Track due dates and resolve blockers to keep reviews moving.",
    empty: "No submissions currently under review.",
  },
  revisions: {
    title: "Revisions Queue",
    description:
      "Protocols awaiting revisions from proponents. Monitor stalled submissions and follow up on overdue responses.",
    empty: "No submissions awaiting revisions.",
  },
};

const matchesSearch = (item: DecoratedQueueItem, rawSearch: string) => {
  const query = rawSearch.trim().toLowerCase();
  if (!query) return true;
  return `${item.projectCode} ${item.projectTitle} ${item.piName}`
    .toLowerCase()
    .includes(query);
};

export default function QueuePage() {
  const { queueKey } = useParams<{ queueKey: QueueRouteKey }>();
  const [searchParams, setSearchParams] = useSearchParams();

  if (!queueKey || !(queueKey in QUEUE_META)) {
    return <Navigate to="/dashboard" replace />;
  }

  const meta = QUEUE_META[queueKey];
  const search = searchParams.get("search") ?? "";
  const sla = (searchParams.get("sla") ?? "all") as
    | "all"
    | "on-track"
    | "due-soon"
    | "overdue"
    | "blocked";

  const { classificationQueue, reviewQueue, revisionQueue, loading, error } =
    useDashboardQueues(BRAND.defaultCommitteeCode);

  useEffect(() => {
    document.title = `URERB Portal — ${meta.title}`;
  }, [meta.title]);

  const queueItems = useMemo(() => {
    if (queueKey === "classification") return classificationQueue;
    if (queueKey === "under-review") return reviewQueue;
    return revisionQueue;
  }, [queueKey, classificationQueue, reviewQueue, revisionQueue]);

  const filteredItems = useMemo(() => {
    return queueItems.filter((item) => {
      if (!matchesSearch(item, search)) return false;
      if (sla === "all") return true;
      if (sla === "on-track") return item.slaStatus === "ON_TRACK";
      if (sla === "due-soon") return item.slaStatus === "DUE_SOON";
      if (sla === "overdue") return item.slaStatus === "OVERDUE";
      return item.missingFields.length > 0;
    });
  }, [queueItems, search, sla]);

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

  const updateParam = (key: "search" | "sla", value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "all") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="dashboard-content queue-page-content">
        <header className="queue-page-header">
          <h1>{meta.title}</h1>
          <p>{meta.description}</p>
        </header>

        <QueueKpiCards
          total={kpis.total}
          overdue={kpis.overdue}
          dueSoon={kpis.dueSoon}
          blocked={kpis.blocked}
        />

        <QueueFilters
          search={search}
          sla={sla}
          onSearchChange={(value) => updateParam("search", value)}
          onSlaChange={(value) => updateParam("sla", value)}
        />

        <QueueDataTable
          title={`You are viewing: ${meta.title}`}
          items={filteredItems}
          emptyMessage={meta.empty}
          loading={loading}
          error={error}
        />
    </div>
  );
}
