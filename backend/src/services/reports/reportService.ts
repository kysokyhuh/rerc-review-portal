import prisma from "../../config/prismaClient";
import {
  ProponentCategory,
  ReviewDecision,
  ReviewType,
  SubmissionStatus,
  type Prisma,
} from "../../generated/prisma/client";
import {
  buildAcademicYearSummary,
  type ReportSubmissionRecord,
} from "./reportMetrics";
import { buildSubmissionSlaSummary } from "../sla/submissionSlaService";
import { getActiveProjectFilter } from "../../utils/projectSoftDelete";

const RECENT_AY_WINDOW = 5;

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export type ReportViewFilters = {
  periodMode: "ACADEMIC" | "CUSTOM";
  ay: string;
  term: "ALL" | 1 | 2 | 3;
  startDate: Date | null;
  endDate: Date | null;
  committee: string;
  college: string;
  category: "ALL" | "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING";
  reviewType: "ALL" | "EXEMPT" | "EXPEDITED" | "FULL_BOARD" | "UNCLASSIFIED" | "WITHDRAWN";
  status: "ALL" | SubmissionStatus;
  q: string;
};

export type TermWindow = {
  academicYear: string;
  term: number | null;
  label: string;
  startDate: Date;
  endDateExclusive: Date;
};

export type ReportFallbackRange = {
  startDate: Date;
  endDate: Date;
};

export type ReportAcademicYearsResponse = {
  items: Array<{
    academicYear: string;
    terms: number[];
  }>;
  hasAcademicTerms: boolean;
  fallbackRange: ReportFallbackRange | null;
};

type SubmissionForReports = Prisma.SubmissionGetPayload<{
  include: {
    classification: { select: { reviewType: true; classificationDate: true } };
    project: {
      select: {
        id: true;
        projectCode: true;
        title: true;
        proponent: true;
        piName: true;
        piAffiliation: true;
        collegeOrUnit: true;
        department: true;
        proponentCategory: true;
        committeeId: true;
        approvalStartDate: true;
        protocolProfile: {
          select: {
            college: true;
            department: true;
            dateOfSubmission: true;
            proponent: true;
          };
        };
        committee: { select: { code: true; name: true } };
      };
    };
    statusHistory: {
      select: { newStatus: true; effectiveDate: true };
    };
    reviews: {
      select: { assignedAt: true; dueDate: true; respondedAt: true };
    };
  };
}>;

type ReportDateSource = {
  createdAt: Date;
  receivedDate?: Date | null;
};

const PRO_CATEGORY_KEYS = ["UNDERGRAD", "GRAD", "FACULTY", "NON_TEACHING"] as const;
type ProCategoryKey = (typeof PRO_CATEGORY_KEYS)[number];
type ResolvedReviewType = "EXEMPT" | "EXPEDITED" | "FULL_BOARD";
type ExclusiveOutcome = ResolvedReviewType | "WITHDRAWN" | "UNCLASSIFIED";
type StageComplianceKey =
  | "COMPLETENESS"
  | "CLASSIFICATION"
  | "EXEMPT_NOTIFICATION"
  | "REVIEW"
  | "REVISION_RESPONSE";

const emptyCategoryBuckets = () => ({
  UNDERGRAD: 0,
  GRAD: 0,
  FACULTY: 0,
  NON_TEACHING: 0,
});

const normalizeCategory = (
  category: ProponentCategory | null | undefined
): ProCategoryKey | null => {
  if (category === ProponentCategory.UNDERGRAD) return "UNDERGRAD";
  if (category === ProponentCategory.GRAD) return "GRAD";
  if (category === ProponentCategory.FACULTY) return "FACULTY";
  if (category === ProponentCategory.OTHER) return "NON_TEACHING";
  return null;
};

const normalizeCategoryFromText = (value: string | null | undefined): ProCategoryKey | null => {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!text) return null;
  if (text.includes("undergrad")) return "UNDERGRAD";
  if (text.includes("graduate") || text === "grad") return "GRAD";
  if (text.includes("faculty")) return "FACULTY";
  if (text.includes("non-teaching") || text.includes("non teaching") || text.includes("staff")) {
    return "NON_TEACHING";
  }
  if (text.includes("other")) return "NON_TEACHING";
  return null;
};

const resolveSubmissionCategory = (submission: SubmissionForReports): ProCategoryKey | null =>
  normalizeCategory(submission.project?.proponentCategory) ??
  normalizeCategoryFromText(submission.project?.protocolProfile?.proponent) ??
  normalizeCategoryFromText(submission.project?.proponent);

const resolveRawCollege = (submission: SubmissionForReports) =>
  submission.project?.collegeOrUnit?.trim() ||
  submission.project?.piAffiliation?.trim() ||
  submission.project?.protocolProfile?.college?.trim() ||
  "";

const OTHERS_COLLEGE_LABEL = "Others (Indicate in next column)";

const normalizeCollege = (submission: SubmissionForReports) => {
  const raw = resolveRawCollege(submission);
  if (!raw) return OTHERS_COLLEGE_LABEL;
  if (/^unknown$/i.test(raw)) return OTHERS_COLLEGE_LABEL;
  if (/^others?\b/i.test(raw)) return OTHERS_COLLEGE_LABEL;
  return raw;
};

const normalizeDepartment = (submission: SubmissionForReports) => {
  const raw =
    submission.project?.department?.trim() ||
    submission.project?.protocolProfile?.department?.trim() ||
    "";
  if (!raw) return OTHERS_COLLEGE_LABEL;
  if (/^unknown$/i.test(raw)) return OTHERS_COLLEGE_LABEL;
  if (/^others?\b/i.test(raw)) return OTHERS_COLLEGE_LABEL;
  return raw;
};

const normalizeReviewType = (reviewType: ReviewType | null | undefined) => {
  if (reviewType === ReviewType.EXEMPT) return "EXEMPT";
  if (reviewType === ReviewType.EXPEDITED) return "EXPEDITED";
  if (reviewType === ReviewType.FULL_BOARD) return "FULL_BOARD";
  return null;
};

const resolveSubmissionReviewType = (
  submission: SubmissionForReports
): ResolvedReviewType | null =>
  normalizeReviewType(submission.classification?.reviewType);

const resolveWorkflowReceivedDate = (
  submission: Pick<ReportDateSource, "receivedDate" | "createdAt">
) =>
  submission.receivedDate ?? submission.createdAt;

const resolveReportReceivedDate = (submission: ReportDateSource) =>
  resolveWorkflowReceivedDate(submission);

const resolveClassificationDate = (submission: SubmissionForReports) =>
  submission.classification?.classificationDate ?? null;

const resolveClearanceDate = (submission: SubmissionForReports) =>
  submission.project?.approvalStartDate ??
  submission.finalDecisionDate ??
  submission.resultsNotifiedAt ??
  null;

const isWithdrawn = (submission: SubmissionForReports) =>
  resolveSubmissionStatus(submission) === SubmissionStatus.WITHDRAWN ||
  submission.statusHistory.some((entry) => entry.newStatus === SubmissionStatus.WITHDRAWN);

const nextScreeningStatusSet = new Set<SubmissionStatus>([
  SubmissionStatus.RETURNED_FOR_COMPLETION,
  SubmissionStatus.NOT_ACCEPTED,
  SubmissionStatus.AWAITING_CLASSIFICATION,
  SubmissionStatus.UNDER_CLASSIFICATION,
  SubmissionStatus.CLASSIFIED,
]);

const toPrismaReviewType = (value: ResolvedReviewType | null): ReviewType | null => {
  if (value === "EXEMPT") return ReviewType.EXEMPT;
  if (value === "EXPEDITED") return ReviewType.EXPEDITED;
  if (value === "FULL_BOARD") return ReviewType.FULL_BOARD;
  return null;
};

const toPrismaProponentCategory = (value: ProCategoryKey | null): ProponentCategory | null => {
  if (value === "UNDERGRAD") return ProponentCategory.UNDERGRAD;
  if (value === "GRAD") return ProponentCategory.GRAD;
  if (value === "FACULTY") return ProponentCategory.FACULTY;
  if (value === "NON_TEACHING") return ProponentCategory.OTHER;
  return null;
};

const resolveSubmissionStatus = (submission: SubmissionForReports): SubmissionStatus =>
  submission.status;

const buildSyntheticStatusHistory = (submission: SubmissionForReports) => {
  const history = submission.statusHistory.map((entry) => ({
    newStatus: entry.newStatus,
    effectiveDate: entry.effectiveDate,
  }));

  if (history.length > 0) return history;

  const effectiveStatus = resolveSubmissionStatus(submission);
  const effectiveDate = resolveClearanceDate(submission) ?? resolveWorkflowReceivedDate(submission);
  if (!effectiveDate) return history;

  return [{ newStatus: effectiveStatus, effectiveDate }];
};

const toMetricSubmission = (submission: SubmissionForReports): ReportSubmissionRecord => ({
  id: submission.id,
  receivedDate: resolveReportReceivedDate(submission) ?? submission.createdAt,
  sequenceNumber: submission.sequenceNumber,
  status: submission.status,
  resultsNotifiedAt: submission.resultsNotifiedAt ?? resolveClearanceDate(submission),
  finalDecision:
    submission.finalDecision ??
    (resolveClearanceDate(submission) && !isWithdrawn(submission) ? ReviewDecision.APPROVED : null),
  finalDecisionDate: submission.finalDecisionDate ?? resolveClearanceDate(submission),
  classification: toPrismaReviewType(resolveSubmissionReviewType(submission))
    ? {
        reviewType: toPrismaReviewType(resolveSubmissionReviewType(submission))!,
        classificationDate: resolveClassificationDate(submission),
      }
    : null,
  project: submission.project
    ? {
        id: submission.project.id,
        committee: { code: submission.project.committee.code },
        committeeId: submission.project.committeeId,
        piAffiliation: resolveRawCollege(submission) || submission.project.piAffiliation,
        collegeOrUnit: resolveRawCollege(submission) || submission.project.collegeOrUnit,
        proponentCategory:
          submission.project.proponentCategory ??
          toPrismaProponentCategory(resolveSubmissionCategory(submission)),
        approvalStartDate: resolveClearanceDate(submission),
      }
    : null,
  statusHistory: buildSyntheticStatusHistory(submission),
});

const getExclusiveOutcome = (submission: SubmissionForReports): ExclusiveOutcome => {
  if (isWithdrawn(submission)) return "WITHDRAWN";
  return resolveSubmissionReviewType(submission) ?? "UNCLASSIFIED";
};

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

const startOfUtcMonth = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

const addUtcMonths = (value: Date, months: number) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));

const buildMonthBuckets = (termWindows: TermWindow[]) => {
  if (termWindows.length === 0) return [];

  const start = startOfUtcMonth(
    termWindows.reduce((min, item) => (item.startDate < min ? item.startDate : min), termWindows[0].startDate)
  );
  const latestEndExclusive = termWindows.reduce(
    (max, item) => (item.endDateExclusive > max ? item.endDateExclusive : max),
    termWindows[0].endDateExclusive
  );
  const endExclusive = addUtcMonths(startOfUtcMonth(addDays(latestEndExclusive, -1)), 1);

  const buckets: Array<{ key: string; label: string; start: Date; endExclusive: Date }> = [];
  for (let cursor = start; cursor < endExclusive; cursor = addUtcMonths(cursor, 1)) {
    const next = addUtcMonths(cursor, 1);
    buckets.push({
      key: `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`,
      label: monthFormatter.format(cursor),
      start: cursor,
      endExclusive: next,
    });
  }
  return buckets;
};

const findBucketByDate = <T extends { start: Date; endExclusive: Date }>(
  buckets: T[],
  value: Date | null | undefined
) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return (
    buckets.find((bucket) => {
      const start = bucket.start.getTime();
      const end = bucket.endExclusive.getTime();
      return timestamp >= start && timestamp < end;
    }) ?? null
  );
};

const firstHistoryDate = (
  submission: SubmissionForReports,
  predicate: (status: SubmissionStatus) => boolean
) =>
  submission.statusHistory.find((entry) => predicate(entry.newStatus))?.effectiveDate ?? null;

const lastHistoryDate = (
  submission: SubmissionForReports,
  predicate: (status: SubmissionStatus) => boolean
) => {
  for (let index = submission.statusHistory.length - 1; index >= 0; index -= 1) {
    const entry = submission.statusHistory[index];
    if (predicate(entry.newStatus)) return entry.effectiveDate;
  }
  return null;
};

const reachedStatus = (
  submission: SubmissionForReports,
  predicate: (status: SubmissionStatus) => boolean
) => predicate(submission.status) || submission.statusHistory.some((entry) => predicate(entry.newStatus));

const parseTerm = (value: unknown): "ALL" | 1 | 2 | 3 => {
  const raw = String(value ?? "ALL").trim().toUpperCase();
  if (raw === "ALL" || !raw) return "ALL";
  const parsed = Number(raw);
  if (parsed === 1 || parsed === 2 || parsed === 3) return parsed;
  throw new Error("term must be 1, 2, 3, or ALL");
};

const parseStatus = (value: unknown): "ALL" | SubmissionStatus => {
  const raw = String(value ?? "ALL").trim().toUpperCase();
  if (!raw || raw === "ALL") return "ALL";
  if (Object.values(SubmissionStatus).includes(raw as SubmissionStatus)) {
    return raw as SubmissionStatus;
  }
  throw new Error("Invalid status filter");
};

const parseReviewType = (
  value: unknown
): "ALL" | "EXEMPT" | "EXPEDITED" | "FULL_BOARD" | "UNCLASSIFIED" | "WITHDRAWN" => {
  const raw = String(value ?? "ALL").trim().toUpperCase();
  if (!raw || raw === "ALL") return "ALL";
  if (
    raw === "EXEMPT" ||
    raw === "EXPEDITED" ||
    raw === "FULL_BOARD" ||
    raw === "UNCLASSIFIED" ||
    raw === "WITHDRAWN"
  ) {
    return raw;
  }
  throw new Error("Invalid reviewType filter");
};

const parseCategory = (
  value: unknown
): "ALL" | "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING" => {
  const raw = String(value ?? "ALL").trim().toUpperCase();
  if (!raw || raw === "ALL") return "ALL";
  if (raw === "UNDERGRAD" || raw === "GRAD" || raw === "FACULTY" || raw === "NON_TEACHING") {
    return raw;
  }
  throw new Error("Invalid category filter");
};

const parsePeriodMode = (value: unknown): "ACADEMIC" | "CUSTOM" => {
  const raw = String(value ?? "ACADEMIC").trim().toUpperCase();
  if (!raw || raw === "ACADEMIC") return "ACADEMIC";
  if (raw === "CUSTOM") return "CUSTOM";
  throw new Error("Invalid periodMode filter");
};

const parseDateOnly = (value: unknown, fieldName: string): Date | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`Invalid ${fieldName} filter`);
  }
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${fieldName} filter`);
  }
  return parsed;
};

export const parseReportFilters = (query: Record<string, unknown>): ReportViewFilters => {
  const periodMode = parsePeriodMode(query.periodMode);
  const startDate = parseDateOnly(query.startDate, "startDate");
  const endDate = parseDateOnly(query.endDate, "endDate");

  if (periodMode === "CUSTOM") {
    if (!startDate || !endDate) {
      throw new Error("Custom date range requires both startDate and endDate.");
    }
    if (endDate < startDate) {
      throw new Error("endDate must not be earlier than startDate.");
    }
  }

  return {
    periodMode,
    ay: String(query.ay ?? "ALL").trim() || "ALL",
    term: parseTerm(query.term),
    startDate,
    endDate,
    committee: String(query.committee ?? "ALL").trim() || "ALL",
    college: String(query.college ?? "ALL").trim() || "ALL",
    category: parseCategory(query.category),
    reviewType: parseReviewType(query.reviewType),
    status: parseStatus(query.status),
    q: String(query.q ?? "").trim(),
  };
};

export async function resolveReportFallbackRange(): Promise<ReportFallbackRange | null> {
  const activeProjectFilter = await getActiveProjectFilter();
  const submissions = await prisma.submission.findMany({
    where: {
      sequenceNumber: 1,
      project: {
        ...activeProjectFilter,
      },
    },
    select: {
      createdAt: true,
      receivedDate: true,
    },
  });

  const dates = submissions
    .map((submission) => resolveReportReceivedDate(submission))
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));

  if (dates.length === 0) {
    return null;
  }

  const startDate = dates.reduce((min, value) => (value < min ? value : min), dates[0]);
  const endDate = dates.reduce((max, value) => (value > max ? value : max), dates[0]);

  return {
    startDate,
    endDate,
  };
}

export async function getAcademicYearOptions(): Promise<ReportAcademicYearsResponse> {
  const terms = await prisma.academicTerm.findMany({
    orderBy: [{ academicYear: "desc" }, { term: "asc" }],
    select: { academicYear: true, term: true },
  });

  const grouped = new Map<string, Set<number>>();
  for (const term of terms) {
    if (!grouped.has(term.academicYear)) grouped.set(term.academicYear, new Set<number>());
    grouped.get(term.academicYear)!.add(term.term);
  }

  const items = Array.from(grouped.entries())
    .map(([academicYear, termSet]) => ({
      academicYear,
      terms: Array.from(termSet.values()).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.academicYear.localeCompare(a.academicYear))
    .slice(0, RECENT_AY_WINDOW);

  return {
    items,
    hasAcademicTerms: items.length > 0,
    fallbackRange: await resolveReportFallbackRange(),
  };
}

export async function resolveTermWindows(
  ay: string,
  term: "ALL" | 1 | 2 | 3
): Promise<TermWindow[]> {
  let terms = await prisma.academicTerm.findMany({
    ...(ay === "ALL" ? {} : { where: { academicYear: ay } }),
    orderBy: [{ academicYear: "asc" }, { term: "asc" }],
    select: {
      academicYear: true,
      term: true,
      startDate: true,
      endDate: true,
    },
  });

  if (terms.length === 0) {
    throw new Error(ay === "ALL" ? "No academic terms configured." : `No terms for ${ay}.`);
  }

  if (ay === "ALL") {
    const latestYears = Array.from(new Set(terms.map((t) => t.academicYear)))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, RECENT_AY_WINDOW);
    const latestYearSet = new Set(latestYears);
    terms = terms.filter((t) => latestYearSet.has(t.academicYear));
  }

  return terms
    .filter((t) => term === "ALL" || t.term === term)
    .map((t) => ({
      academicYear: t.academicYear,
      term: t.term,
      label: ay === "ALL" ? t.academicYear : `Term ${t.term}`,
      startDate: t.startDate,
      endDateExclusive: addDays(t.endDate, 1),
    }));
}

export async function resolveReportWindows(filters: ReportViewFilters): Promise<TermWindow[]> {
  if (filters.periodMode === "CUSTOM") {
    if (!filters.startDate || !filters.endDate) {
      throw new Error("Custom date range requires both startDate and endDate.");
    }

    return [
      {
        academicYear: "Selected range",
        term: null,
        label: "Selected range",
        startDate: filters.startDate,
        endDateExclusive: addDays(filters.endDate, 1),
      },
    ];
  }

  return resolveTermWindows(filters.ay, filters.term);
}

export async function fetchReportSubmissions(filters: ReportViewFilters, termWindows: TermWindow[]) {
  const activeProjectFilter = await getActiveProjectFilter();

  const submissions = await prisma.submission.findMany({
    where: {
      sequenceNumber: 1,
      project: {
        ...activeProjectFilter,
        ...(filters.committee !== "ALL"
          ? { committee: { code: filters.committee } }
          : {}),
      },
    },
    include: {
      classification: { select: { reviewType: true, classificationDate: true } },
      project: {
        select: {
          id: true,
          projectCode: true,
          title: true,
          proponent: true,
          piName: true,
          piAffiliation: true,
          collegeOrUnit: true,
          department: true,
          proponentCategory: true,
          committeeId: true,
          approvalStartDate: true,
          protocolProfile: {
            select: {
              college: true,
              department: true,
              dateOfSubmission: true,
              proponent: true,
            },
          },
          committee: { select: { code: true, name: true } },
        },
      },
      statusHistory: {
        orderBy: { effectiveDate: "asc" },
        select: { newStatus: true, effectiveDate: true },
      },
      reviews: {
        select: {
          assignedAt: true,
          dueDate: true,
          respondedAt: true,
        },
      },
    },
  });

  return submissions.filter((submission) => {
    const effectiveReceivedDate = resolveReportReceivedDate(submission);
    if (!effectiveReceivedDate) return false;
    const isInWindow = termWindows.some((window) => {
      const timestamp = effectiveReceivedDate.getTime();
      return timestamp >= window.startDate.getTime() && timestamp < window.endDateExclusive.getTime();
    });
    if (!isInWindow) return false;

    const college = normalizeCollege(submission);
    const category = resolveSubmissionCategory(submission);
    const reviewType = resolveSubmissionReviewType(submission);
    const withdrawn = isWithdrawn(submission);
    const effectiveStatus = resolveSubmissionStatus(submission);

    // User rule: exclude records with empty/unknown proponent category from reports
    if (!category) return false;

    if (filters.college !== "ALL" && college !== filters.college) return false;
    if (filters.category !== "ALL" && category !== filters.category) return false;
    if (filters.reviewType === "WITHDRAWN") {
      if (!withdrawn) return false;
    } else if (filters.reviewType === "UNCLASSIFIED") {
      if (reviewType !== null) return false;
    } else if (filters.reviewType !== "ALL" && reviewType !== filters.reviewType) {
      return false;
    }
    if (filters.status !== "ALL" && effectiveStatus !== filters.status) return false;

    if (filters.q) {
      const hay = `${submission.project?.projectCode ?? ""} ${submission.project?.title ?? ""} ${
        submission.project?.proponent ?? submission.project?.piName ?? ""
      } ${college}`.toLowerCase();
      if (!hay.includes(filters.q.toLowerCase())) return false;
    }

    // Preserve withdrawn logic independent of current status for summary counts
    if (filters.status === SubmissionStatus.WITHDRAWN && !withdrawn) return false;
    return true;
  });
}

const aggregateTopRows = <T extends { label: string }>(
  rows: T[],
  limit: number,
  createOther: (items: T[]) => T
) => {
  if (rows.length <= limit) return rows;
  const primary = rows.slice(0, limit);
  return [...primary, createOther(rows.slice(limit))];
};

export async function buildAnnualSummaryPayload(
  filters: ReportViewFilters,
  termWindows: TermWindow[],
  submissions: SubmissionForReports[]
) {
  const [holidayRows, slaConfigs] = await Promise.all([
    prisma.holiday.findMany({ select: { date: true } }),
    prisma.configSLA.findMany({
      where: { isActive: true },
      select: {
        committeeId: true,
        stage: true,
        reviewType: true,
        workingDays: true,
        dayMode: true,
        description: true,
      },
    }),
  ]);
  const holidayDates = holidayRows.map((row) => row.date);
  const metricsSummary = buildAcademicYearSummary({
    submissions: submissions.map(toMetricSubmission),
    holidayDates,
    termWindows: termWindows.map((window) => ({
      term: window.term,
      startDate: window.startDate,
      endDate: window.endDateExclusive,
    })),
  });

  const dateRange = {
    startDate: termWindows.reduce((min, t) => (t.startDate < min ? t.startDate : min), termWindows[0].startDate),
    endDate: addDays(
      termWindows.reduce(
        (max, t) => (t.endDateExclusive > max ? t.endDateExclusive : max),
        termWindows[0].endDateExclusive
      ),
      -1
    ),
  };
  const now = new Date();
  const asOfDate = now < dateRange.endDate ? now : dateRange.endDate;
  const isPartial = asOfDate.getTime() < dateRange.endDate.getTime();

  const summaryCounts = {
    received: 0,
    exempted: 0,
    expedited: 0,
    fullReview: 0,
    withdrawn: 0,
    byProponentCategory: emptyCategoryBuckets(),
  };

  const matrixBase = {
    UNDERGRAD: { exempted: 0, expedited: 0, fullReview: 0, withdrawn: 0, total: 0 },
    GRAD: { exempted: 0, expedited: 0, fullReview: 0, withdrawn: 0, total: 0 },
    FACULTY: { exempted: 0, expedited: 0, fullReview: 0, withdrawn: 0, total: 0 },
    NON_TEACHING: { exempted: 0, expedited: 0, fullReview: 0, withdrawn: 0, total: 0 },
    TOTAL: { exempted: 0, expedited: 0, fullReview: 0, withdrawn: 0, total: 0 },
  };
  const breakdownByCollege = new Map<
    string,
    {
      college: string;
      received: number;
      exempted: number;
      expedited: number;
      fullReview: number;
      withdrawn: number;
      categories: Record<
        ProCategoryKey,
        { received: number; exempted: number; expedited: number; fullReview: number; withdrawn: number }
      >;
    }
  >();
  const outcomeByCollege = new Map<
    string,
    {
      label: string;
      total: number;
      exempted: number;
      expedited: number;
      fullReview: number;
      withdrawn: number;
      unclassified: number;
    }
  >();
  const committeeDistributionMap = new Map<string, number>();

  for (const submission of submissions) {
    const category = resolveSubmissionCategory(submission);
    const reviewType = resolveSubmissionReviewType(submission);
    const college = normalizeCollege(submission);
    const withdrawn = isWithdrawn(submission);
    const exclusiveOutcome = getExclusiveOutcome(submission);
    const committeeLabel = submission.project?.committee.code ?? "Unknown";

    summaryCounts.received += 1;
    if (reviewType === "EXEMPT") summaryCounts.exempted += 1;
    if (reviewType === "EXPEDITED") summaryCounts.expedited += 1;
    if (reviewType === "FULL_BOARD") summaryCounts.fullReview += 1;
    if (withdrawn) summaryCounts.withdrawn += 1;
    if (category) summaryCounts.byProponentCategory[category] += 1;
    committeeDistributionMap.set(
      committeeLabel,
      (committeeDistributionMap.get(committeeLabel) ?? 0) + 1
    );

    if (!breakdownByCollege.has(college)) {
      breakdownByCollege.set(college, {
        college,
        received: 0,
        exempted: 0,
        expedited: 0,
        fullReview: 0,
        withdrawn: 0,
        categories: {
          UNDERGRAD: { received: 0, exempted: 0, expedited: 0, fullReview: 0, withdrawn: 0 },
          GRAD: { received: 0, exempted: 0, expedited: 0, fullReview: 0, withdrawn: 0 },
          FACULTY: { received: 0, exempted: 0, expedited: 0, fullReview: 0, withdrawn: 0 },
          NON_TEACHING: { received: 0, exempted: 0, expedited: 0, fullReview: 0, withdrawn: 0 },
        },
      });
    }
    const collegeBucket = breakdownByCollege.get(college)!;
    collegeBucket.received += 1;
    if (reviewType === "EXEMPT") collegeBucket.exempted += 1;
    if (reviewType === "EXPEDITED") collegeBucket.expedited += 1;
    if (reviewType === "FULL_BOARD") collegeBucket.fullReview += 1;
    if (withdrawn) collegeBucket.withdrawn += 1;

    if (category) {
      collegeBucket.categories[category].received += 1;
      if (reviewType === "EXEMPT") collegeBucket.categories[category].exempted += 1;
      if (reviewType === "EXPEDITED") collegeBucket.categories[category].expedited += 1;
      if (reviewType === "FULL_BOARD") collegeBucket.categories[category].fullReview += 1;
      if (withdrawn) collegeBucket.categories[category].withdrawn += 1;

      matrixBase[category].total += 1;
      matrixBase.TOTAL.total += 1;
      if (reviewType === "EXEMPT") {
        matrixBase[category].exempted += 1;
        matrixBase.TOTAL.exempted += 1;
      }
      if (reviewType === "EXPEDITED") {
        matrixBase[category].expedited += 1;
        matrixBase.TOTAL.expedited += 1;
      }
      if (reviewType === "FULL_BOARD") {
        matrixBase[category].fullReview += 1;
        matrixBase.TOTAL.fullReview += 1;
      }
      if (withdrawn) {
        matrixBase[category].withdrawn += 1;
        matrixBase.TOTAL.withdrawn += 1;
      }
    }

    if (!outcomeByCollege.has(college)) {
      outcomeByCollege.set(college, {
        label: college,
        total: 0,
        exempted: 0,
        expedited: 0,
        fullReview: 0,
        withdrawn: 0,
        unclassified: 0,
      });
    }
    const outcomeBucket = outcomeByCollege.get(college)!;
    outcomeBucket.total += 1;
    if (exclusiveOutcome === "WITHDRAWN") outcomeBucket.withdrawn += 1;
    else if (exclusiveOutcome === "EXEMPT") outcomeBucket.exempted += 1;
    else if (exclusiveOutcome === "EXPEDITED") outcomeBucket.expedited += 1;
    else if (exclusiveOutcome === "FULL_BOARD") outcomeBucket.fullReview += 1;
    else outcomeBucket.unclassified += 1;
  }

  const termBuckets = new Map<string, { label: string; received: number; exempted: number; expedited: number; fullReview: number; withdrawn: number }>();
  for (const window of termWindows) {
    const key =
      filters.periodMode === "CUSTOM"
        ? window.label
        : filters.ay === "ALL"
        ? window.academicYear
        : `Term ${window.term}`;
    if (!termBuckets.has(key)) {
      termBuckets.set(key, {
        label: key,
        received: 0,
        exempted: 0,
        expedited: 0,
        fullReview: 0,
        withdrawn: 0,
      });
    }
  }
  for (const submission of submissions) {
    const effectiveReceivedDate = resolveReportReceivedDate(submission);
    const received = effectiveReceivedDate ? effectiveReceivedDate.getTime() : NaN;
    if (!Number.isFinite(received)) continue;
    const window = termWindows.find((tw) => {
      const start = tw.startDate.getTime();
      const end = tw.endDateExclusive.getTime();
      return received >= start && received < end;
    });
    if (!window) continue;

    const key =
      filters.periodMode === "CUSTOM"
        ? window.label
        : filters.ay === "ALL"
        ? window.academicYear
        : `Term ${window.term}`;
    const row = termBuckets.get(key)!;
    row.received += 1;
    const reviewType = resolveSubmissionReviewType(submission);
    if (reviewType === "EXEMPT") row.exempted += 1;
    if (reviewType === "EXPEDITED") row.expedited += 1;
    if (reviewType === "FULL_BOARD") row.fullReview += 1;
    if (isWithdrawn(submission)) row.withdrawn += 1;
  }

  const proposalsPerTerm = filters.periodMode === "CUSTOM" || filters.ay === "ALL"
    ? []
    : [1, 2, 3].map((term) => {
        const row = termBuckets.get(`Term ${term}`);
        return { label: `Term ${term}`, count: row?.received ?? 0 };
      });

  const reviewTypeDistribution = [
    { label: "Exempted", count: summaryCounts.exempted },
    { label: "Expedited", count: summaryCounts.expedited },
    { label: "Full Review", count: summaryCounts.fullReview },
    { label: "Withdrawn", count: summaryCounts.withdrawn },
  ];

  const topCollegeRows = Array.from(breakdownByCollege.values()).sort((a, b) => b.received - a.received);
  const topN = 8;
  const topColleges = topCollegeRows.slice(0, topN).map((row) => ({
    label: row.college,
    count: row.received,
  }));
  if (topCollegeRows.length > topN) {
    const other = topCollegeRows.slice(topN).reduce((sum, row) => sum + row.received, 0);
    topColleges.push({ label: "Other", count: other });
  }

  const comparativeYears =
    filters.periodMode === "CUSTOM"
      ? [termWindows[0].label]
      : Array.from(new Set(termWindows.map((window) => window.academicYear))).sort((a, b) =>
          a.localeCompare(b)
        );
  const newYearCounts = () =>
    Object.fromEntries(comparativeYears.map((year) => [year, 0])) as Record<string, number>;

  const comparativeMaps = new Map<
    ProCategoryKey,
    Map<
      string,
      {
        college: string;
        exempted: Record<string, number>;
        expedited: Record<string, number>;
        fullReview: Record<string, number>;
        withdrawn: Record<string, number>;
      }
    >
  >();
  for (const category of PRO_CATEGORY_KEYS) {
    comparativeMaps.set(category, new Map());
  }

  for (const submission of submissions) {
    const category = resolveSubmissionCategory(submission);
    if (!category) continue;

    const effectiveReceivedDate = resolveReportReceivedDate(submission);
    const received = effectiveReceivedDate ? effectiveReceivedDate.getTime() : NaN;
    if (!Number.isFinite(received)) continue;
    const window = termWindows.find((tw) => {
      const start = tw.startDate.getTime();
      const end = tw.endDateExclusive.getTime();
      return received >= start && received < end;
    });
    if (!window) continue;

    const reviewType = resolveSubmissionReviewType(submission);
    const college =
      category === "NON_TEACHING"
        ? normalizeDepartment(submission)
        : normalizeCollege(submission);
    const rowsByCollege = comparativeMaps.get(category)!;
    if (!rowsByCollege.has(college)) {
      rowsByCollege.set(college, {
        college,
        exempted: newYearCounts(),
        expedited: newYearCounts(),
        fullReview: newYearCounts(),
        withdrawn: newYearCounts(),
      });
    }
    const row = rowsByCollege.get(college)!;
    const year = filters.periodMode === "CUSTOM" ? window.label : window.academicYear;
    if (reviewType === "EXEMPT") row.exempted[year] += 1;
    if (reviewType === "EXPEDITED") row.expedited[year] += 1;
    if (reviewType === "FULL_BOARD") row.fullReview[year] += 1;
    if (isWithdrawn(submission)) row.withdrawn[year] += 1;
  }

  const comparativeByProponent = PRO_CATEGORY_KEYS.map((category) => {
    const rows = Array.from(comparativeMaps.get(category)!.values()).sort((a, b) =>
      a.college.localeCompare(b.college)
    );
    const totals = {
      college: "TOTAL",
      exempted: newYearCounts(),
      expedited: newYearCounts(),
      fullReview: newYearCounts(),
      withdrawn: newYearCounts(),
    };
    for (const row of rows) {
      for (const year of comparativeYears) {
        totals.exempted[year] += row.exempted[year];
        totals.expedited[year] += row.expedited[year];
        totals.fullReview[year] += row.fullReview[year];
        totals.withdrawn[year] += row.withdrawn[year];
      }
    }
    return { category, years: comparativeYears, rows, totals };
  });

  const monthBuckets = filters.periodMode === "ACADEMIC" && filters.ay === "ALL" ? [] : buildMonthBuckets(termWindows);
  const receivedByMonthMap = new Map(
    monthBuckets.map((bucket) => [bucket.key, { label: bucket.label, count: 0 }])
  );
  const reviewTypeByMonthMap = new Map(
    monthBuckets.map((bucket) => [
      bucket.key,
      {
        label: bucket.label,
        exempted: 0,
        expedited: 0,
        fullReview: 0,
        withdrawn: 0,
        unclassified: 0,
        total: 0,
      },
    ])
  );
  const withdrawnByMonthMap = new Map(
    monthBuckets.map((bucket) => [bucket.key, { label: bucket.label, count: 0 }])
  );

  for (const submission of submissions) {
    if (!monthBuckets.length) break;
    const bucket = findBucketByDate(monthBuckets, resolveReportReceivedDate(submission));
    if (!bucket) continue;

    receivedByMonthMap.get(bucket.key)!.count += 1;
    const reviewBucket = reviewTypeByMonthMap.get(bucket.key)!;
    reviewBucket.total += 1;
    const exclusiveOutcome = getExclusiveOutcome(submission);
    if (exclusiveOutcome === "WITHDRAWN") {
      reviewBucket.withdrawn += 1;
      withdrawnByMonthMap.get(bucket.key)!.count += 1;
    } else if (exclusiveOutcome === "EXEMPT") {
      reviewBucket.exempted += 1;
    } else if (exclusiveOutcome === "EXPEDITED") {
      reviewBucket.expedited += 1;
    } else if (exclusiveOutcome === "FULL_BOARD") {
      reviewBucket.fullReview += 1;
    } else {
      reviewBucket.unclassified += 1;
    }
  }

  const receivedByMonth = monthBuckets.map((bucket) => receivedByMonthMap.get(bucket.key)!);
  const reviewTypeByMonth = monthBuckets.map((bucket) => reviewTypeByMonthMap.get(bucket.key)!);
  const withdrawnByMonth = monthBuckets.map((bucket) => withdrawnByMonthMap.get(bucket.key)!);

  const proponentCategoryDistribution = [
    { label: "Undergraduate", category: "UNDERGRAD" as const, count: summaryCounts.byProponentCategory.UNDERGRAD },
    { label: "Graduate", category: "GRAD" as const, count: summaryCounts.byProponentCategory.GRAD },
    { label: "Faculty", category: "FACULTY" as const, count: summaryCounts.byProponentCategory.FACULTY },
    { label: "Non-Teaching", category: "NON_TEACHING" as const, count: summaryCounts.byProponentCategory.NON_TEACHING },
  ];

  const receivedByCollege = aggregateTopRows(
    topCollegeRows.map((row) => ({
      label: row.college,
      count: row.received,
    })),
    8,
    (items) => ({
      label: "Other",
      count: items.reduce((sum, item) => sum + item.count, 0),
    })
  );

  const outcomeByCollegeRows = aggregateTopRows(
    Array.from(outcomeByCollege.values())
      .sort((a, b) => b.total - a.total),
    8,
    (items) => ({
      label: "Other",
      total: items.reduce((sum, item) => sum + item.total, 0),
      exempted: items.reduce((sum, item) => sum + item.exempted, 0),
      expedited: items.reduce((sum, item) => sum + item.expedited, 0),
      fullReview: items.reduce((sum, item) => sum + item.fullReview, 0),
      withdrawn: items.reduce((sum, item) => sum + item.withdrawn, 0),
      unclassified: items.reduce((sum, item) => sum + item.unclassified, 0),
    })
  );

  const comparativeYearTrend = comparativeYears.map((year) => {
    const row = {
      label: year,
      exempted: 0,
      expedited: 0,
      fullReview: 0,
      withdrawn: 0,
    };
    for (const table of comparativeByProponent) {
      row.exempted += table.totals.exempted[year] ?? 0;
      row.expedited += table.totals.expedited[year] ?? 0;
      row.fullReview += table.totals.fullReview[year] ?? 0;
      row.withdrawn += table.totals.withdrawn[year] ?? 0;
    }
    return row;
  });

  const committeeDistribution = Array.from(committeeDistributionMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  const slaCompliance = new Map<StageComplianceKey, { within: number; overdue: number }>([
    ["COMPLETENESS", { within: 0, overdue: 0 }],
    ["CLASSIFICATION", { within: 0, overdue: 0 }],
    ["EXEMPT_NOTIFICATION", { within: 0, overdue: 0 }],
    ["REVIEW", { within: 0, overdue: 0 }],
    ["REVISION_RESPONSE", { within: 0, overdue: 0 }],
  ]);
  const slaReferenceDate = new Date();

  for (const submission of submissions) {
    const summary = buildSubmissionSlaSummary(submission, slaConfigs, holidayDates, slaReferenceDate);
    const complianceRows: Array<[StageComplianceKey, typeof summary.completeness]> = [
      ["COMPLETENESS", summary.completeness],
      ["CLASSIFICATION", summary.classification],
      ["EXEMPT_NOTIFICATION", summary.exemptNotification],
      ["REVIEW", summary.review],
      ["REVISION_RESPONSE", summary.revisionResponse],
    ];

    for (const [key, stageSummary] of complianceRows) {
      if (stageSummary.configuredDays == null || stageSummary.actualDays == null) continue;
      const bucket = slaCompliance.get(key)!;
      if (stageSummary.withinSla === false) bucket.overdue += 1;
      else bucket.within += 1;
    }
  }

  const workflowFunnel = [
    { label: "Received", count: submissions.length },
    {
      label: "Screened",
      count: submissions.filter((submission) =>
        reachedStatus(
          submission,
          (status) =>
            status === SubmissionStatus.UNDER_COMPLETENESS_CHECK ||
            nextScreeningStatusSet.has(status)
        )
      ).length,
    },
    {
      label: "Classified",
      count: submissions.filter((submission) =>
        !!submission.classification ||
        reachedStatus(
          submission,
          (status) =>
            status === SubmissionStatus.AWAITING_CLASSIFICATION ||
            status === SubmissionStatus.UNDER_CLASSIFICATION ||
            status === SubmissionStatus.CLASSIFIED ||
            status === SubmissionStatus.UNDER_REVIEW ||
            status === SubmissionStatus.AWAITING_REVISIONS ||
            status === SubmissionStatus.REVISION_SUBMITTED ||
            status === SubmissionStatus.CLOSED ||
            status === SubmissionStatus.WITHDRAWN
        )
      ).length,
    },
    {
      label: "Under Review",
      count: submissions.filter((submission) =>
        reachedStatus(submission, (status) => status === SubmissionStatus.UNDER_REVIEW)
      ).length,
    },
    {
      label: "Awaiting Revisions",
      count: submissions.filter((submission) =>
        reachedStatus(
          submission,
          (status) =>
            status === SubmissionStatus.AWAITING_REVISIONS ||
            status === SubmissionStatus.REVISION_SUBMITTED
        )
      ).length,
    },
    {
      label: "Closed",
      count: submissions.filter((submission) =>
        reachedStatus(
          submission,
          (status) =>
            status === SubmissionStatus.CLOSED || status === SubmissionStatus.WITHDRAWN
        )
      ).length,
    },
  ];

  return {
    selection: {
      periodMode: filters.periodMode,
      ay: filters.ay,
      term: filters.term,
      committee: filters.committee,
      college: filters.college,
      category: filters.category,
      reviewType: filters.reviewType,
      status: filters.status,
      q: filters.q || null,
      asOfDate,
      isPartial,
      dateRange,
    },
    summaryCounts,
    overviewTable: {
      rows: Array.from(termBuckets.values()),
      totals: {
        received: summaryCounts.received,
        exempted: summaryCounts.exempted,
        expedited: summaryCounts.expedited,
        fullReview: summaryCounts.fullReview,
        withdrawn: summaryCounts.withdrawn,
      },
    },
    classificationMatrix: matrixBase,
    breakdownByCollege: topCollegeRows,
    comparativeByProponent,
    charts: {
      receivedByMonth,
      proponentCategoryDistribution,
      receivedByCollege,
      outcomeByCollege: outcomeByCollegeRows,
      proposalsPerTerm,
      reviewTypeDistribution,
      topColleges,
      reviewTypeByMonth,
      withdrawnByMonth,
      comparativeYearTrend,
      committeeDistribution,
    },
    performanceCharts: {
      averages: {
        daysToResults: [
          { label: "Expedited", value: metricsSummary.averages.avgDaysToResults.expedited },
          { label: "Full Review", value: metricsSummary.averages.avgDaysToResults.fullReview },
        ],
        daysToClearance: [
          { label: "Expedited", value: metricsSummary.averages.avgDaysToClearance.expedited },
          { label: "Full Review", value: metricsSummary.averages.avgDaysToClearance.fullReview },
        ],
        daysToResubmit: metricsSummary.averages.avgDaysToResubmit,
      },
      slaCompliance: [
        {
          label: "Completeness",
          within: slaCompliance.get("COMPLETENESS")!.within,
          overdue: slaCompliance.get("COMPLETENESS")!.overdue,
        },
        {
          label: "Classification",
          within: slaCompliance.get("CLASSIFICATION")!.within,
          overdue: slaCompliance.get("CLASSIFICATION")!.overdue,
        },
        {
          label: "Exempt Notification",
          within: slaCompliance.get("EXEMPT_NOTIFICATION")!.within,
          overdue: slaCompliance.get("EXEMPT_NOTIFICATION")!.overdue,
        },
        {
          label: "Review",
          within: slaCompliance.get("REVIEW")!.within,
          overdue: slaCompliance.get("REVIEW")!.overdue,
        },
        {
          label: "Revisions",
          within: slaCompliance.get("REVISION_RESPONSE")!.within,
          overdue: slaCompliance.get("REVISION_RESPONSE")!.overdue,
        },
      ],
      workflowFunnel,
    },
  };
}

export function buildSubmissionRecordsPayload(
  submissions: SubmissionForReports[],
  page: number,
  pageSize: number,
  sort: string
) {
  const [sortFieldRaw, sortDirRaw] = sort.split(":");
  const sortField = sortFieldRaw || "receivedDate";
  const sortDir = (sortDirRaw || "desc").toLowerCase() === "asc" ? "asc" : "desc";

  const sortable = [...submissions];
  sortable.sort((a, b) => {
    const va =
      sortField === "projectCode"
        ? a.project?.projectCode ?? ""
        : sortField === "title"
        ? a.project?.title ?? ""
        : sortField === "college"
        ? normalizeCollege(a)
        : sortField === "department"
        ? normalizeDepartment(a)
        : sortField === "status"
        ? resolveSubmissionStatus(a)
        : sortField === "reviewType"
        ? resolveSubmissionReviewType(a) ?? ""
        : new Date(resolveReportReceivedDate(a) ?? 0).getTime();

    const vb =
      sortField === "projectCode"
        ? b.project?.projectCode ?? ""
        : sortField === "title"
        ? b.project?.title ?? ""
        : sortField === "college"
        ? normalizeCollege(b)
        : sortField === "department"
        ? normalizeDepartment(b)
        : sortField === "status"
        ? resolveSubmissionStatus(b)
        : sortField === "reviewType"
        ? resolveSubmissionReviewType(b) ?? ""
        : new Date(resolveReportReceivedDate(b) ?? 0).getTime();

    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const totalCount = sortable.length;
  const start = (page - 1) * pageSize;
  const items = sortable.slice(start, start + pageSize).map((submission) => ({
    submissionId: submission.id,
    projectId: submission.project?.id ?? null,
    projectCode: submission.project?.projectCode ?? "N/A",
    title: submission.project?.title ?? "Untitled",
    proponent: submission.project?.proponent ?? submission.project?.piName ?? "Unknown",
    college: normalizeCollege(submission),
    department: normalizeDepartment(submission),
    proponentCategory: resolveSubmissionCategory(submission) ?? "UNKNOWN",
    reviewType: resolveSubmissionReviewType(submission) ?? "UNCLASSIFIED",
    status: resolveSubmissionStatus(submission),
    receivedDate: resolveReportReceivedDate(submission),
  }));

  return {
    totalCount,
    page,
    pageSize,
    items,
  };
}
