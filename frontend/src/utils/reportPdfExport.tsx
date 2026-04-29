import type { CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  ClassificationMatrix,
  OverviewTable,
  ReportSection,
  ReportSummaryCards,
  type AnalyticsGraphType,
} from "@/components/reports";
import type { AnnualReportSubmissionsResponse, AnnualReportSummaryResponse } from "@/types";

export type ReportPdfSection =
  | "executive"
  | "overview"
  | "matrix"
  | "comparative"
  | "analytics"
  | "records";

type ExportReportsPdfParams = {
  summary: AnnualReportSummaryResponse;
  selectionSummary: string;
  generatedAt: Date;
  analyticsGraph: AnalyticsGraphType;
  presetLabel: string;
  sections: ReportPdfSection[];
  records?: AnnualReportSubmissionsResponse | null;
};

export const REPORT_PDF_RECORDS_PER_PAGE = 12;

export type ReportPdfPageKind =
  | "executive"
  | "details"
  | "comparative"
  | "analyticsComposition"
  | "analyticsTrends"
  | "analyticsPerformance"
  | "records";

export function getReportPdfPageKinds(
  sections: ReportPdfSection[],
  recordCount = 0
): ReportPdfPageKind[] {
  const selected = new Set(sections);
  const pageKinds: ReportPdfPageKind[] = [];
  if (selected.has("executive")) pageKinds.push("executive");
  if (selected.has("overview") || selected.has("matrix")) pageKinds.push("details");
  if (selected.has("comparative")) pageKinds.push("comparative");
  if (selected.has("analytics")) {
    pageKinds.push("analyticsComposition", "analyticsTrends", "analyticsPerformance");
  }
  if (selected.has("records")) {
    const recordPages = Math.max(1, Math.ceil(Math.max(recordCount, 1) / REPORT_PDF_RECORDS_PER_PAGE));
    for (let index = 0; index < recordPages; index += 1) pageKinds.push("records");
  }
  return pageKinds.length ? pageKinds : ["executive"];
}

const PAGE_WIDTH = 820;
const EXPORT_BG = "#f4f7f5";
const CAPTURE_SCALE = 1.15;

const pageStyle: CSSProperties = {
  width: `${PAGE_WIDTH}px`,
  minHeight: "1160px",
  padding: "28px",
  background: EXPORT_BG,
  boxSizing: "border-box",
};

const formatDate = (value: string | Date | null) => {
  if (!value) return "—";
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};

const formatDateTime = (value: Date) =>
  value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatGraphLabel = (value: AnalyticsGraphType) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const formatDays = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? `${value} days` : `${value.toFixed(1)} days`;
};

const getMaxCount = (items: Array<{ count: number }>) =>
  items.length ? Math.max(...items.map((item) => item.count), 1) : 1;

const getPercent = (value: number, maxValue: number) => {
  if (value <= 0 || maxValue <= 0) return 0;
  return Math.max(4, Math.round((value / maxValue) * 100));
};

const computeOverviewInsight = (summary: AnnualReportSummaryResponse) => {
  const reviewMix = [
    { label: "Exempt", value: summary.summaryCounts.exempted },
    { label: "Expedited", value: summary.summaryCounts.expedited },
    { label: "Full review", value: summary.summaryCounts.fullReview },
    { label: "Withdrawn", value: summary.summaryCounts.withdrawn },
  ].sort((a, b) => b.value - a.value);
  const categoryMix = [
    { label: "Undergraduate", value: summary.summaryCounts.byProponentCategory.UNDERGRAD },
    { label: "Graduate", value: summary.summaryCounts.byProponentCategory.GRAD },
    { label: "Faculty", value: summary.summaryCounts.byProponentCategory.FACULTY },
    { label: "Non-teaching / Staff", value: summary.summaryCounts.byProponentCategory.NON_TEACHING },
  ].sort((a, b) => b.value - a.value);

  const dominantReview = reviewMix[0];
  const dominantCategory = categoryMix[0];
  const withdrawnNote =
    summary.summaryCounts.withdrawn > 0
      ? `${summary.summaryCounts.withdrawn.toLocaleString("en-US")} withdrawn submissions still sit within the current scope.`
      : "There are no withdrawn submissions in the current scope.";

  return {
    title: `${dominantReview.label} leads the current report mix`,
    body: `${dominantCategory.label} submissions account for the largest share of the filtered report. ${withdrawnNote}`,
  };
};

function SimpleSummaryCards({ summary }: { summary: AnnualReportSummaryResponse }) {
  const cards = [
    { label: "Received", value: summary.summaryCounts.received },
    { label: "Exempt", value: summary.summaryCounts.exempted },
    { label: "Expedited", value: summary.summaryCounts.expedited },
    { label: "Full review", value: summary.summaryCounts.fullReview },
    { label: "Withdrawn", value: summary.summaryCounts.withdrawn },
  ];
  const categories = [
    { label: "Undergraduate", value: summary.summaryCounts.byProponentCategory.UNDERGRAD },
    { label: "Graduate", value: summary.summaryCounts.byProponentCategory.GRAD },
    { label: "Faculty", value: summary.summaryCounts.byProponentCategory.FACULTY },
    { label: "Non-teaching / Staff", value: summary.summaryCounts.byProponentCategory.NON_TEACHING },
  ];

  return (
    <section className="report-export-simple-grid">
      {cards.map((card) => (
        <article key={card.label} className="report-export-simple-card">
          <span>{card.label}</span>
          <strong>{card.value.toLocaleString("en-US")}</strong>
        </article>
      ))}
      {categories.map((category) => (
        <article key={category.label} className="report-export-simple-card muted">
          <span>{category.label}</span>
          <strong>{category.value.toLocaleString("en-US")}</strong>
        </article>
      ))}
    </section>
  );
}

function ExportStatCards({
  items,
}: {
  items: Array<{ label: string; value: number | string; tone?: string }>;
}) {
  return (
    <div className="report-export-stat-grid">
      {items.map((item) => (
        <article key={item.label} className={`report-export-stat-card ${item.tone ?? ""}`}>
          <span>{item.label}</span>
          <strong>{typeof item.value === "number" ? item.value.toLocaleString("en-US") : item.value}</strong>
        </article>
      ))}
    </div>
  );
}

function ExportBarList({
  items,
  maxItems = 8,
}: {
  items: Array<{ label: string; count: number }>;
  maxItems?: number;
}) {
  const visibleItems = items.slice(0, maxItems);
  const maxValue = getMaxCount(visibleItems);

  return (
    <div className="report-export-bar-list">
      {visibleItems.map((item) => (
        <div key={item.label} className="report-export-bar-row">
          <div>
            <span>{item.label}</span>
            <strong>{item.count.toLocaleString("en-US")}</strong>
          </div>
          <i>
            <b style={{ width: `${getPercent(item.count, maxValue)}%` }} />
          </i>
        </div>
      ))}
      {visibleItems.length === 0 ? (
        <p className="report-export-empty">No data available for the selected report scope.</p>
      ) : null}
    </div>
  );
}

function ExportStackedRows({
  items,
}: {
  items: Array<{
    label: string;
    total: number;
    segments: Array<{ label: string; value: number; color: string }>;
  }>;
}) {
  return (
    <div className="report-export-stacked-list">
      {items.map((item) => (
        <article key={item.label} className="report-export-stacked-row">
          <div>
            <strong>{item.label}</strong>
            <span>{item.total.toLocaleString("en-US")} total</span>
          </div>
          <div className="report-export-stacked-track">
            {item.total > 0 ? (
              item.segments.map((segment) => (
                <i
                  key={`${item.label}-${segment.label}`}
                  title={`${segment.label}: ${segment.value}`}
                  style={{
                    width: `${(segment.value / item.total) * 100}%`,
                    background: segment.color,
                  }}
                />
              ))
            ) : (
              <i className="empty" />
            )}
          </div>
          <p>
            {item.segments.map((segment) => (
              <span key={segment.label}>
                {segment.label}: <b>{segment.value.toLocaleString("en-US")}</b>
              </span>
            ))}
          </p>
        </article>
      ))}
      {items.length === 0 ? (
        <p className="report-export-empty">No data available for the selected report scope.</p>
      ) : null}
    </div>
  );
}

function AnalyticsCompositionPage({
  summary,
  selectionSummary,
  generatedAt,
  analyticsGraph,
  presetLabel,
}: Pick<ExportReportsPdfParams, "summary" | "selectionSummary" | "generatedAt" | "analyticsGraph" | "presetLabel">) {
  const { charts } = summary;
  const graphLabel = formatGraphLabel(analyticsGraph);
  const topColleges = [...charts.receivedByCollege].sort((a, b) => b.count - a.count);

  return (
    <div className="reports-page report-export-page" style={pageStyle}>
      <ExportHeader
        summary={summary}
        selectionSummary={selectionSummary}
        generatedAt={generatedAt}
        pageLabel="Analytics: volume and composition"
        presetLabel={presetLabel}
      />
      <div className="reports-view portal-content">
        <ReportSection
          title="Volume and composition"
          subtitle={`Separated analytics page for readable distribution charts. Current graph setting: ${graphLabel}.`}
        >
          <ExportStatCards
            items={charts.proposalsPerTerm.map((item) => ({
              label: item.label,
              value: item.count,
            }))}
          />
          <div className="report-export-analytics-grid">
            <article className="report-export-analytics-card">
              <h4>Proponent category mix</h4>
              <p>Current applicant mix across the selected report scope.</p>
              <ExportBarList items={charts.proponentCategoryDistribution} />
            </article>
            <article className="report-export-analytics-card">
              <h4>Review path distribution</h4>
              <p>How submissions are classified within the current filters.</p>
              <ExportBarList items={charts.reviewTypeDistribution} />
            </article>
            <article className="report-export-analytics-card wide">
              <h4>Top institutions by received submissions</h4>
              <p>Largest colleges or service units in the selected reporting period.</p>
              <ExportBarList items={topColleges} maxItems={6} />
            </article>
          </div>
        </ReportSection>
      </div>
    </div>
  );
}

function AnalyticsTrendsPage({
  summary,
  selectionSummary,
  generatedAt,
  analyticsGraph,
  presetLabel,
}: Pick<ExportReportsPdfParams, "summary" | "selectionSummary" | "generatedAt" | "analyticsGraph" | "presetLabel">) {
  const { charts } = summary;
  const graphLabel = formatGraphLabel(analyticsGraph);
  const comparativeRows = charts.comparativeYearTrend.map((item) => {
    const segments = [
      { label: "Exempted", value: item.exempted, color: "#2f7a54" },
      { label: "Expedited", value: item.expedited, color: "#d18b2f" },
      { label: "Full review", value: item.fullReview, color: "#5577b0" },
      { label: "Withdrawn", value: item.withdrawn, color: "#b76161" },
    ];
    return {
      label: item.label,
      total: segments.reduce((sum, segment) => sum + segment.value, 0),
      segments,
    };
  });

  return (
    <div className="reports-page report-export-page" style={pageStyle}>
      <ExportHeader
        summary={summary}
        selectionSummary={selectionSummary}
        generatedAt={generatedAt}
        pageLabel="Analytics: trends"
        presetLabel={presetLabel}
      />
      <div className="reports-view portal-content">
        <ReportSection
          title="Trend and comparison"
          subtitle={`Separated analytics page for monthly and year comparison views. Current graph setting: ${graphLabel}.`}
        >
          <div className="report-export-analytics-grid">
            <article className="report-export-analytics-card">
              <h4>Received proposals by month</h4>
              <p>Monthly received volume when the selected scope supports monthly grouping.</p>
              <ExportBarList items={charts.receivedByMonth} maxItems={12} />
            </article>
            <article className="report-export-analytics-card">
              <h4>Withdrawn proposals by month</h4>
              <p>Monthly withdrawal volume within the same reporting scope.</p>
              <ExportBarList items={charts.withdrawnByMonth} maxItems={12} />
            </article>
            <article className="report-export-analytics-card wide">
              <h4>Year comparison by review path</h4>
              <p>Review-path mix by year for broader trend reading.</p>
              <ExportStackedRows items={comparativeRows} />
            </article>
          </div>
        </ReportSection>
      </div>
    </div>
  );
}

function AnalyticsPerformancePage({
  summary,
  selectionSummary,
  generatedAt,
  analyticsGraph,
  presetLabel,
}: Pick<ExportReportsPdfParams, "summary" | "selectionSummary" | "generatedAt" | "analyticsGraph" | "presetLabel">) {
  const { performanceCharts } = summary;
  const graphLabel = formatGraphLabel(analyticsGraph);
  const averageCards = [
    ...performanceCharts.averages.daysToResults.map((item) => ({
      label: `${item.label} to results`,
      value: formatDays(item.value),
      tone: "tone-results",
    })),
    ...performanceCharts.averages.daysToClearance.map((item) => ({
      label: `${item.label} to clearance`,
      value: formatDays(item.value),
      tone: "tone-clearance",
    })),
    {
      label: "Average resubmission",
      value: formatDays(performanceCharts.averages.daysToResubmit),
      tone: "tone-revision",
    },
  ];
  const slaRows = performanceCharts.slaCompliance.map((item) => ({
    label: item.label,
    total: item.within + item.overdue,
    segments: [
      { label: "Within SLA", value: item.within, color: "#2f7a54" },
      { label: "Overdue", value: item.overdue, color: "#d9643b" },
    ],
  }));

  return (
    <div className="reports-page report-export-page" style={pageStyle}>
      <ExportHeader
        summary={summary}
        selectionSummary={selectionSummary}
        generatedAt={generatedAt}
        pageLabel="Analytics: performance"
        presetLabel={presetLabel}
      />
      <div className="reports-view portal-content">
        <ReportSection
          title="Performance"
          subtitle={`Separated analytics page for turnaround, Service Level Agreement (SLA), and workflow metrics. Current graph setting: ${graphLabel}.`}
        >
          <ExportStatCards items={averageCards} />
          <div className="report-export-analytics-grid">
            <article className="report-export-analytics-card wide">
              <h4>Service Level Agreement (SLA) compliance by stage</h4>
              <p>Completed and still-open stages measured against the configured committee SLA.</p>
              <ExportStackedRows items={slaRows} />
            </article>
            <article className="report-export-analytics-card wide">
              <h4>Workflow reach</h4>
              <p>How many submissions reached each major workflow milestone.</p>
              <ExportBarList items={performanceCharts.workflowFunnel} />
            </article>
          </div>
        </ReportSection>
      </div>
    </div>
  );
}

function ExportHeader({
  summary,
  selectionSummary,
  generatedAt,
  pageLabel,
  presetLabel,
}: {
  summary: AnnualReportSummaryResponse;
  selectionSummary: string;
  generatedAt: Date;
  pageLabel: string;
  presetLabel: string;
}) {
  const reportingWindow = `Reporting window ${formatDate(summary.selection.dateRange.startDate)} to ${formatDate(
    summary.selection.dateRange.endDate
  )}`;
  const partialLabel = summary.selection.isPartial
    ? `Partial data through ${formatDate(summary.selection.asOfDate)}`
    : "Closed reporting period";

  return (
    <header className="reports-header portal-section">
      <div className="reports-header-content portal-context-inline">
        <div className="portal-context-copy">
          <p className="section-kicker">{pageLabel}</p>
          <h1>Annual Reports</h1>
          <p>Exported visual report view that mirrors the website layout as closely as possible.</p>
          <div className="reports-scope-copy">
            <span>{presetLabel}</span>
            <span>{selectionSummary}</span>
            <span>{reportingWindow}</span>
            <span>{partialLabel}</span>
            <span>Generated {formatDateTime(generatedAt)}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function OverviewBand({
  summary,
}: {
  summary: AnnualReportSummaryResponse;
}) {
  const overviewInsight = computeOverviewInsight(summary);
  const partialDataLabel = summary.selection.isPartial
    ? `Partial data through ${formatDate(summary.selection.asOfDate)}`
    : "Closed reporting period";

  return (
    <section className="portal-summary reports-overview-band report-export-overview-band">
      <article className="reports-overview-callout">
        <span className="section-kicker">Overview</span>
        <h2>{overviewInsight.title}</h2>
        <p>{overviewInsight.body}</p>
        <div className={`reports-data-status ${summary.selection.isPartial ? "is-partial" : "is-closed"}`}>
          {partialDataLabel}
        </div>
        <div className="reports-overview-meta">
          <span>
            Reporting window {formatDate(summary.selection.dateRange.startDate)} to {formatDate(summary.selection.dateRange.endDate)}
          </span>
        </div>
      </article>

      <ReportSummaryCards
        received={summary.summaryCounts.received}
        exempted={summary.summaryCounts.exempted}
        expedited={summary.summaryCounts.expedited}
        fullReview={summary.summaryCounts.fullReview}
        withdrawn={summary.summaryCounts.withdrawn}
        asOfLabel={partialDataLabel}
        comparisonLabel={null}
        comparisonCounts={null}
        byCategory={summary.summaryCounts.byProponentCategory}
      />
    </section>
  );
}

function PdfExportDocument({
  summary,
  selectionSummary,
  generatedAt,
  analyticsGraph,
  presetLabel,
  sections,
  records,
}: ExportReportsPdfParams) {
  const selected = new Set(sections);
  const matrixRows = [
    {
      key: "UNDERGRAD",
      label: "Undergraduate",
      ...summary.classificationMatrix.UNDERGRAD,
    },
    {
      key: "GRAD",
      label: "Graduate",
      ...summary.classificationMatrix.GRAD,
    },
    {
      key: "FACULTY",
      label: "Faculty",
      ...summary.classificationMatrix.FACULTY,
    },
    {
      key: "NON_TEACHING",
      label: "Non-teaching / Staff",
      ...summary.classificationMatrix.NON_TEACHING,
    },
  ];
  const recordItems = records?.items ?? [];
  const recordPages: Array<typeof recordItems> = [];
  for (let index = 0; index < recordItems.length; index += REPORT_PDF_RECORDS_PER_PAGE) {
    recordPages.push(recordItems.slice(index, index + REPORT_PDF_RECORDS_PER_PAGE));
  }

  return (
    <div style={{ background: EXPORT_BG }}>
      {selected.has("executive") ? (
        <div className="reports-page report-export-page" style={pageStyle}>
          <ExportHeader
            summary={summary}
            selectionSummary={selectionSummary}
            generatedAt={generatedAt}
            pageLabel="Executive summary"
            presetLabel={presetLabel}
          />
          <OverviewBand summary={summary} />
        </div>
      ) : null}

      {selected.has("overview") || selected.has("matrix") ? (
        <div className="reports-page report-export-page" style={pageStyle}>
          <ExportHeader
            summary={summary}
            selectionSummary={selectionSummary}
            generatedAt={generatedAt}
            pageLabel="Summary details"
            presetLabel={presetLabel}
          />
          <div className="reports-view portal-content">
            {selected.has("overview") ? (
              <ReportSection
                title="Overview table"
                subtitle="High-level totals for the current report scope."
              >
                <SimpleSummaryCards summary={summary} />
                <OverviewTable
                  title="Current report scope"
                  rows={summary.overviewTable.rows}
                  totals={summary.overviewTable.totals}
                />
              </ReportSection>
            ) : null}

            {selected.has("matrix") ? (
              <ReportSection
                title="Review mix by proponent category"
                subtitle="Matrix of review path counts by proponent category."
              >
                <ClassificationMatrix
                  rows={matrixRows}
                  total={summary.classificationMatrix.TOTAL}
                  onCellClick={() => {}}
                />
              </ReportSection>
            ) : null}
          </div>
        </div>
      ) : null}

      {selected.has("comparative") ? (
        <div className="reports-page report-export-page" style={pageStyle}>
          <ExportHeader
            summary={summary}
            selectionSummary={selectionSummary}
            generatedAt={generatedAt}
            pageLabel="Comparative breakdown"
            presetLabel={presetLabel}
          />
          <div className="reports-view portal-content">
            <ReportSection
              title="Comparative breakdown summary"
              subtitle="Category totals are shown here. Use the website for expanded row-level comparative tables."
            >
              <div className="report-export-comparative-grid">
                {summary.comparativeByProponent.map((table) => {
                  const totals = [
                    {
                      label: "Exempted",
                      value: Object.values(table.totals.exempted).reduce((sum, value) => sum + value, 0),
                    },
                    {
                      label: "Expedited",
                      value: Object.values(table.totals.expedited).reduce((sum, value) => sum + value, 0),
                    },
                    {
                      label: "Full review",
                      value: Object.values(table.totals.fullReview).reduce((sum, value) => sum + value, 0),
                    },
                    {
                      label: "Withdrawn",
                      value: Object.values(table.totals.withdrawn).reduce((sum, value) => sum + value, 0),
                    },
                  ];
                  const total = totals.reduce((sum, item) => sum + item.value, 0);
                  return (
                    <article key={table.category} className="report-export-comparative-card">
                      <span className="section-kicker">{formatLabel(table.category)}</span>
                      <strong>{total.toLocaleString("en-US")} total submissions</strong>
                      <p>{table.rows.length.toLocaleString("en-US")} units across {table.years.length} year columns</p>
                      <div>
                        {totals.map((item) => (
                          <span key={item.label}>
                            {item.label}: <strong>{item.value.toLocaleString("en-US")}</strong>
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </ReportSection>
          </div>
        </div>
      ) : null}

      {selected.has("analytics") ? (
        <>
          <AnalyticsCompositionPage
            summary={summary}
            selectionSummary={selectionSummary}
            generatedAt={generatedAt}
            analyticsGraph={analyticsGraph}
            presetLabel={presetLabel}
          />
          <AnalyticsTrendsPage
            summary={summary}
            selectionSummary={selectionSummary}
            generatedAt={generatedAt}
            analyticsGraph={analyticsGraph}
            presetLabel={presetLabel}
          />
          <AnalyticsPerformancePage
            summary={summary}
            selectionSummary={selectionSummary}
            generatedAt={generatedAt}
            analyticsGraph={analyticsGraph}
            presetLabel={presetLabel}
          />
        </>
      ) : null}

      {selected.has("records") && records ? (
        recordPages.map((items, index) => (
          <div className="reports-page report-export-page" style={pageStyle} key={`records-${index}`}>
            <ExportHeader
              summary={summary}
              selectionSummary={selectionSummary}
              generatedAt={generatedAt}
              pageLabel={`Records appendix ${index + 1} of ${recordPages.length}`}
              presetLabel={presetLabel}
            />
            <div className="reports-view portal-content">
              <ReportSection
                title="Submission records"
                subtitle="Compact appendix of matching submissions for the current report filters."
              >
                {records.totalCount > records.items.length ? (
                  <p className="report-export-record-note">
                    Showing first {records.items.length.toLocaleString("en-US")} of{" "}
                    {records.totalCount.toLocaleString("en-US")} matching submissions.
                  </p>
                ) : (
                  <p className="report-export-record-note">
                    Showing all {records.items.length.toLocaleString("en-US")} matching submissions.
                  </p>
                )}
                <table className="report-export-records-table">
                  <thead>
                    <tr>
                      <th>Project code</th>
                      <th>Title</th>
                      <th>Proponent</th>
                      <th>College / Unit</th>
                      <th>Review path</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.submissionId}>
                        <td>{item.projectCode}</td>
                        <td>{item.title}</td>
                        <td>{item.proponent}</td>
                        <td>{item.college}</td>
                        <td>{formatLabel(item.reviewType)}</td>
                        <td>{formatLabel(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ReportSection>
            </div>
          </div>
        ))
      ) : null}
    </div>
  );
}

const waitForPaint = async () => {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

export async function exportReportsPdf({
  summary,
  selectionSummary,
  generatedAt,
  analyticsGraph,
  presetLabel,
  sections,
  records,
}: ExportReportsPdfParams) {
  const mountNode = document.createElement("div");
  mountNode.style.position = "fixed";
  mountNode.style.left = "-20000px";
  mountNode.style.top = "0";
  mountNode.style.width = `${PAGE_WIDTH}px`;
  mountNode.style.background = EXPORT_BG;
  mountNode.style.zIndex = "-1";
  document.body.appendChild(mountNode);

  const root = createRoot(mountNode);

  try {
    root.render(
      <PdfExportDocument
        summary={summary}
        selectionSummary={selectionSummary}
        generatedAt={generatedAt}
        analyticsGraph={analyticsGraph}
        presetLabel={presetLabel}
        sections={sections}
        records={records}
      />
    );

    if ("fonts" in document) {
      await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
    }
    await waitForPaint();

    const pages = Array.from(mountNode.querySelectorAll<HTMLElement>(".report-export-page"));
    if (pages.length === 0) {
      throw new Error("Select at least one section to export.");
    }
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = doc.internal.pageSize.getHeight();
    const margin = 8;
    const maxWidth = pdfWidth - margin * 2;
    const maxHeight = pdfHeight - margin * 2;

    for (const [index, page] of pages.entries()) {
      const canvas = await html2canvas(page, {
        scale: CAPTURE_SCALE,
        useCORS: true,
        backgroundColor: EXPORT_BG,
        windowWidth: PAGE_WIDTH,
        logging: false,
      });

      const imageData = canvas.toDataURL("image/jpeg", 0.82);
      const widthRatio = maxWidth / canvas.width;
      const heightRatio = maxHeight / canvas.height;
      const ratio = Math.min(widthRatio, heightRatio);
      const renderWidth = canvas.width * ratio;
      const renderHeight = canvas.height * ratio;
      const x = (pdfWidth - renderWidth) / 2;
      const y = (pdfHeight - renderHeight) / 2;

      if (index > 0) doc.addPage();
      doc.addImage(imageData, "JPEG", x, y, renderWidth, renderHeight, undefined, "FAST");
    }

    doc.save(`annual-reports-${generatedAt.toISOString().slice(0, 10)}.pdf`);
  } finally {
    root.unmount();
    mountNode.remove();
  }
}
