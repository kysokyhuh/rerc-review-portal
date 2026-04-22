import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AnnualReportSubmissionsResponse, AnnualReportSummaryResponse } from "@/types";

type ExportReportsPdfParams = {
  summary: AnnualReportSummaryResponse;
  records: AnnualReportSubmissionsResponse;
  selectionSummary: string;
  generatedAt: Date;
};

const formatDate = (value: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};

const formatValue = (value: number | null) =>
  value === null || Number.isNaN(value) ? "—" : Number.isInteger(value) ? `${value}` : value.toFixed(2);

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const addSectionTitle = (doc: jsPDF, title: string, y: number) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
};

const getTableBottom = (doc: jsPDF) => (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 20;

const addTable = (
  doc: jsPDF,
  head: string[][],
  body: Array<Array<string | number>>,
  startY: number,
  styles?: Record<string, unknown>
) => {
  autoTable(doc, {
    head,
    body,
    startY,
    margin: { left: 14, right: 14 },
    styles: {
      fontSize: 8,
      cellPadding: 2.4,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [47, 122, 84],
    },
    alternateRowStyles: {
      fillColor: [246, 250, 247],
    },
    ...styles,
  });
};

export async function exportReportsPdf({
  summary,
  records,
  selectionSummary,
  generatedAt,
}: ExportReportsPdfParams) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const filename = `annual-reports-${generatedAt.toISOString().slice(0, 10)}.pdf`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Annual Reports Export", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Generated ${generatedAt.toLocaleString("en-US")}`, 14, 23);
  doc.text(selectionSummary, 14, 29, { maxWidth: 260 });
  doc.text(
    `Reporting window ${formatDate(summary.selection.dateRange.startDate)} to ${formatDate(summary.selection.dateRange.endDate)}`,
    14,
    35
  );

  addSectionTitle(doc, "Summary", 44);
  addTable(
    doc,
    [["Metric", "Count"]],
    [
      ["Received", summary.summaryCounts.received],
      ["Exempted", summary.summaryCounts.exempted],
      ["Expedited", summary.summaryCounts.expedited],
      ["Full Review", summary.summaryCounts.fullReview],
      ["Withdrawn", summary.summaryCounts.withdrawn],
    ],
    47,
    { tableWidth: 90 }
  );

  addTable(
    doc,
    [["Average", "Working days"]],
    [
      ...summary.performanceCharts.averages.daysToResults.map((item) => [`${item.label} to notification`, formatValue(item.value)]),
      ...summary.performanceCharts.averages.daysToClearance.map((item) => [`${item.label} to clearance`, formatValue(item.value)]),
      ["Resubmission", formatValue(summary.performanceCharts.averages.daysToResubmit)],
    ],
    47,
    { margin: { left: 112, right: 14 }, tableWidth: 80 }
  );

  addTable(
    doc,
    [["Group", "Received", "Exempted", "Expedited", "Full Review", "Withdrawn"]],
    [
      ...summary.overviewTable.rows.map((row) => [
        row.label,
        row.received,
        row.exempted,
        row.expedited,
        row.fullReview,
        row.withdrawn,
      ]),
      [
        "TOTAL",
        summary.overviewTable.totals.received,
        summary.overviewTable.totals.exempted,
        summary.overviewTable.totals.expedited,
        summary.overviewTable.totals.fullReview,
        summary.overviewTable.totals.withdrawn,
      ],
    ],
    Math.max(getTableBottom(doc) + 8, 80)
  );

  doc.addPage();
  addSectionTitle(doc, "Classification Matrix", 16);
  addTable(
    doc,
    [["Category", "Exempted", "Expedited", "Full Review", "Withdrawn", "Total"]],
    [
      ["Undergraduate", ...Object.values(summary.classificationMatrix.UNDERGRAD)],
      ["Graduate", ...Object.values(summary.classificationMatrix.GRAD)],
      ["Faculty", ...Object.values(summary.classificationMatrix.FACULTY)],
      ["Non-teaching / Staff", ...Object.values(summary.classificationMatrix.NON_TEACHING)],
      ["TOTAL", ...Object.values(summary.classificationMatrix.TOTAL)],
    ],
    20
  );

  addSectionTitle(doc, "Analytics", getTableBottom(doc) + 10);
  addTable(
    doc,
    [["Month", "Received", "Withdrawn"]],
    summary.charts.receivedByMonth.map((item, index) => [
      item.label,
      item.count,
      summary.charts.withdrawnByMonth[index]?.count ?? 0,
    ]),
    getTableBottom(doc) + 13,
    { tableWidth: 70 }
  );
  addTable(
    doc,
    [["Review path", "Count"]],
    summary.charts.reviewTypeDistribution.map((item) => [item.label, item.count]),
    getTableBottom(doc) + 13,
    { margin: { left: 95, right: 14 }, tableWidth: 55 }
  );
  addTable(
    doc,
    [["Committee", "Count"]],
    summary.charts.committeeDistribution.map((item) => [item.label, item.count]),
    getTableBottom(doc) + 13,
    { margin: { left: 160, right: 14 }, tableWidth: 55 }
  );

  addTable(
    doc,
    [["College", "Received", "Exempted", "Expedited", "Full Review", "Withdrawn", "Unclassified"]],
    summary.charts.outcomeByCollege.map((item) => [
      item.label,
      item.total,
      item.exempted,
      item.expedited,
      item.fullReview,
      item.withdrawn,
      item.unclassified,
    ]),
    getTableBottom(doc) + 10
  );

  doc.addPage();
  addSectionTitle(doc, "Comparative Breakdown", 16);
  let currentY = 20;
  for (const table of summary.comparativeByProponent) {
    const years = table.years;
    const head = [[
      "College",
      ...years.flatMap((year) => [
        `${year} Exempted`,
        `${year} Expedited`,
        `${year} Full Review`,
        `${year} Withdrawn`,
      ]),
    ]];
    const body = [
      ...table.rows.map((row) => [
        row.college,
        ...years.flatMap((year) => [
          row.exempted[year] ?? 0,
          row.expedited[year] ?? 0,
          row.fullReview[year] ?? 0,
          row.withdrawn[year] ?? 0,
        ]),
      ]),
      [
        "TOTAL",
        ...years.flatMap((year) => [
          table.totals.exempted[year] ?? 0,
          table.totals.expedited[year] ?? 0,
          table.totals.fullReview[year] ?? 0,
          table.totals.withdrawn[year] ?? 0,
        ]),
      ],
    ];

    addSectionTitle(doc, formatLabel(table.category), currentY);
    addTable(doc, head, body, currentY + 4);
    currentY = getTableBottom(doc) + 10;
    if (currentY > 175 && table !== summary.comparativeByProponent[summary.comparativeByProponent.length - 1]) {
      doc.addPage();
      currentY = 16;
    }
  }

  doc.addPage();
  addSectionTitle(doc, "Submission Records", 16);
  addTable(
    doc,
    [[
      "Project code",
      "Title",
      "Proponent",
      "College",
      "Panel",
      "Department",
      "Review path",
      "Status",
      "Received",
    ]],
    records.items.map((item) => [
      item.projectCode,
      item.title,
      item.proponent,
      item.college,
      item.panel ?? "—",
      item.department,
      formatLabel(item.reviewType),
      formatLabel(item.status),
      formatDate(item.receivedDate),
    ]),
    20
  );

  doc.save(filename);
}
