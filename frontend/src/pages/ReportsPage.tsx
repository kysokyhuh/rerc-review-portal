import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Breadcrumbs } from "@/components";
import {
  fetchAcademicYearSummary,
  fetchCommittees,
  fetchReportAcademicYears,
  type CommitteeSummary,
  type ReportsAcademicYearOption,
  type ReportsSummaryResponse,
} from "@/services/api";
import "../styles/reports.css";

const TERM_OPTIONS: Array<{ label: string; value: "ALL" | number }> = [
  { label: "All Terms", value: "ALL" },
  { label: "Term 1", value: 1 },
  { label: "Term 2", value: 2 },
  { label: "Term 3", value: 3 },
];
const ALL_ACADEMIC_YEARS = "ALL";

const formatNumber = (value: number | null | undefined) =>
  value == null ? "-" : value.toLocaleString("en-US");

const downloadTextFile = (filename: string, text: string) => {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const toCsvCell = (value: string | number | null | undefined) => {
  const raw = String(value ?? "");
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

export default function ReportsPage() {
  const [years, setYears] = useState<ReportsAcademicYearOption[]>([]);
  const [committees, setCommittees] = useState<CommitteeSummary[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<"ALL" | number>("ALL");
  const [selectedCommittee, setSelectedCommittee] = useState("");
  const [selectedCollege, setSelectedCollege] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportsSummaryResponse | null>(null);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [yearsResponse, committeesResponse] = await Promise.all([
          fetchReportAcademicYears(),
          fetchCommittees(),
        ]);
        setYears(yearsResponse.items);
        setCommittees(committeesResponse);
        if (yearsResponse.items.length > 0) {
          setSelectedAcademicYear(yearsResponse.items[0].academicYear);
        }
        if (committeesResponse.length > 0) {
          setSelectedCommittee(committeesResponse[0].code);
        }
      } catch (loadError: any) {
        setError(loadError?.message || "Failed to load report options");
      }
    };

    loadOptions();
  }, []);

  const availableTermValues = useMemo(() => {
    if (selectedAcademicYear === ALL_ACADEMIC_YEARS) {
      return new Set<number>([1, 2, 3]);
    }
    const match = years.find((item) => item.academicYear === selectedAcademicYear);
    if (!match) return new Set<number>();
    return new Set<number>(match.terms);
  }, [years, selectedAcademicYear]);

  const visibleBreakdown = useMemo(() => {
    if (!report) return [];
    if (selectedCollege === "ALL") return report.breakdownByCollegeOrUnit;
    return report.breakdownByCollegeOrUnit.filter(
      (item) => item.collegeOrUnit === selectedCollege
    );
  }, [report, selectedCollege]);

  const classificationTotals = useMemo(() => {
    const base = {
      undergrad: { exempted: 0, expedited: 0, fullReview: 0 },
      grad: { exempted: 0, expedited: 0, fullReview: 0 },
      faculty: { exempted: 0, expedited: 0, fullReview: 0 },
      other: { exempted: 0, expedited: 0, fullReview: 0 },
      unknown: { exempted: 0, expedited: 0, fullReview: 0 },
    };

    for (const item of visibleBreakdown) {
      for (const group of Object.keys(base) as Array<keyof typeof base>) {
        base[group].exempted += item.byProponentTypeAndReviewType[group].exempted;
        base[group].expedited += item.byProponentTypeAndReviewType[group].expedited;
        base[group].fullReview += item.byProponentTypeAndReviewType[group].fullReview;
      }
    }

    return base;
  }, [visibleBreakdown]);

  const withdrawnVisibleCount = useMemo(
    () => visibleBreakdown.reduce((sum, item) => sum + item.withdrawn, 0),
    [visibleBreakdown]
  );

  const handleGenerateReport = async () => {
    if (!selectedAcademicYear) {
      setError("Choose an academic year first");
      return;
    }

    if (selectedTerm !== "ALL" && !availableTermValues.has(selectedTerm)) {
      setError("Selected term is not configured for this academic year");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetchAcademicYearSummary({
        academicYear: selectedAcademicYear,
        term: selectedTerm,
        committeeCode: selectedCommittee || undefined,
      });
      setReport(response);
      setSelectedCollege("ALL");
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!report) return;

    const summaryRows = [
      ["Metric", "Value"],
      ["Academic Year", report.academicYear],
      ["Term", String(report.term)],
      ["Committee", report.committeeCode || "All"],
      ["Date Range Start", report.dateRange.startDate],
      ["Date Range End", report.dateRange.endDate],
      ["Proposals Received", report.totals.received],
      ["Exempted", report.totals.exempted],
      ["Expedited", report.totals.expedited],
      ["Full Review", report.totals.fullReview],
      ["Withdrawn", report.totals.withdrawn],
      ["Avg Days to Results (Expedited)", report.averages.avgDaysToResults.expedited],
      ["Avg Days to Results (Full Review)", report.averages.avgDaysToResults.fullReview],
      ["Avg Days to Resubmit", report.averages.avgDaysToResubmit],
      ["Avg Days to Clearance (Expedited)", report.averages.avgDaysToClearance.expedited],
      ["Avg Days to Clearance (Full Review)", report.averages.avgDaysToClearance.fullReview],
      [],
      [
        "College/Unit",
        "Received",
        "Withdrawn",
        "Exempted",
        "Expedited",
        "Full Review",
        "Undergrad",
        "Grad",
        "Faculty",
        "Other",
        "Unknown",
      ],
      ...visibleBreakdown.map((item) => [
        item.collegeOrUnit,
        item.received,
        item.withdrawn,
        item.exempted,
        item.expedited,
        item.fullReview,
        item.byProponentType.undergrad,
        item.byProponentType.grad,
        item.byProponentType.faculty,
        item.byProponentType.other,
        item.byProponentType.unknown,
      ]),
    ];

    const csv = summaryRows
      .map((row) => row.map((cell) => toCsvCell(cell as any)).join(","))
      .join("\n");

    downloadTextFile(
      `report_${report.academicYear}_term-${report.term}.csv`,
      csv
    );
  };

  const isAllAcademicYears = report?.academicYear === ALL_ACADEMIC_YEARS;

  const overviewRows = useMemo(() => {
    if (!report) return [] as Array<{ label: string; received: number; key: string }>;
    if (isAllAcademicYears && report.academicYearVolume) {
      return report.academicYearVolume.map((row) => ({
        label: row.academicYear,
        received: row.received,
        key: row.academicYear,
      }));
    }
    return report.termVolume.map((row) => ({
      label: `Term ${row.term}`,
      received: row.received,
      key: String(row.term),
    }));
  }, [report, isAllAcademicYears]);

  const chartMax = useMemo(() => {
    if (overviewRows.length === 0) return 1;
    return Math.max(...overviewRows.map((item) => item.received), 1);
  }, [overviewRows]);

  const chartBarMaxHeightPx = 120;

  return (
    <div className="reports-page">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Reports" },
        ]}
      />

      <header className="reports-header">
        <div className="reports-header-content">
          <Link to="/dashboard" className="back-link">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Dashboard
          </Link>
          <h1>Reports</h1>
          <p>Generate term and academic-year statistics for research proposals.</p>
        </div>
        <div className="reports-header-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleDownloadCsv}
            disabled={!report}
          >
            Download CSV
          </button>
        </div>
      </header>

      <section className="reports-filters" aria-label="Report filters">
        <label>
          Academic Year
          <select
            value={selectedAcademicYear}
            onChange={(event) => setSelectedAcademicYear(event.target.value)}
          >
            <option value={ALL_ACADEMIC_YEARS}>All Academic Years</option>
            {years.map((item) => (
              <option key={item.academicYear} value={item.academicYear}>
                {item.academicYear}
              </option>
            ))}
          </select>
        </label>

        <label>
          Term
          <select
            value={String(selectedTerm)}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedTerm(value === "ALL" ? "ALL" : Number(value));
            }}
          >
            {TERM_OPTIONS.map((item) => (
              <option
                key={String(item.value)}
                value={String(item.value)}
                disabled={
                  item.value !== "ALL" && !availableTermValues.has(item.value as number)
                }
              >
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Committee
          <select
            value={selectedCommittee}
            onChange={(event) => setSelectedCommittee(event.target.value)}
          >
            {committees.map((committee) => (
              <option key={committee.id} value={committee.code}>
                {committee.code} - {committee.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          College / Unit
          <select
            value={selectedCollege}
            onChange={(event) => setSelectedCollege(event.target.value)}
            disabled={!report}
          >
            <option value="ALL">All</option>
            {(report?.breakdownByCollegeOrUnit ?? []).map((item) => (
              <option key={item.collegeOrUnit} value={item.collegeOrUnit}>
                {item.collegeOrUnit}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn-primary"
          onClick={handleGenerateReport}
          disabled={loading || !selectedAcademicYear}
        >
          {loading ? "Generating..." : "Generate Report"}
        </button>
      </section>

      {error && <div className="reports-error">{error}</div>}

      {report && (
        <>
          <section className="reports-cards" aria-label="Summary cards">
            <article className="report-card">
              <h2>Proposals Received</h2>
              <strong>{formatNumber(report.totals.received)}</strong>
            </article>
            <article className="report-card">
              <h2>Exempted</h2>
              <strong>{formatNumber(report.totals.exempted)}</strong>
            </article>
            <article className="report-card">
              <h2>Expedited</h2>
              <strong>{formatNumber(report.totals.expedited)}</strong>
            </article>
            <article className="report-card">
              <h2>Full Review</h2>
              <strong>{formatNumber(report.totals.fullReview)}</strong>
            </article>
            <article className="report-card">
              <h2>Withdrawn</h2>
              <strong>{formatNumber(report.totals.withdrawn)}</strong>
            </article>
          </section>

          <section className="reports-section">
            <h3>Overview of Proposals Received</h3>
            <table>
              <thead>
                <tr>
                  <th>{isAllAcademicYears ? "Academic Year" : "Term"}</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {overviewRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td>{formatNumber(row.received)}</td>
                  </tr>
                ))}
                <tr className="totals-row">
                  <td>{isAllAcademicYears ? "All Academic Years Total" : "Academic Year Total"}</td>
                  <td>{formatNumber(report.totals.received)}</td>
                </tr>
              </tbody>
            </table>

            <div
              className="term-chart"
              aria-label={isAllAcademicYears ? "Academic year proposal chart" : "Term proposal chart"}
            >
              {overviewRows.map((row) => (
                <div className="term-bar-group" key={`bar-${row.key}`}>
                  {/*
                    Use px heights instead of percentages so bars scale reliably
                    even when parent layout height is auto.
                  */}
                  <div
                    className="term-bar"
                    style={{
                      height: `${Math.max(
                        6,
                        Math.round((row.received / chartMax) * chartBarMaxHeightPx)
                      )}px`,
                    }}
                    title={`${row.label}: ${row.received}`}
                  />
                  <span>{row.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="reports-section">
            <h3>Classification of Applications</h3>
            <table>
              <thead>
                <tr>
                  <th>Proponent Type</th>
                  <th>Exempted</th>
                  <th>Expedited</th>
                  <th>Full Review</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(classificationTotals).map(([key, value]) => (
                  <tr key={key}>
                    <td>{key}</td>
                    <td>{formatNumber(value.exempted)}</td>
                    <td>{formatNumber(value.expedited)}</td>
                    <td>{formatNumber(value.fullReview)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="reports-section">
            <h3>Withdrawn Applications</h3>
            <table>
              <thead>
                <tr>
                  <th>College / Unit</th>
                  <th>Withdrawn Count</th>
                </tr>
              </thead>
              <tbody>
                {visibleBreakdown.map((item) => (
                  <tr key={`withdrawn-${item.collegeOrUnit}`}>
                    <td>{item.collegeOrUnit}</td>
                    <td>{formatNumber(item.withdrawn)}</td>
                  </tr>
                ))}
                <tr className="totals-row">
                  <td>Total</td>
                  <td>{formatNumber(withdrawnVisibleCount)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="reports-section">
            <h3>Breakdown by College / Unit</h3>
            <table>
              <thead>
                <tr>
                  <th>College / Unit</th>
                  <th>Received</th>
                  <th>Withdrawn</th>
                  <th>Exempted</th>
                  <th>Expedited</th>
                  <th>Full Review</th>
                  <th>Undergrad</th>
                  <th>Grad</th>
                  <th>Faculty</th>
                  <th>Other</th>
                  <th>Unknown</th>
                </tr>
              </thead>
              <tbody>
                {visibleBreakdown.map((item) => (
                  <tr key={`college-${item.collegeOrUnit}`}>
                    <td>{item.collegeOrUnit}</td>
                    <td>{formatNumber(item.received)}</td>
                    <td>{formatNumber(item.withdrawn)}</td>
                    <td>{formatNumber(item.exempted)}</td>
                    <td>{formatNumber(item.expedited)}</td>
                    <td>{formatNumber(item.fullReview)}</td>
                    <td>{formatNumber(item.byProponentType.undergrad)}</td>
                    <td>{formatNumber(item.byProponentType.grad)}</td>
                    <td>{formatNumber(item.byProponentType.faculty)}</td>
                    <td>{formatNumber(item.byProponentType.other)}</td>
                    <td>{formatNumber(item.byProponentType.unknown)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="reports-section">
            <h3>Averages (Working Days)</h3>
            <table>
              <tbody>
                <tr>
                  <th>Submission received to review results (Expedited)</th>
                  <td>{formatNumber(report.averages.avgDaysToResults.expedited)}</td>
                </tr>
                <tr>
                  <th>Submission received to review results (Full Review)</th>
                  <td>{formatNumber(report.averages.avgDaysToResults.fullReview)}</td>
                </tr>
                <tr>
                  <th>Notification to resubmission</th>
                  <td>{formatNumber(report.averages.avgDaysToResubmit)}</td>
                </tr>
                <tr>
                  <th>Submission received to ethics clearance (Expedited)</th>
                  <td>{formatNumber(report.averages.avgDaysToClearance.expedited)}</td>
                </tr>
                <tr>
                  <th>Submission received to ethics clearance (Full Review)</th>
                  <td>{formatNumber(report.averages.avgDaysToClearance.fullReview)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
