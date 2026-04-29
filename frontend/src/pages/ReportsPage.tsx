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
  ReportPdfExportDialog,
  ReportSummaryCards,
  ReportViewSwitch,
  SubmissionRecordsTable,
  getReportPdfPresetConfig,
  type AnalyticsGraphType,
  type ReportPdfPreset,
  type ReportView,
  type ReportsDraftFilters,
} from "@/components/reports";
import {
  fetchAnnualReportSubmissions,
  fetchAnnualReportSummary,
  fetchCommitteePanels,
  fetchCommittees,
  fetchReportAcademicYears,
  type AnnualReportSubmissionsResponse,
  type AnnualReportSummaryResponse,
  type CommitteeSummary,
  type ReportsAcademicYearOption,
  type ReportsAcademicYearsResponse,
} from "@/services/api";
import { getErrorMessage } from "@/utils";
import {
  REPORT_PDF_RECORDS_PER_PAGE,
  exportReportsPdf,
  getReportPdfPageKinds,
  type ReportPdfSection,
} from "@/utils/reportPdfExport";
import "../styles/reports.css";

const parseTerm = (value: string | null): "ALL" | 1 | 2 | 3 => {
  if (!value || value.toUpperCase() === "ALL") return "ALL";
  const parsed = Number(value);
  return parsed === 1 || parsed === 2 || parsed === 3 ? parsed : "ALL";
};

const parseView = (value: string | null): ReportView =>
  value === "analytics" || value === "records" ? value : "summary";

const parseAnalyticsGraph = (value: string | null): AnalyticsGraphType =>
  value === "line" || value === "donut" ? value : "bar";

const parsePeriodMode = (
  value: string | null
): ReportsDraftFilters["periodMode"] => {
  const normalized = value?.toUpperCase();
  if (normalized === "ACADEMIC") return "ACADEMIC";
  if (normalized === "CUSTOM") return "CUSTOM";
  return "CALENDAR";
};

const parseCompareMode = (
  value: string | null
): ReportsDraftFilters["compareMode"] => {
  const normalized = value?.toUpperCase();
  if (normalized === "PRIOR_EQUIVALENT" || normalized === "CUSTOM") return normalized;
  return "NONE";
};

const parseCompareSource = (
  value: string | null
): ReportsDraftFilters["compareSource"] => (value?.toUpperCase() === "DEMO" ? "DEMO" : "ACTUAL");

const isDateInputValue = (value: string | null) =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

const isYearInputValue = (value: string | null) =>
  !!value && /^\d{4}$/.test(value);

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

const applyMissingAcademicTermsFallback = (
  filters: ReportsDraftFilters,
  fallbackRange: ReportsAcademicYearsResponse["fallbackRange"]
) =>
  normalizeReportFilters({
    ...filters,
    periodMode: "CUSTOM",
    ay: "ALL",
    term: "ALL",
    startDate: fallbackRange ? toDateInputValue(fallbackRange.startDate) : "",
    endDate: fallbackRange ? toDateInputValue(fallbackRange.endDate) : "",
  });

const applyCalendarYearRangeFallback = (
  filters: ReportsDraftFilters,
  calendarYearRange: ReportsAcademicYearsResponse["calendarYearRange"]
) =>
  normalizeReportFilters({
    ...filters,
    periodMode: "CALENDAR",
    startYear: calendarYearRange ? String(calendarYearRange.startYear) : "",
    endYear: calendarYearRange ? String(calendarYearRange.endYear) : "",
  });

const toSearchParams = (
  view: ReportView,
  filters: ReportsDraftFilters,
  analyticsGraph: AnalyticsGraphType,
  extra?: Record<string, string>
) => {
  const next = new URLSearchParams();
  next.set("view", view);
  next.set("analyticsGraph", analyticsGraph);
  next.set("periodMode", filters.periodMode);
  next.set("ay", filters.ay);
  next.set("term", String(filters.term));
  if (filters.startDate) next.set("startDate", filters.startDate);
  if (filters.endDate) next.set("endDate", filters.endDate);
  if (filters.startYear) next.set("startYear", filters.startYear);
  if (filters.endYear) next.set("endYear", filters.endYear);
  next.set("committee", filters.committee);
  next.set("college", filters.college);
  next.set("panel", filters.panel);
  next.set("category", filters.category);
  if (filters.reviewType !== "ALL") next.set("reviewType", filters.reviewType);
  if (filters.compareMode !== "NONE") next.set("compareMode", filters.compareMode);
  if (filters.compareMode !== "NONE" && filters.compareSource !== "ACTUAL") {
    next.set("compareSource", filters.compareSource);
  }
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

const RECORDS_EXPORT_PAGE_SIZE = 100;

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

const buildDemoComparisonCounts = (summary: AnnualReportSummaryResponse) => {
  const current = summary.summaryCounts;
  const fallback = {
    received: 14,
    exempted: 5,
    expedited: 4,
    fullReview: 4,
    withdrawn: 1,
  };

  if (current.received <= 0) {
    return fallback;
  }

  const dateSeed = new Date(summary.selection.dateRange.startDate).getUTCMonth() + 1;
  const variation = (dateSeed % 3) + 1;
  const received = Math.max(1, Math.round(current.received * 0.82) + variation);
  const exempted = Math.max(0, Math.round(current.exempted * 0.74) + (current.exempted > 0 ? 1 : 0));
  const expedited = Math.max(0, Math.round(current.expedited * 0.88) + (variation % 2));
  const fullReview = Math.max(0, Math.round(current.fullReview * 0.7) + 1);
  const withdrawn = Math.max(0, Math.round(current.withdrawn * 0.5));

  return {
    received,
    exempted: Math.min(received, exempted),
    expedited: Math.min(received, expedited),
    fullReview: Math.min(received, fullReview),
    withdrawn,
  };
};

const normalizeReportFilters = (filters: ReportsDraftFilters): ReportsDraftFilters => {
  const next = { ...filters };

  if (next.periodMode === "ACADEMIC") {
    next.startDate = "";
    next.endDate = "";
    next.startYear = "";
    next.endYear = "";
  }

  if (next.periodMode === "CUSTOM") {
    next.startYear = "";
    next.endYear = "";
    next.term = "ALL";
  }

  if (next.periodMode === "CALENDAR") {
    next.startDate = "";
    next.endDate = "";
    next.term = "ALL";
  }

  if (next.compareMode !== "CUSTOM") {
    next.compareStartDate = "";
    next.compareEndDate = "";
  }

  if (next.compareMode === "NONE") {
    next.compareSource = "ACTUAL";
  }

  return next;
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [years, setYears] = useState<ReportsAcademicYearOption[]>([]);
  const [reportYearsMeta, setReportYearsMeta] = useState<ReportsAcademicYearsResponse | null>(null);
  const [committees, setCommittees] = useState<CommitteeSummary[]>([]);
  const [panels, setPanels] = useState<Array<{ value: string; label: string }>>([]);
  const [summary, setSummary] = useState<AnnualReportSummaryResponse | null>(null);
  const [comparisonSummary, setComparisonSummary] = useState<AnnualReportSummaryResponse | null>(null);
  const [records, setRecords] = useState<AnnualReportSubmissionsResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingComparisonSummary, setLoadingComparisonSummary] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [selectedPdfPreset, setSelectedPdfPreset] = useState<ReportPdfPreset>("full");
  const [selectedPdfSections, setSelectedPdfSections] = useState<ReportPdfSection[]>(
    () => getReportPdfPresetConfig("full").sections
  );
  const [error, setError] = useState<string | null>(null);

  const defaultAy = years[0]?.academicYear ?? "ALL";
  const defaultCommittee = committees[0]?.code ?? "ALL";
  const hasAcademicTerms = reportYearsMeta?.hasAcademicTerms ?? years.length > 0;
  const fallbackRange = reportYearsMeta?.fallbackRange ?? null;
  const calendarYearRange = reportYearsMeta?.calendarYearRange ?? null;
  const defaultStartYear = calendarYearRange ? String(calendarYearRange.startYear) : "";
  const defaultEndYear = calendarYearRange ? String(calendarYearRange.endYear) : "";
  const defaultFilters = useMemo<ReportsDraftFilters>(
    () => ({
      periodMode: "CALENDAR",
      ay: defaultAy,
      term: "ALL",
      startDate: "",
      endDate: "",
      startYear: defaultStartYear,
      endYear: defaultEndYear,
      committee: defaultCommittee,
      college: "ALL",
      panel: "ALL",
      category: "ALL",
      reviewType: "ALL",
      compareMode: "NONE",
      compareSource: "ACTUAL",
      compareStartDate: "",
      compareEndDate: "",
      status: "ALL",
      q: "",
    }),
    [defaultAy, defaultCommittee, defaultEndYear, defaultStartYear]
  );

  const appliedView = parseView(searchParams.get("view"));
  const analyticsGraph = parseAnalyticsGraph(searchParams.get("analyticsGraph"));
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
      startYear:
        isYearInputValue(searchParams.get("startYear"))
          ? searchParams.get("startYear") || ""
          : defaultStartYear,
      endYear:
        isYearInputValue(searchParams.get("endYear"))
          ? searchParams.get("endYear") || ""
          : defaultEndYear,
      committee: searchParams.get("committee") || defaultCommittee,
      college: searchParams.get("college") || "ALL",
      panel: searchParams.get("panel") || "ALL",
      category:
        (searchParams.get("category") as ReportsDraftFilters["category"]) || "ALL",
      reviewType:
        (searchParams.get("reviewType") as ReportsDraftFilters["reviewType"]) || "ALL",
      compareMode: parseCompareMode(searchParams.get("compareMode")),
      compareSource: parseCompareSource(searchParams.get("compareSource")),
      compareStartDate: isDateInputValue(searchParams.get("compareStartDate"))
        ? searchParams.get("compareStartDate") || ""
        : "",
      compareEndDate: isDateInputValue(searchParams.get("compareEndDate"))
        ? searchParams.get("compareEndDate") || ""
        : "",
      status: "ALL",
      q: searchParams.get("q") || "",
    }),
    [searchParams, defaultAy, defaultCommittee, defaultEndYear, defaultStartYear]
  );

  const [draftFilters, setDraftFilters] = useState<ReportsDraftFilters>(appliedFilters);
  const requiresCustomRange =
    appliedFilters.periodMode === "CUSTOM" &&
    (!appliedFilters.startDate || !appliedFilters.endDate);
  const requiresCalendarRange =
    appliedFilters.periodMode === "CALENDAR" &&
    !!calendarYearRange &&
    (!appliedFilters.startYear || !appliedFilters.endYear);
  const hasNoCalendarData =
    appliedFilters.periodMode === "CALENDAR" &&
    !calendarYearRange;
  const shouldBlockAcademicMode = !hasAcademicTerms && appliedFilters.periodMode === "ACADEMIC";
  const reportsInfoMessage = useMemo(() => {
    if (hasAcademicTerms || appliedFilters.periodMode !== "ACADEMIC") return null;
    if (appliedFilters.startDate && appliedFilters.endDate) {
      return `Academic terms are not configured yet. Reports are using a custom range from ${formatRangeDate(
        appliedFilters.startDate
      )} to ${formatRangeDate(
        appliedFilters.endDate
      )} so imported records remain visible. Academic-year reporting becomes available once terms are seeded.`;
    }
    return "Academic terms are not configured yet. Switch to Calendar year or Custom date range while term records are being seeded.";
  }, [
    appliedFilters.periodMode,
    appliedFilters.endDate,
    appliedFilters.startDate,
    hasAcademicTerms,
  ]);

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
        setReportYearsMeta(yearsResponse);
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
    if (loadingOptions || committees.length === 0) return;

    const loadPanels = async () => {
      try {
        const committeeCodes =
          draftFilters.committee === "ALL"
            ? committees.map((committee) => committee.code)
            : [draftFilters.committee];
        const panelGroups = await Promise.all(
          committeeCodes.map(async (committeeCode) => ({
            committeeCode,
            panels: await fetchCommitteePanels(committeeCode),
          }))
        );

        const nextPanels = panelGroups
          .flatMap(({ committeeCode, panels: items }) =>
            items.map((panel) => ({
              value: panel.name,
              label:
                draftFilters.committee === "ALL"
                  ? `${committeeCode} · ${panel.name}`
                  : panel.name,
            }))
          )
          .filter(
            (panel, index, all) =>
              all.findIndex((candidate) => candidate.value === panel.value) === index
          )
          .sort((a, b) => a.label.localeCompare(b.label));

        setPanels(nextPanels);
      } catch {
        setPanels([]);
      }
    };

    loadPanels();
  }, [committees, draftFilters.committee, loadingOptions]);

  useEffect(() => {
    if (loadingOptions) return;
    const isMissingPeriodMode = !searchParams.get("periodMode");
    const isMissingAy = !searchParams.get("ay");
    const isMissingCommittee = !searchParams.get("committee");
    const isMissingStartYear =
      appliedFilters.periodMode === "CALENDAR" && !searchParams.get("startYear");
    const isMissingEndYear =
      appliedFilters.periodMode === "CALENDAR" && !searchParams.get("endYear");
    const isMissingAnalyticsGraph = !searchParams.get("analyticsGraph");
    const hasInvalidAnalyticsGraph =
      searchParams.get("analyticsGraph") !== null &&
      searchParams.get("analyticsGraph") !== analyticsGraph;
    const needsInitialization =
      isMissingPeriodMode ||
      isMissingAy ||
      isMissingCommittee ||
      (calendarYearRange !== null && (isMissingStartYear || isMissingEndYear)) ||
      isMissingAnalyticsGraph ||
      hasInvalidAnalyticsGraph;
    const needsMissingTermsFallback = !hasAcademicTerms && appliedFilters.periodMode === "ACADEMIC";
    const needsCalendarFallback =
      appliedFilters.periodMode === "CALENDAR" &&
      calendarYearRange !== null &&
      (!appliedFilters.startYear || !appliedFilters.endYear);

    if (!needsInitialization && !needsMissingTermsFallback && !needsCalendarFallback) {
      return;
    }

    const initializedFilters: ReportsDraftFilters = needsInitialization
      ? {
          ...appliedFilters,
          periodMode: isMissingPeriodMode ? defaultFilters.periodMode : appliedFilters.periodMode,
          ay: isMissingAy ? defaultAy : appliedFilters.ay,
          committee: isMissingCommittee ? defaultCommittee : appliedFilters.committee,
          startYear:
            isMissingStartYear && calendarYearRange
              ? String(calendarYearRange.startYear)
              : appliedFilters.startYear,
          endYear:
            isMissingEndYear && calendarYearRange
              ? String(calendarYearRange.endYear)
              : appliedFilters.endYear,
        }
      : appliedFilters;
    const nextFilters =
      needsMissingTermsFallback || (!hasAcademicTerms && initializedFilters.periodMode === "ACADEMIC")
        ? applyMissingAcademicTermsFallback(initializedFilters, fallbackRange)
        : needsCalendarFallback
        ? applyCalendarYearRangeFallback(initializedFilters, calendarYearRange)
        : normalizeReportFilters(initializedFilters);

    setSearchParams(
      toSearchParams(appliedView, nextFilters, analyticsGraph, {
        page: "1",
        pageSize: String(pageSize),
        sort,
      }),
      { replace: true }
    );
  }, [
    appliedFilters,
    appliedView,
    defaultAy,
    defaultFilters.periodMode,
    defaultCommittee,
    calendarYearRange,
    fallbackRange,
    hasAcademicTerms,
    loadingOptions,
    pageSize,
    searchParams,
    setSearchParams,
    sort,
    analyticsGraph,
  ]);

  useEffect(() => {
    if (loadingOptions) return;
    if (!appliedFilters.ay || !appliedFilters.committee) return;
    if (shouldBlockAcademicMode || requiresCustomRange || requiresCalendarRange || hasNoCalendarData) {
      setSummary(null);
      setComparisonSummary(null);
      setError(null);
      return;
    }
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
          startYear: appliedFilters.startYear || undefined,
          endYear: appliedFilters.endYear || undefined,
          committee: appliedFilters.committee,
          college: appliedFilters.college,
          panel: appliedFilters.panel,
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
  }, [
    appliedFilters,
    hasNoCalendarData,
    loadingOptions,
    requiresCalendarRange,
    requiresCustomRange,
    shouldBlockAcademicMode,
  ]);

  useEffect(() => {
    if (loadingOptions) return;
    if (appliedView !== "records") return;
    if (!appliedFilters.ay || !appliedFilters.committee) return;
    if (shouldBlockAcademicMode || requiresCustomRange || requiresCalendarRange || hasNoCalendarData) {
      setRecords(null);
      setError(null);
      return;
    }
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
          startYear: appliedFilters.startYear || undefined,
          endYear: appliedFilters.endYear || undefined,
          committee: appliedFilters.committee,
          college: appliedFilters.college,
          panel: appliedFilters.panel,
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
  }, [
    appliedView,
    appliedFilters,
    loadingOptions,
    page,
    pageSize,
    hasNoCalendarData,
    requiresCalendarRange,
    requiresCustomRange,
    shouldBlockAcademicMode,
    sort,
  ]);

  const comparisonRequest = useMemo<Parameters<typeof fetchAnnualReportSummary>[0] | null>(() => {
    if (
      !summary ||
      loadingSummary ||
      appliedFilters.compareMode === "NONE" ||
      appliedFilters.compareSource === "DEMO"
    ) {
      return null;
    }

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
        panel: appliedFilters.panel,
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
      panel: appliedFilters.panel,
      category: appliedFilters.category,
      reviewType: appliedFilters.reviewType,
      status: appliedFilters.status,
      q: appliedFilters.q,
    };
  }, [appliedFilters, loadingSummary, summary]);

  const demoComparisonCounts = useMemo(() => {
    if (!summary || appliedFilters.compareMode === "NONE" || appliedFilters.compareSource !== "DEMO") {
      return null;
    }
    return buildDemoComparisonCounts(summary);
  }, [appliedFilters.compareMode, appliedFilters.compareSource, summary]);

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

  const collegeOptions = useMemo(() => {
    const values = new Set<string>();
    summary?.breakdownByCollege.forEach((row) => values.add(row.college));
    records?.items.forEach((item) => values.add(item.college));
    if (draftFilters.college !== "ALL") values.add(draftFilters.college);
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [draftFilters.college, records, summary]);

  const selectionSummary = useMemo(() => {
    const periodSummary =
      appliedFilters.periodMode === "CUSTOM"
        ? `Custom range ${
            appliedFilters.startDate ? formatRangeDate(appliedFilters.startDate) : "—"
          } to ${appliedFilters.endDate ? formatRangeDate(appliedFilters.endDate) : "—"}`
        : appliedFilters.periodMode === "CALENDAR"
        ? appliedFilters.startYear && appliedFilters.endYear
          ? appliedFilters.startYear === appliedFilters.endYear
            ? `Calendar year ${appliedFilters.startYear}`
            : `Calendar years ${appliedFilters.startYear} to ${appliedFilters.endYear}`
          : "Calendar year range"
        : appliedFilters.ay === "ALL"
        ? "All academic years"
        : `Academic year ${appliedFilters.ay}`;

    const scopeBits = [
      periodSummary,
      appliedFilters.periodMode === "ACADEMIC"
        ? appliedFilters.term === "ALL"
          ? "All terms"
          : `Term ${appliedFilters.term}`
        : appliedFilters.periodMode === "CALENDAR"
        ? "Year-based view"
        : "Date-based view",
      appliedFilters.committee === "ALL"
        ? "All committees"
        : `Committee ${committeeLabelMap.get(appliedFilters.committee) ?? appliedFilters.committee}`,
      appliedFilters.college === "ALL"
        ? "All colleges"
        : `College ${appliedFilters.college}`,
      appliedFilters.panel === "ALL"
        ? "All panels"
        : `Panel ${appliedFilters.panel}`,
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
    if (appliedFilters.compareMode !== "NONE" && appliedFilters.compareSource === "DEMO") {
      return appliedFilters.compareMode === "CUSTOM"
        ? "demo preview baseline for the custom comparison"
        : "demo preview baseline";
    }
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
  }, [appliedFilters.compareMode, appliedFilters.compareSource, comparisonSummary, summary]);

  const comparisonCounts = useMemo(() => {
    if (demoComparisonCounts) return demoComparisonCounts;
    if (!comparisonSummary) return null;
    return {
      received: comparisonSummary.summaryCounts.received,
      exempted: comparisonSummary.summaryCounts.exempted,
      expedited: comparisonSummary.summaryCounts.expedited,
      fullReview: comparisonSummary.summaryCounts.fullReview,
      withdrawn: comparisonSummary.summaryCounts.withdrawn,
    };
  }, [comparisonSummary, demoComparisonCounts]);

  const estimatedPdfRecordCount = useMemo(() => {
    if (records) return records.totalCount;
    return summary?.summaryCounts.received ?? 0;
  }, [records, summary]);

  const estimatedPdfPages = useMemo(() => {
    let count = 0;
    const selected = new Set(selectedPdfSections);
    if (selected.has("executive")) count += 1;
    if (selected.has("overview") || selected.has("matrix")) count += 1;
    if (selected.has("comparative")) count += 1;
    if (selected.has("analytics")) count += 1;
    if (selected.has("records")) {
      const boundedRecords = Math.min(Math.max(estimatedPdfRecordCount, 1), RECORDS_EXPORT_PAGE_SIZE);
      count += Math.max(1, Math.ceil(boundedRecords / REPORT_PDF_RECORDS_PER_PAGE));
    }
    return Math.max(1, count);
  }, [estimatedPdfRecordCount, selectedPdfSections]);

  const previewPageKinds = useMemo(
    () =>
      getReportPdfPageKinds(
        selectedPdfSections,
        Math.min(Math.max(estimatedPdfRecordCount, 1), RECORDS_EXPORT_PAGE_SIZE)
      ),
    [estimatedPdfRecordCount, selectedPdfSections]
  );

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

      if (key === "periodMode") {
        if (value === "ACADEMIC") {
          next.startDate = "";
          next.endDate = "";
          next.startYear = "";
          next.endYear = "";
        }
        if (value === "CUSTOM") {
          next.startYear = "";
          next.endYear = "";
          next.term = "ALL";
        }
        if (value === "CALENDAR") {
          next.startDate = "";
          next.endDate = "";
          next.term = "ALL";
          if (calendarYearRange) {
            next.startYear = String(calendarYearRange.startYear);
            next.endYear = String(calendarYearRange.endYear);
          }
        }
      }

      if (key === "committee") {
        next.panel = "ALL";
      }

      if (key === "compareMode" && value !== "CUSTOM") {
        next.compareStartDate = "";
        next.compareEndDate = "";
      }

      if (key === "compareMode" && value === "NONE") {
        next.compareSource = "ACTUAL";
      }

      return next;
    });
  };

  const onApply = (nextFilters?: ReportsDraftFilters) => {
    const filtersToApply = normalizeReportFilters(nextFilters ?? draftFilters);
    setDraftFilters(filtersToApply);
    setSearchParams(
      toSearchParams(appliedView, filtersToApply, analyticsGraph, {
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
      toSearchParams(appliedView, reset, analyticsGraph, {
        page: "1",
        pageSize: "20",
        sort: "receivedDate:desc",
      })
    );
  };

  const onViewChange = (view: ReportView) => {
    setSearchParams(
      toSearchParams(view, appliedFilters, analyticsGraph, {
        page: "1",
        pageSize: String(pageSize),
        sort,
      })
    );
  };

  const onAnalyticsGraphChange = (nextGraph: AnalyticsGraphType) => {
    setSearchParams(
      toSearchParams(appliedView, appliedFilters, nextGraph, {
        page: String(page),
        pageSize: String(pageSize),
        sort,
      })
    );
  };

  const onPdfPresetChange = (preset: ReportPdfPreset) => {
    setSelectedPdfPreset(preset);
    setSelectedPdfSections(getReportPdfPresetConfig(preset).sections);
  };

  const onPdfSectionToggle = (section: ReportPdfSection) => {
    setSelectedPdfPreset("custom");
    setSelectedPdfSections((prev) =>
      prev.includes(section)
        ? prev.filter((item) => item !== section)
        : [...prev, section]
    );
  };

  const onExportPdf = async () => {
    if (!summary || exportingPdf) return;

    try {
      setExportingPdf(true);
      const sections = [...selectedPdfSections];
      let exportRecords: AnnualReportSubmissionsResponse | null = null;

      if (sections.includes("records")) {
        exportRecords = await fetchAnnualReportSubmissions({
          periodMode: appliedFilters.periodMode,
          ay: appliedFilters.ay,
          term: appliedFilters.term as "ALL" | 1 | 2 | 3,
          startDate: appliedFilters.startDate || undefined,
          endDate: appliedFilters.endDate || undefined,
          startYear: appliedFilters.startYear || undefined,
          endYear: appliedFilters.endYear || undefined,
          committee: appliedFilters.committee,
          college: appliedFilters.college,
          panel: appliedFilters.panel,
          category: appliedFilters.category,
          reviewType: appliedFilters.reviewType,
          status: appliedFilters.status,
          q: appliedFilters.q,
          page: 1,
          pageSize: RECORDS_EXPORT_PAGE_SIZE,
          sort,
        });
      }

      await exportReportsPdf({
        summary,
        selectionSummary,
        generatedAt: new Date(),
        analyticsGraph,
        presetLabel:
          selectedPdfPreset === "custom"
            ? "Custom report pack"
            : getReportPdfPresetConfig(selectedPdfPreset).label,
        sections,
        records: exportRecords,
      });
      setExportDialogOpen(false);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to export report PDF."));
    } finally {
      setExportingPdf(false);
    }
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
    setSearchParams(
      toSearchParams("records", next, analyticsGraph, {
        page: "1",
        pageSize: String(pageSize),
        sort,
      })
    );
  };

  const visibleError =
    error && error !== "No academic terms configured." ? error : null;
  const showNoDataEmptyState =
    !loadingSummary &&
    !summary &&
    !visibleError &&
    (requiresCustomRange || hasNoCalendarData);

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
          <div className="reports-controls-actions">
            <button
              type="button"
              className="report-btn-primary"
              onClick={() => setExportDialogOpen(true)}
              disabled={!summary || exportingPdf}
            >
              {exportingPdf ? "Exporting PDF..." : "Export PDF"}
            </button>
            <ReportViewSwitch active={appliedView} onChange={onViewChange} />
          </div>
        </div>

        <ReportFiltersBar
          years={years}
          calendarYearRange={calendarYearRange}
          committees={committees}
          colleges={collegeOptions}
          panels={panels}
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

      {reportsInfoMessage ? (
        <div className="reports-info portal-support">{reportsInfoMessage}</div>
      ) : null}

      {visibleError ? <div className="reports-error portal-support">{visibleError}</div> : null}

      {loadingSummary && !summary ? (
        <section className="portal-summary">
          <div className="report-loading">Preparing report overview…</div>
        </section>
      ) : null}

      {showNoDataEmptyState ? (
        <section className="portal-summary">
          <section className="report-empty">
            No submissions are available yet for the current report scope.
          </section>
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
                {appliedFilters.compareMode !== "NONE" && appliedFilters.compareSource === "DEMO" ? (
                  <div className="reports-demo-note">
                    Demo preview is enabled. Comparison values are illustrative only.
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
            comparisonCounts={comparisonCounts}
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
            <AnalyticsCharts
              summary={summary}
              graphType={analyticsGraph}
              onGraphTypeChange={onAnalyticsGraphChange}
              onDrilldown={onDrilldown}
            />
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
                setSearchParams(
                  toSearchParams("records", appliedFilters, analyticsGraph, {
                    page: "1",
                    pageSize: String(pageSize),
                    sort: nextSort,
                  })
                )
              }
              onPageChange={(nextPage) =>
                setSearchParams(
                  toSearchParams("records", appliedFilters, analyticsGraph, {
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

      <ReportPdfExportDialog
        open={exportDialogOpen}
        selectedPreset={selectedPdfPreset}
        selectedSections={selectedPdfSections}
        estimatedPages={estimatedPdfPages}
        estimatedRecordCount={estimatedPdfRecordCount}
        previewPageKinds={previewPageKinds}
        exporting={exportingPdf}
        exportDisabled={!summary || exportingPdf || selectedPdfSections.length === 0}
        onClose={() => {
          if (!exportingPdf) setExportDialogOpen(false);
        }}
        onPresetChange={onPdfPresetChange}
        onSectionToggle={onPdfSectionToggle}
        onExport={onExportPdf}
      />
    </div>
  );
}
