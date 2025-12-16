import React, { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDashboardQueues } from "@/hooks/useDashboardQueues";
import { SummaryCards } from "@/components/SummaryCards";
import { QueueTable } from "@/components/QueueTable";
import { CommandBar } from "@/components/CommandBar";
import { AttentionStrip } from "@/components/AttentionStrip";
import { LetterReadinessPanel } from "@/components/LetterReadinessPanel";
import { DecoratedQueueItem, StageFilter, QueueCounts } from "@/services/api";
import "../styles/globals.css";

function matchesStage(item: DecoratedQueueItem, stage: StageFilter) {
  const status = item.status.toUpperCase();
  switch (stage) {
    case "RECEIVED":
      return status.includes("RECEIVED");
    case "COMPLETENESS":
      return status.includes("COMPLETENESS");
    case "CLASSIFICATION":
      return item.queue === "classification";
    case "UNDER_REVIEW":
      return item.queue === "review" || status.includes("REVIEW");
    case "REVISIONS":
      return item.queue === "revision" || status.includes("REVISION");
    case "DUE_SOON":
      return item.slaStatus === "DUE_SOON";
    case "OVERDUE":
      return item.slaStatus === "OVERDUE";
    case "CLOSED":
      return status === "CLOSED" || status === "WITHDRAWN";
    default:
      return true;
  }
}

function filterItems(
  items: DecoratedQueueItem[],
  stage: StageFilter,
  searchTerm: string
) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  return items.filter((item) => {
    const stageMatch = matchesStage(item, stage);
    const searchMatch = normalizedSearch
      ? `${item.projectCode} ${item.projectTitle} ${item.piName} ${item.submissionType}`
          .toLowerCase()
          .includes(normalizedSearch)
      : true;
    return stageMatch && searchMatch;
  });
}

function buildStageCounts(
  counts: QueueCounts | null,
  allItems: DecoratedQueueItem[]
) {
  return {
    ALL: allItems.length,
    RECEIVED: allItems.filter((i) => i.status === "RECEIVED").length,
    COMPLETENESS: allItems.filter((i) => i.status.includes("COMPLETENESS"))
      .length,
    CLASSIFICATION: allItems.filter((i) => i.queue === "classification").length,
    UNDER_REVIEW: allItems.filter((i) => i.queue === "review").length,
    REVISIONS: allItems.filter((i) => i.queue === "revision").length,
    DUE_SOON: counts?.dueSoon ?? 0,
    OVERDUE: counts?.overdue ?? 0,
    CLOSED: allItems.filter((i) =>
      ["CLOSED", "WITHDRAWN"].includes(i.status.toUpperCase())
    ).length,
  };
}

export const DashboardPage: React.FC = () => {
  const [committeeCode] = useState("RERC-HUMAN");
  const [searchParams, setSearchParams] = useSearchParams();
  const stageFilter =
    (searchParams.get("stage") as StageFilter | null) ?? "ALL";
  const searchTerm = searchParams.get("q") ?? "";
  const savedView = searchParams.get("view") ?? "queue-first";

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
  } = useDashboardQueues(committeeCode);

  const classificationRef = useRef<HTMLDivElement | null>(null);
  const reviewRef = useRef<HTMLDivElement | null>(null);
  const revisionRef = useRef<HTMLDivElement | null>(null);
  const letterRef = useRef<HTMLDivElement | null>(null);

  const setParamState = (nextStage: StageFilter, nextView = savedView) => {
    const params: Record<string, string> = {};
    if (nextStage) params.stage = nextStage;
    if (searchTerm) params.q = searchTerm;
    if (nextView) params.view = nextView;
    setSearchParams(params);
  };

  const handleSearchChange = (value: string) => {
    const params: Record<string, string> = {};
    if (stageFilter) params.stage = stageFilter;
    if (value) params.q = value;
    if (savedView) params.view = savedView;
    setSearchParams(params);
  };

  const handleSavedViewChange = (view: string) => {
    if (view === "overdue") {
      setParamState("OVERDUE", view);
    } else if (view === "due-soon") {
      setParamState("DUE_SOON", view);
    } else if (view === "letters") {
      setParamState("ALL", view);
      letterRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      setParamState(stageFilter, view);
    }
  };

  const filteredClassification = filterItems(
    classificationQueue,
    stageFilter,
    searchTerm
  );
  const filteredReview = filterItems(reviewQueue, stageFilter, searchTerm);
  const filteredRevision = filterItems(revisionQueue, stageFilter, searchTerm);
  const dueSoonQueue = filterItems(
    allItems.filter((item) => item.slaStatus !== "ON_TRACK"),
    stageFilter,
    searchTerm
  );

  const stageCounts = buildStageCounts(counts, allItems);

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

  const handleAttentionSelect = (
    key: "OVERDUE" | "DUE_SOON" | "CLASSIFICATION" | "MISSING_FIELDS"
  ) => {
    if (key === "CLASSIFICATION") {
      setParamState("CLASSIFICATION");
      classificationRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (key === "MISSING_FIELDS") {
      setParamState("ALL", "letters");
      letterRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (key === "OVERDUE") {
      setParamState("OVERDUE");
    } else if (key === "DUE_SOON") {
      setParamState("DUE_SOON");
    }
  };

  // Show loading state
  if (loading && !lastUpdated) {
    return (
      <div className="dashboard-page">
        <div className="loading-state">
          <h1>🔄 Loading Dashboard...</h1>
          <p>Fetching data from backend at localhost:3000</p>
          <p style={{ fontSize: "12px", color: "#666", marginTop: "16px" }}>
            If this takes too long, check that the backend server is running.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="error-state">
          <h1>❌ Error Loading Dashboard</h1>
          <p>{error}</p>
          <p style={{ fontSize: "14px", color: "#666", marginTop: "16px" }}>
            Make sure the backend is running:{" "}
            <code>cd rerc-system && npm run dev</code>
          </p>
          <button
            onClick={refresh}
            style={{
              marginTop: "16px",
              padding: "12px 24px",
              background: "#0b5d3b",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <h1>RA Dashboard – {committeeCode}</h1>
        <p>Queue-first cockpit with DLSU Manila theme</p>
      </header>

      <CommandBar
        committeeCode={committeeCode}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        stageFilter={stageFilter}
        stageCounts={stageCounts}
        onStageChange={(stage) => setParamState(stage)}
        savedView={savedView}
        onSavedViewChange={handleSavedViewChange}
        hasActiveFilter={stageFilter !== "ALL" || Boolean(searchTerm)}
        onClearFilters={() => setSearchParams({})}
        onRefresh={refresh}
        lastUpdated={lastUpdated}
        onExportReport={() => handleLetterExport("ALL")}
      />

      <AttentionStrip metrics={attention} onSelect={handleAttentionSelect} />

      <SummaryCards
        counts={counts}
        onSelect={(key) => {
          if (key === "classification") {
            setParamState("CLASSIFICATION");
            classificationRef.current?.scrollIntoView({ behavior: "smooth" });
          } else if (key === "review") {
            setParamState("UNDER_REVIEW");
            reviewRef.current?.scrollIntoView({ behavior: "smooth" });
          } else if (key === "revision") {
            setParamState("REVISIONS");
            revisionRef.current?.scrollIntoView({ behavior: "smooth" });
          } else if (key === "dueSoon") {
            setParamState("DUE_SOON");
          }
        }}
      />

      <div ref={classificationRef}>
        <QueueTable
          title="Classification queue"
          description="Received submissions awaiting classification; stage chips filter the view."
          items={filteredClassification}
          loading={loading}
          searchTerm={searchTerm}
        />
      </div>

      <div ref={reviewRef}>
        <QueueTable
          title="Review queue"
          description="Submissions currently under review; use bulk actions for exports."
          items={filteredReview}
          loading={loading}
          searchTerm={searchTerm}
        />
      </div>

      <div ref={revisionRef}>
        <QueueTable
          title="Revision queue"
          description="Awaiting revisions from investigators; shows SLA pressure."
          items={filteredRevision}
          loading={loading}
          searchTerm={searchTerm}
        />
      </div>

      <QueueTable
        title="Upcoming due dates"
        description="Due soon or overdue across all queues"
        items={dueSoonQueue}
        loading={loading}
        searchTerm={searchTerm}
      />

      <div ref={letterRef}>
        <LetterReadinessPanel
          readiness={letterReadiness}
          onExportTemplate={(code) => handleLetterExport(code)}
          onViewMissing={(template, fields) =>
            window.alert(
              `Missing fields for ${template}: ${
                fields.length ? fields.join(", ") : "none"
              }`
            )
          }
        />
      </div>
    </div>
  );
};
