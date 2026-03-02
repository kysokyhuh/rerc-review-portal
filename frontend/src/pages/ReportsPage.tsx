import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Breadcrumbs } from "@/components";
import {
  AnalyticsCharts,
  ReportFiltersBar,
  ReportSection,
  ProponentComparativeTables,
  ReportSummaryCards,
  ReportViewSwitch,
  SubmissionRecordsTable,
  type ReportView,
  type ReportsDraftFilters,
} from "@/components/reports";
import {
  fetchAnnualReportSubmissions,
  fetchAnnualReportSummary,
  fetchCommittees,
  fetchReportAcademicYears,
  type AnnualReportSubmissionsResponse,
  type AnnualReportSummaryResponse,
  type CommitteeSummary,
  type ReportsAcademicYearOption,
} from "@/services/api";
import "../styles/reports.css";

const parseTerm = (value: string | null): "ALL" | 1 | 2 | 3 => {
  if (!value || value.toUpperCase() === "ALL") return "ALL";
  const parsed = Number(value);
  return parsed === 1 || parsed === 2 || parsed === 3 ? parsed : "ALL";
};

const parseView = (value: string | null): ReportView =>
  value === "analytics" || value === "records" ? value : "summary";

const toSearchParams = (
  view: ReportView,
  filters: ReportsDraftFilters,
  extra?: Record<string, string>
) => {
  const next = new URLSearchParams();
  next.set("view", view);
  next.set("ay", filters.ay);
  next.set("term", String(filters.term));
  next.set("committee", filters.committee);
  next.set("category", filters.category);
  if (filters.reviewType !== "ALL") next.set("reviewType", filters.reviewType);
  if (filters.q.trim()) next.set("q", filters.q.trim());
  if (extra) {
    Object.entries(extra).forEach(([key, value]) => next.set(key, value));
  }
  return next;
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [years, setYears] = useState<ReportsAcademicYearOption[]>([]);
  const [committees, setCommittees] = useState<CommitteeSummary[]>([]);
  const [summary, setSummary] = useState<AnnualReportSummaryResponse | null>(null);
  const [records, setRecords] = useState<AnnualReportSubmissionsResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const defaultAy = years[0]?.academicYear ?? "ALL";
  const defaultCommittee = committees[0]?.code ?? "ALL";

  const appliedView = parseView(searchParams.get("view"));
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20") || 20));
  const sort = searchParams.get("sort") || "receivedDate:desc";

  const appliedFilters = useMemo<ReportsDraftFilters>(
    () => ({
      ay: searchParams.get("ay") || defaultAy,
      term: parseTerm(searchParams.get("term")),
      committee: searchParams.get("committee") || defaultCommittee,
      college: "ALL",
      category:
        (searchParams.get("category") as ReportsDraftFilters["category"]) || "ALL",
      reviewType:
        (searchParams.get("reviewType") as ReportsDraftFilters["reviewType"]) || "ALL",
      status: "ALL",
      q: searchParams.get("q") || "",
    }),
    [searchParams, defaultAy, defaultCommittee]
  );

  const [draftFilters, setDraftFilters] = useState<ReportsDraftFilters>(appliedFilters);

  useEffect(() => {
    setDraftFilters(appliedFilters);
  }, [appliedFilters]);

  useEffect(() => {
    document.title = `URERB Portal — ${
      appliedView === "summary"
        ? "Report Summary"
        : appliedView === "analytics"
        ? "Visual Analytics"
        : "Submission Records"
    }`;
  }, [appliedView]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        setLoadingOptions(true);
        setError(null);
        const [yearsResponse, committeesResponse] = await Promise.all([
          fetchReportAcademicYears(),
          fetchCommittees(),
        ]);
        setYears(yearsResponse.items);
        setCommittees(committeesResponse);
      } catch (e: any) {
        setError(e?.message || "Failed to load report filter options.");
      } finally {
        setLoadingOptions(false);
      }
    };
    loadOptions();
  }, []);

  useEffect(() => {
    if (loadingOptions) return;
    if (!searchParams.get("ay") || !searchParams.get("committee")) {
      const initialized = {
        ay: defaultAy,
        term: "ALL" as const,
        committee: defaultCommittee,
        college: "ALL",
        category: "ALL" as const,
        reviewType: "ALL" as const,
        status: "ALL",
        q: "",
      };
      setSearchParams(toSearchParams("summary", initialized), { replace: true });
    }
  }, [loadingOptions, searchParams, setSearchParams, defaultAy, defaultCommittee]);

  useEffect(() => {
    if (!appliedFilters.ay || !appliedFilters.committee) return;
    const loadSummary = async () => {
      try {
        setLoadingSummary(true);
        const response = await fetchAnnualReportSummary({
          ay: appliedFilters.ay,
          term: appliedFilters.term as "ALL" | 1 | 2 | 3,
          committee: appliedFilters.committee,
          college: appliedFilters.college,
          category: appliedFilters.category,
          reviewType: appliedFilters.reviewType,
          status: appliedFilters.status,
          q: appliedFilters.q,
        });
        setSummary(response);
      } catch (e: any) {
        setSummary(null);
        setError(e?.response?.data?.message || e?.message || "Failed to load annual summary.");
      } finally {
        setLoadingSummary(false);
      }
    };
    loadSummary();
  }, [appliedFilters]);

  useEffect(() => {
    if (appliedView !== "records") return;
    if (!appliedFilters.ay || !appliedFilters.committee) return;
    const loadRecords = async () => {
      try {
        setLoadingRecords(true);
        const response = await fetchAnnualReportSubmissions({
          ay: appliedFilters.ay,
          term: appliedFilters.term as "ALL" | 1 | 2 | 3,
          committee: appliedFilters.committee,
          college: appliedFilters.college,
          category: appliedFilters.category,
          reviewType: appliedFilters.reviewType,
          status: appliedFilters.status,
          q: appliedFilters.q,
          page,
          pageSize,
          sort,
        });
        setRecords(response);
      } catch (e: any) {
        setRecords(null);
        setError(e?.response?.data?.message || e?.message || "Failed to load submission records.");
      } finally {
        setLoadingRecords(false);
      }
    };
    loadRecords();
  }, [appliedView, appliedFilters, page, pageSize, sort]);

  const availableTermValues = useMemo(() => {
    if (draftFilters.ay === "ALL") return new Set<number>([1, 2, 3]);
    return new Set<number>(
      years.find((item) => item.academicYear === draftFilters.ay)?.terms ?? []
    );
  }, [draftFilters.ay, years]);

  const selectionSummary = useMemo(() => {
    const termLabel = draftFilters.term === "ALL" ? "All Terms" : `Term ${draftFilters.term}`;
    return `AY ${draftFilters.ay} • ${termLabel} • Committee ${draftFilters.committee} • Category ${draftFilters.category}`;
  }, [draftFilters]);

  const onFilterChange = (key: keyof ReportsDraftFilters, value: string | number) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const onApply = () => {
    setSearchParams(toSearchParams(appliedView, draftFilters, { page: "1", pageSize: String(pageSize), sort }));
  };

  const onReset = () => {
    const reset: ReportsDraftFilters = {
      ay: defaultAy,
      term: "ALL",
      committee: defaultCommittee,
      college: "ALL",
      category: "ALL",
      reviewType: "ALL",
      status: "ALL",
      q: "",
    };
    setDraftFilters(reset);
    setSearchParams(toSearchParams(appliedView, reset, { page: "1", pageSize: "20", sort: "receivedDate:desc" }));
  };

  const onViewChange = (view: ReportView) => {
    setSearchParams(toSearchParams(view, appliedFilters, { page: "1", pageSize: String(pageSize), sort }));
  };

  const onDrilldown = (filters: {
    college?: string;
    category?: "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING";
    reviewType?: "EXEMPT" | "EXPEDITED" | "FULL_BOARD";
  }) => {
    const next: ReportsDraftFilters = {
      ...appliedFilters,
      college: filters.college ?? appliedFilters.college,
      category: filters.category ?? appliedFilters.category,
      reviewType: filters.reviewType ?? appliedFilters.reviewType,
    };
    setSearchParams(toSearchParams("records", next, { page: "1", pageSize: String(pageSize), sort }));
  };

  return (
    <div className="reports-page">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reports" }]} />

      <header className="reports-header">
        <div className="reports-header-content">
          <Link to="/dashboard" className="back-link">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Dashboard
          </Link>
          <h1>Annual Reports</h1>
          <p>Spreadsheet-style reporting with summary, analytics, and submission records.</p>
        </div>
      </header>

      <ReportViewSwitch active={appliedView} onChange={onViewChange} />

      <ReportFiltersBar
        years={years}
        committees={committees}
        filters={draftFilters}
        availableTermValues={availableTermValues}
        loading={loadingOptions || loadingSummary || loadingRecords}
        selectionSummary={selectionSummary}
        onChange={onFilterChange}
        onApply={onApply}
        onReset={onReset}
      />

      {error ? <div className="reports-error">{error}</div> : null}

      <div className="reports-sheet">
        {appliedView === "summary" && summary ? (
          <>
          <ReportSummaryCards
            received={summary.summaryCounts.received}
            exempted={summary.summaryCounts.exempted}
            expedited={summary.summaryCounts.expedited}
            fullReview={summary.summaryCounts.fullReview}
            withdrawn={summary.summaryCounts.withdrawn}
            byCategory={summary.summaryCounts.byProponentCategory}
          />

          <ReportSection
            title="Comparative Tables by Proponent Category"
            subtitle="Sheet-style layout by proponent category, grouped by review type and academic year."
          >
            {summary.comparativeByProponent?.length ? (
              <ProponentComparativeTables
                tables={summary.comparativeByProponent}
                selectedAy={appliedFilters.ay}
                selectedCategory={appliedFilters.category}
                selectedReviewType={appliedFilters.reviewType}
              />
            ) : (
              <section className="report-empty">
                Comparative table data is unavailable from the backend response.
              </section>
            )}
          </ReportSection>
          </>
        ) : null}

        {appliedView === "analytics" && summary ? (
          <ReportSection title="Visual Analytics" subtitle="Charts reflect the same active filters.">
            <AnalyticsCharts charts={summary.charts} onDrilldown={onDrilldown} />
          </ReportSection>
        ) : null}

        {appliedView === "records" ? (
          <ReportSection title="Submission Records" subtitle="Underlying records for current filters.">
            <SubmissionRecordsTable
              data={records}
              loading={loadingRecords}
              sort={sort}
              onSort={(nextSort) =>
                setSearchParams(toSearchParams("records", appliedFilters, { page: "1", pageSize: String(pageSize), sort: nextSort }))
              }
              onPageChange={(nextPage) =>
                setSearchParams(
                  toSearchParams("records", appliedFilters, {
                    page: String(Math.max(1, nextPage)),
                    pageSize: String(pageSize),
                    sort,
                  })
                )
              }
              onRowClick={(item) => {
                if (item.submissionId) navigate(`/submissions/${item.submissionId}`);
                else if (item.projectId) navigate(`/projects/${item.projectId}`);
              }}
            />
          </ReportSection>
        ) : null}
      </div>
    </div>
  );
}
