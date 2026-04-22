import type { CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  AnalyticsCharts,
  ClassificationMatrix,
  OverviewTable,
  ProponentComparativeTables,
  ReportSection,
  ReportSummaryCards,
} from "@/components/reports";
import type { AnnualReportSummaryResponse } from "@/types";

type ExportReportsPdfParams = {
  summary: AnnualReportSummaryResponse;
  selectionSummary: string;
  generatedAt: Date;
};

const PAGE_WIDTH = 1240;
const EXPORT_BG = "#f4f7f5";
const CAPTURE_SCALE = 1.15;

const pageStyle: CSSProperties = {
  width: `${PAGE_WIDTH}px`,
  padding: "24px",
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

function ExportHeader({
  summary,
  selectionSummary,
  generatedAt,
  pageLabel,
}: {
  summary: AnnualReportSummaryResponse;
  selectionSummary: string;
  generatedAt: Date;
  pageLabel: string;
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
    <section className="portal-summary reports-overview-band">
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
}: ExportReportsPdfParams) {
  return (
    <div style={{ background: EXPORT_BG }}>
      <div className="reports-page report-export-page" style={pageStyle}>
        <ExportHeader
          summary={summary}
          selectionSummary={selectionSummary}
          generatedAt={generatedAt}
          pageLabel="Summary"
        />
        <OverviewBand summary={summary} />
      </div>

      <div className="reports-page report-export-page" style={pageStyle}>
        <ExportHeader
          summary={summary}
          selectionSummary={selectionSummary}
          generatedAt={generatedAt}
          pageLabel="Summary details"
        />
        <div className="reports-view portal-content">
          <ReportSection
            title="Overview table"
            subtitle="Start with the high-level totals before opening the denser comparative breakdown."
          >
            <OverviewTable
              title="Current report scope"
              rows={summary.overviewTable.rows}
              totals={summary.overviewTable.totals}
            />
          </ReportSection>

          <ReportSection
            title="Review mix by proponent category"
            subtitle="Use this matrix to spot which category is driving each review path."
          >
            <ClassificationMatrix
              rows={[
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
              ]}
              total={summary.classificationMatrix.TOTAL}
              onCellClick={() => {}}
            />
          </ReportSection>
        </div>
      </div>

      <div className="reports-page report-export-page" style={pageStyle}>
        <ExportHeader
          summary={summary}
          selectionSummary={selectionSummary}
          generatedAt={generatedAt}
          pageLabel="Comparative breakdown"
        />
        <div className="reports-view portal-content">
          <ReportSection
            title="Comparative breakdown"
            subtitle="Detailed comparative tables by proponent category."
          >
            <ProponentComparativeTables
              tables={summary.comparativeByProponent}
              selectedAy={summary.selection.ay}
              selectedCategory={summary.selection.category}
              selectedReviewType={summary.selection.reviewType}
            />
          </ReportSection>
        </div>
      </div>

      <div className="reports-page report-export-page" style={pageStyle}>
        <ExportHeader
          summary={summary}
          selectionSummary={selectionSummary}
          generatedAt={generatedAt}
          pageLabel="Analytics"
        />
        <div className="reports-view portal-content">
          <ReportSection
            title="Focused analytics"
            subtitle="Visual analytics exported using the same report components shown in the website."
          >
            <AnalyticsCharts summary={summary} onDrilldown={() => {}} />
          </ReportSection>
        </div>
      </div>
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
      />
    );

    if ("fonts" in document) {
      await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
    }
    await waitForPaint();

    const pages = Array.from(mountNode.querySelectorAll<HTMLElement>(".report-export-page"));
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
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
