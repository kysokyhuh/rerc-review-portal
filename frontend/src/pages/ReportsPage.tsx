import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Breadcrumbs } from "@/components";
import {
  AnalyticsCharts,
  ClassificationMatrix,
  OverviewTable,
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
import { getErrorMessage } from "@/utils";
import "../styles/reports.css";

const parseTerm = (value: string | null): "ALL" | 1 | 2 | 3 => {
  if (!value || value.toUpperCase() === "ALL") return "ALL";
  const parsed = Number(value);
  return parsed === 1 || parsed === 2 || parsed === 3 ? parsed : "ALL";
};

const parseView = (value: string | null): ReportView =>
  value === "analytics" || value === "records" ? value : "summary";

const parsePeriodMode = (
  value: string | null
): ReportsDraftFilters["periodMode"] => (value?.toUpperCase() === "CUSTOM" ? "CUSTOM" : "ACADEMIC");

const parseCompareMode = (
  value: string | null
): ReportsDraftFilters["compareMode"] => {
  const normalized = value?.toUpperCase();
  if (normalized === "PRIOR_EQUIVALENT" || normalized === "CUSTOM") return normalized;
  return "NONE";
};

const isDateInputValue = (value: string | null) =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

const toDateInputValue = (value: string | null) =>
  value
    ? (() => {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
      })()
    : "";

const shiftDateInputByYears = (value: string, years: number) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setUTCFullYear(parsed.getUTCFullYear() + years);
  return parsed.toISOString().slice(0, 10);
};

const toSearchParams = (
  view: ReportView,
  filters: ReportsDraftFilters,
  extra?: Record<string, string>
) => {
  const next = new URLSearchParams();
  next.set("view", view);
  next.set("periodMode", filters.periodMode);
  next.set("ay", filters.ay);
  next.set("term", String(filters.term));
  if (filters.startDate) next.set("startDate", filters.startDate);
  if (filters.endDate) next.set("endDate", filters.endDate);
  next.set("committee", filters.committee);
  next.set("category", filters.category);
  if (filters.reviewType !== "ALL") next.set("reviewType", filters.reviewType);
  if (filters.compareMode !== "NONE") next.set("compareMode", filters.compareMode);
  if (filters.compareStartDate) next.set("compareStartDate", filters.compareStartDate);
  if (filters.compareEndDate) next.set("compareEndDate", filters.compareEndDate);
  if (filters.q.trim()) next.set("q", filters.q.trim());
  if (extra) {
    Object.entries(extra).forEach(([key, value]) => next.set(key, value));
  }
  return next;
};

const CATEGORY_LABELS: Record<ReportsDraftFilters["category"], string> = {
  ALL: "All categories",
  UNDERGRAD: "Undergraduate",
  GRAD: "Graduate",
  FACULTY: "Faculty",
  NON_TEACHING: "Non-teaching / Staff",
};

const REVIEW_TYPE_LABELS: Record<ReportsDraftFilters["reviewType"], string> = {
  ALL: "All review paths",
  EXEMPT: "Exempt",
  EXPEDITED: "Expedited",
  FULL_BOARD: "Full review",
  UNCLASSIFIED: "Unclassified",
  WITHDRAWN: "Withdrawn",
};

const formatRangeDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};

const normalizeReportFilters = (filters: ReportsDraftFilters): ReportsDraftFilters => {
  const next = { ...filters };

  if (next.periodMode === "ACADEMIC") {
    next.startDate = "";
    next.endDate = "";
  }

  if (next.compareMode !== "CUSTOM") {
    next.compareStartDate = "";
    next.compareEndDate = "";
  }

  return next;
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [years, setYears] = useState<ReportsAcademicYearOption[]>([]);
  const [committees, setCommittees] = useState<CommitteeSummary[]>([]);
  const [summary, setSummary] = useState<AnnualReportSummaryResponse | null>(null);
  const [comparisonSummary, setComparisonSummary] = useState<AnnualReportSummaryResponse | null>(null);
  const [records, setRecords] = useState<AnnualReportSubmissionsResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingComparisonSummary, setLoadingComparisonSummary] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const defaultAy = years[0]?.academicYear ?? "ALL";
  const defaultCommittee = committees[0]?.code ?? "ALL";
  const defaultFilters = useMemo<ReportsDraftFilters>(
    () => ({
      periodMode: "ACADEMIC",
      ay: defaultAy,
      term: "ALL",
      startDate: "",
      endDate: "",
      committee: defaultCommittee,
      college: "ALL",
      category: "ALL",
      reviewType: "ALL",
      compareMode: "NONE",
      compareStartDate: "",
      compareEndDate: "",
      status: "ALL",
      q: "",
    }),
    [defaultAy, defaultCommittee]
  );

  const appliedView = parseView(searchParams.get("view"));
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20") || 20));
  const sort = searchParams.get("sort") || "receivedDate:desc";

  const appliedFilters = useMemo<ReportsDraftFilters>(
    () => ({
      periodMode: parsePeriodMode(searchParams.get("periodMode")),
      ay: searchParams.get("ay") || defaultAy,
      term: parseTerm(searchParams.get("term")),
      startDate: isDateInputValue(searchParams.get("startDate")) ? searchParams.get("startDate") || "" : "",
      endDate: isDateInputValue(searchParams.get("endDate")) ? searchParams.get("endDate") || "" : "",
      committee: searchParams.get("committee") || defaultCommittee,
      college: "ALL",
      category:
        (searchParams.get("category") as ReportsDraftFilters["category"]) || "ALL",
      reviewType:
        (searchParams.get("reviewType") as ReportsDraftFilters["reviewType"]) || "ALL",
      compareMode: parseCompareMode(searchParams.get("compareMode")),
      compareStartDate: isDateInputValue(searchParams.get("compareStartDate"))
        ? searchParams.get("compareStartDate") || ""
        : "",
      compareEndDate: isDateInputValue(searchParams.get("compareEndDate"))
        ? searchParams.get("compareEndDate") || ""
        : "",
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
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Failed to load report filter options."));
      } finally {
        setLoadingOptions(false);
      }
    };
    loadOptions();
  }, []);

  useEffect(() => {
    if (loadingOptions) return;
    if (!searchParams.get("ay") || !searchParams.get("committee")) {
      const initialized = { ...defaultFilters };
      setSearchParams(toSearchParams("summary", initialized), { replace: true });
    }
  }, [defaultFilters, loadingOptions, searchParams, setSearchParams]);

  useEffect(() => {
    if (!appliedFilters.ay || !appliedFilters.committee) return;
    const loadSummary = async () => {
      try {
        setLoadingSummary(true);
        setComparisonSummary(null);
        setError(null);
        const response = await fetchAnnualReportSummary({
          periodMode: appliedFilters.periodMode,
          ay: appliedFilters.ay,
          term: appliedFilters.term as "ALL" | 1 | 2 | 3,
          startDate: appliedFilters.startDate || undefined,
          endDate: appliedFilters.endDate || undefined,
          committee: appliedFilters.committee,
          college: appliedFilters.college,
          category: appliedFilters.category,
          reviewType: appliedFilters.reviewType,
          status: appliedFilters.status,
          q: appliedFilters.q,
        });
        setSummary(response);
      } catch (e: unknown) {
        setSummary(null);
        setError(getErrorMessage(e, "Failed to load annual summary."));
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
        setError(null);
        const response = await fetchAnnualReportSubmissions({
          periodMode: appliedFilters.periodMode,
          ay: appliedFilters.ay,
          term: appliedFilters.term as "ALL" | 1 | 2 | 3,
          startDate: appliedFilters.startDate || undefined,
          endDate: appliedFilters.endDate || undefined,
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
      } catch (e: unknown) {
        setRecords(null);
        setError(getErrorMessage(e, "Failed to load submission records."));
      } finally {
        setLoadingRecords(false);
      }
    };
    loadRecords();
  }, [appliedView, appliedFilters, page, pageSize, sort]);

  const comparisonRequest = useMemo<Parameters<typeof fetchAnnualReportSummary>[0] | null>(() => {
    if (!summary || loadingSummary || appliedFilters.compareMode === "NONE") return null;

    if (appliedFilters.compareMode === "CUSTOM") {
      if (
        !appliedFilters.compareStartDate ||
        !appliedFilters.compareEndDate ||
        appliedFilters.compareEndDate < appliedFilters.compareStartDate
      ) {
        return null;
      }

      return {
        periodMode: "CUSTOM",
        ay: appliedFilters.ay,
        term: appliedFilters.term as "ALL" | 1 | 2 | 3,
        startDate: appliedFilters.compareStartDate,
        endDate: appliedFilters.compareEndDate,
        committee: appliedFilters.committee,
        college: appliedFilters.college,
        category: appliedFilters.category,
        reviewType: appliedFilters.reviewType,
        status: appliedFilters.status,
        q: appliedFilters.q,
      };
    }

    const primaryStart = toDateInputValue(summary.selection.dateRange.startDate);
    const primaryEnd = toDateInputValue(
      summary.selection.isPartial ? summary.selection.asOfDate : summary.selection.dateRange.endDate
    );

    if (!primaryStart || !primaryEnd) return null;

    return {
      periodMode: "CUSTOM",
      ay: appliedFilters.ay,
      term: appliedFilters.term as "ALL" | 1 | 2 | 3,
      startDate: shiftDateInputByYears(primaryStart, -1),
      endDate: shiftDateInputByYears(primaryEnd, -1),
      committee: appliedFilters.committee,
      college: appliedFilters.college,
      category: appliedFilters.category,
      reviewType: appliedFilters.reviewType,
      status: appliedFilters.status,
      q: appliedFilters.q,
    };
  }, [appliedFilters, loadingSummary, summary]);

  useEffect(() => {
    if (!comparisonRequest) {
      setComparisonSummary(null);
      return;
    }

    const loadComparisonSummary = async () => {
      try {
        setLoadingComparisonSummary(true);
        const response = await fetchAnnualReportSummary(comparisonRequest);
        setComparisonSummary(response);
      } catch {
        setComparisonSummary(null);
      } finally {
        setLoadingComparisonSummary(false);
      }
    };

    loadComparisonSummary();
  }, [comparisonRequest]);

  const availableTermValues = useMemo(() => {
    if (draftFilters.ay === "ALL") return new Set<number>([1, 2, 3]);
    return new Set<number>(
      years.find((item) => item.academicYear === draftFilters.ay)?.terms ?? []
    );
  }, [draftFilters.ay, years]);

  const committeeLabelMap = useMemo(
    () =>
      new Map(
        committees.map((committee) => [committee.code, committee.name] as const)
      ),
    [committees]
  );

  const selectionSummary = useMemo(() => {
    const scopeBits = [
      appliedFilters.periodMode === "CUSTOM"
        ? `Custom range ${
            appliedFilters.startDate ? formatRangeDate(appliedFilters.startDate) : "—"
          } to ${appliedFilters.endDate ? formatRangeDate(appliedFilters.endDate) : "—"}`
        : appliedFilters.ay === "ALL"
        ? "All academic years"
        : `Academic year ${appliedFilters.ay}`,
      appliedFilters.periodMode === "ACADEMIC"
        ? appliedFilters.term === "ALL"
          ? "All terms"
          : `Term ${appliedFilters.term}`
        : "Date-based view",
      appliedFilters.committee === "ALL"
        ? "All committees"
        : `Committee ${committeeLabelMap.get(appliedFilters.committee) ?? appliedFilters.committee}`,
      CATEGORY_LABELS[appliedFilters.category],
      REVIEW_TYPE_LABELS[appliedFilters.reviewType],
    ];

    if (appliedFilters.q.trim()) {
      scopeBits.push(`Search “${appliedFilters.q.trim()}”`);
    }

    return scopeBits.join(" · ");
  }, [appliedFilters, committeeLabelMap]);

  const reportingWindow = useMemo(() => {
    if (!summary?.selection.dateRange.startDate || !summary.selection.dateRange.endDate) return null;
    return `Reporting window ${formatRangeDate(summary.selection.dateRange.startDate)} to ${formatRangeDate(
      summary.selection.dateRange.endDate
    )}`;
  }, [summary]);

  const partialDataLabel = useMemo(() => {
    if (!summary) return null;
    if (!summary.selection.isPartial) return "Closed reporting period";
    return `Partial data through ${formatRangeDate(summary.selection.asOfDate)}`;
  }, [summary]);

  const comparisonLabel = useMemo(() => {
    if (!comparisonSummary) return null;
    if (appliedFilters.compareMode === "CUSTOM") {
      return `${formatRangeDate(comparisonSummary.selection.dateRange.startDate)} to ${formatRangeDate(
        comparisonSummary.selection.dateRange.endDate
      )}`;
    }
    if (summary?.selection.isPartial) {
      return `aligned prior period through ${formatRangeDate(comparisonSummary.selection.dateRange.endDate)}`;
    }
    return `${formatRangeDate(comparisonSummary.selection.dateRange.startDate)} to ${formatRangeDate(
      comparisonSummary.selection.dateRange.endDate
    )}`;
  }, [appliedFilters.compareMode, comparisonSummary, summary]);

  const overviewInsight = useMemo(() => {
    if (!summary) return null;
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
      {
        label: "Non-teaching / Staff",
        value: summary.summaryCounts.byProponentCategory.NON_TEACHING,
      },
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
  }, [summary]);

  const onFilterChange = (key: keyof ReportsDraftFilters, value: string | number) => {
    setDraftFilters((prev) => {
      const next = { ...prev, [key]: value } as ReportsDraftFilters;

      if (key === "periodMode" && value === "ACADEMIC") {
        next.startDate = "";
        next.endDate = "";
      }

      if (key === "compareMode" && value !== "CUSTOM") {
        next.compareStartDate = "";
        next.compareEndDate = "";
      }

      return next;
    });
  };

  const onApply = (nextFilters?: ReportsDraftFilters) => {
    const filtersToApply = normalizeReportFilters(nextFilters ?? draftFilters);
    setDraftFilters(filtersToApply);
    setSearchParams(
      toSearchParams(appliedView, filtersToApply, {
        page: "1",
        pageSize: String(pageSize),
        sort,
      })
    );
  };

  const onReset = () => {
    const reset: ReportsDraftFilters = normalizeReportFilters({ ...defaultFilters });
    setDraftFilters(reset);
    setSearchParams(
      toSearchParams(appliedView, reset, {
        page: "1",
        pageSize: "20",
        sort: "receivedDate:desc",
      })
    );
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
    <div className="reports-page portal-page portal-page--dense">
      <section className="portal-context">
        <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reports" }]} />

        <header className="reports-header portal-section">
          <div className="reports-header-content portal-context-inline">
            <div className="portal-context-copy">
              <Link to="/dashboard" className="back-link">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back to Dashboard
              </Link>
              <h1>Annual Reports</h1>
              <p>Move from overview to evidence without losing context or opening a crowded reporting sheet.</p>
              <div className="reports-scope-copy">
                <span>{selectionSummary}</span>
                {reportingWindow ? <span>{reportingWindow}</span> : null}
                {partialDataLabel ? <span>{partialDataLabel}</span> : null}
              </div>
            </div>
          </div>
        </header>
      </section>

      <section className="portal-controls portal-section reports-controls-panel">
        <div className="reports-controls-head">
          <div>
            <span className="section-kicker">Workspace</span>
            <h2 className="reports-controls-title">Choose the reporting layer you need.</h2>
          </div>
          <ReportViewSwitch active={appliedView} onChange={onViewChange} />
        </div>

        <ReportFiltersBar
          years={years}
          committees={committees}
          filters={draftFilters}
          defaults={defaultFilters}
          availableTermValues={availableTermValues}
          loading={loadingOptions || loadingSummary || loadingComparisonSummary || loadingRecords}
          selectionSummary={selectionSummary}
          onChange={onFilterChange}
          onApply={onApply}
          onReset={onReset}
        />
      </section>

      {error ? <div className="reports-error portal-support">{error}</div> : null}

      {loadingSummary && !summary ? (
        <section className="portal-summary">
          <div className="report-loading">Preparing report overview…</div>
        </section>
      ) : null}

      {summary ? (
        <section className="portal-summary reports-overview-band">
          <article className="reports-overview-callout">
            <span className="section-kicker">Overview</span>
            <h2>{overviewInsight?.title ?? "Current reporting overview"}</h2>
            <p>{overviewInsight?.body ?? "Summary metrics will appear here once the report loads."}</p>
            {partialDataLabel ? (
              <div className={`reports-data-status ${summary.selection.isPartial ? "is-partial" : "is-closed"}`}>
                {partialDataLabel}
              </div>
            ) : null}
            {comparisonLabel ? (
              <div className="reports-compare-note">
                Comparing against <strong>{comparisonLabel}</strong>
              </div>
            ) : null}
            <div className="reports-overview-meta">
              <span>{selectionSummary}</span>
              {reportingWindow ? <span>{reportingWindow}</span> : null}
            </div>
          </article>

          <ReportSummaryCards
            received={summary.summaryCounts.received}
            exempted={summary.summaryCounts.exempted}
            expedited={summary.summaryCounts.expedited}
            fullReview={summary.summaryCounts.fullReview}
            withdrawn={summary.summaryCounts.withdrawn}
            asOfLabel={partialDataLabel}
            comparisonLabel={comparisonLabel}
            comparisonCounts={
              comparisonSummary
                ? {
                    received: comparisonSummary.summaryCounts.received,
                    exempted: comparisonSummary.summaryCounts.exempted,
                    expedited: comparisonSummary.summaryCounts.expedited,
                    fullReview: comparisonSummary.summaryCounts.fullReview,
                    withdrawn: comparisonSummary.summaryCounts.withdrawn,
                  }
                : null
            }
            byCategory={summary.summaryCounts.byProponentCategory}
          />
        </section>
      ) : null}

      <div className="reports-view portal-content">
        {appliedView === "summary" && summary ? (
          <>
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
                onCellClick={onDrilldown}
              />
            </ReportSection>

            <ReportSection
              title="Comparative breakdown"
              subtitle="Expand a category only when you need the detailed year and unit-level counts."
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
          <ReportSection
            title="Focused analytics"
            subtitle="Each section shows only the charts needed for the current question, with toggles for deeper comparison."
          >
            <AnalyticsCharts summary={summary} onDrilldown={onDrilldown} />
          </ReportSection>
        ) : null}

        {appliedView === "records" ? (
          <ReportSection
            title="Submission records"
            subtitle="The detailed list stays intact, but the table is calmer and easier to scan."
          >
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
