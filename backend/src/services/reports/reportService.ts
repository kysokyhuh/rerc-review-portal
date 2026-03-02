import prisma from "../../config/prismaClient";
import {
  ProponentCategory,
  ReviewType,
  SubmissionStatus,
  type Prisma,
} from "../../generated/prisma/client";

const RECENT_AY_WINDOW = 5;

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export type ReportViewFilters = {
  ay: string;
  term: "ALL" | 1 | 2 | 3;
  committee: string;
  college: string;
  category: "ALL" | "UNDERGRAD" | "GRAD" | "FACULTY" | "NON_TEACHING";
  reviewType: "ALL" | "EXEMPT" | "EXPEDITED" | "FULL_BOARD" | "UNCLASSIFIED" | "WITHDRAWN";
  status: "ALL" | SubmissionStatus;
  q: string;
};

export type TermWindow = {
  academicYear: string;
  term: number;
  startDate: Date;
  endDateExclusive: Date;
};

type SubmissionForReports = Prisma.SubmissionGetPayload<{
  include: {
    classification: { select: { reviewType: true } };
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
        protocolProfile: { select: { typeOfReview: true } };
        committee: { select: { code: true; name: true } };
      };
    };
    statusHistory: {
      select: { newStatus: true };
    };
  };
}>;

const PRO_CATEGORY_KEYS = ["UNDERGRAD", "GRAD", "FACULTY", "NON_TEACHING"] as const;
type ProCategoryKey = (typeof PRO_CATEGORY_KEYS)[number];

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
  normalizeCategoryFromText(submission.project?.proponent);

const OTHERS_COLLEGE_LABEL = "Others (Indicate in next column)";

const normalizeCollege = (submission: SubmissionForReports) => {
  const raw =
    submission.project?.collegeOrUnit?.trim() ||
    submission.project?.piAffiliation?.trim() ||
    "";
  if (!raw) return OTHERS_COLLEGE_LABEL;
  if (/^unknown$/i.test(raw)) return OTHERS_COLLEGE_LABEL;
  if (/^others?\b/i.test(raw)) return OTHERS_COLLEGE_LABEL;
  return raw;
};

const normalizeDepartment = (submission: SubmissionForReports) => {
  const raw = submission.project?.department?.trim() || "";
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

const normalizeReviewTypeFromText = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("exempt")) return "EXEMPT" as const;
  if (raw.includes("expedit")) return "EXPEDITED" as const;
  if (raw.includes("full")) return "FULL_BOARD" as const;
  return null;
};

const resolveSubmissionReviewType = (submission: SubmissionForReports) =>
  normalizeReviewTypeFromText(submission.project?.protocolProfile?.typeOfReview);

const isWithdrawn = (submission: SubmissionForReports) =>
  submission.status === SubmissionStatus.WITHDRAWN ||
  submission.statusHistory.some((entry) => entry.newStatus === SubmissionStatus.WITHDRAWN);

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

export const parseReportFilters = (query: Record<string, unknown>): ReportViewFilters => ({
  ay: String(query.ay ?? "ALL").trim() || "ALL",
  term: parseTerm(query.term),
  committee: String(query.committee ?? "ALL").trim() || "ALL",
  college: String(query.college ?? "ALL").trim() || "ALL",
  category: parseCategory(query.category),
  reviewType: parseReviewType(query.reviewType),
  status: parseStatus(query.status),
  q: String(query.q ?? "").trim(),
});

export async function getAcademicYearOptions() {
  const terms = await prisma.academicTerm.findMany({
    orderBy: [{ academicYear: "desc" }, { term: "asc" }],
    select: { academicYear: true, term: true },
  });

  const grouped = new Map<string, Set<number>>();
  for (const term of terms) {
    if (!grouped.has(term.academicYear)) grouped.set(term.academicYear, new Set<number>());
    grouped.get(term.academicYear)!.add(term.term);
  }

  return Array.from(grouped.entries())
    .map(([academicYear, termSet]) => ({
      academicYear,
      terms: Array.from(termSet.values()).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.academicYear.localeCompare(a.academicYear))
    .slice(0, RECENT_AY_WINDOW);
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
      startDate: t.startDate,
      endDateExclusive: addDays(t.endDate, 1),
    }));
}

export async function fetchReportSubmissions(filters: ReportViewFilters, termWindows: TermWindow[]) {
  const dateOr = termWindows.map((window) => ({
    receivedDate: { gte: window.startDate, lt: window.endDateExclusive },
  }));

  const submissions = await prisma.submission.findMany({
    where: {
      sequenceNumber: 1,
      OR: dateOr,
      ...(filters.committee !== "ALL"
        ? { project: { committee: { code: filters.committee } } }
        : {}),
    },
    include: {
      classification: { select: { reviewType: true } },
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
          protocolProfile: { select: { typeOfReview: true } },
          committee: { select: { code: true, name: true } },
        },
      },
      statusHistory: {
        select: { newStatus: true },
      },
    },
  });

  return submissions.filter((submission) => {
    const college = normalizeCollege(submission);
    const category = resolveSubmissionCategory(submission);
    const reviewType = resolveSubmissionReviewType(submission);
    const withdrawn = isWithdrawn(submission);

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
    if (filters.status !== "ALL" && submission.status !== filters.status) return false;

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

export function buildAnnualSummaryPayload(
  filters: ReportViewFilters,
  termWindows: TermWindow[],
  submissions: SubmissionForReports[]
) {
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

  for (const submission of submissions) {
    const category = resolveSubmissionCategory(submission);
    const reviewType = resolveSubmissionReviewType(submission);
    const college = normalizeCollege(submission);
    const withdrawn = isWithdrawn(submission);

    summaryCounts.received += 1;
    if (reviewType === "EXEMPT") summaryCounts.exempted += 1;
    if (reviewType === "EXPEDITED") summaryCounts.expedited += 1;
    if (reviewType === "FULL_BOARD") summaryCounts.fullReview += 1;
    if (withdrawn) summaryCounts.withdrawn += 1;
    if (category) summaryCounts.byProponentCategory[category] += 1;

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
  }

  const termBuckets = new Map<string, { label: string; received: number; exempted: number; expedited: number; fullReview: number; withdrawn: number }>();
  for (const window of termWindows) {
    const key = filters.ay === "ALL" ? window.academicYear : `Term ${window.term}`;
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
    const received = submission.receivedDate ? new Date(submission.receivedDate).getTime() : NaN;
    if (!Number.isFinite(received)) continue;
    const window = termWindows.find((tw) => {
      const start = tw.startDate.getTime();
      const end = tw.endDateExclusive.getTime();
      return received >= start && received < end;
    });
    if (!window) continue;

    const key = filters.ay === "ALL" ? window.academicYear : `Term ${window.term}`;
    const row = termBuckets.get(key)!;
    row.received += 1;
    const reviewType = resolveSubmissionReviewType(submission);
    if (reviewType === "EXEMPT") row.exempted += 1;
    if (reviewType === "EXPEDITED") row.expedited += 1;
    if (reviewType === "FULL_BOARD") row.fullReview += 1;
    if (isWithdrawn(submission)) row.withdrawn += 1;
  }

  const proposalsPerTerm = filters.ay === "ALL"
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

  const comparativeYears = Array.from(
    new Set(termWindows.map((window) => window.academicYear))
  ).sort((a, b) => a.localeCompare(b));
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

    const received = submission.receivedDate ? new Date(submission.receivedDate).getTime() : NaN;
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
    const year = window.academicYear;
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

  return {
    selection: {
      ay: filters.ay,
      term: filters.term,
      committee: filters.committee,
      college: filters.college,
      category: filters.category,
      reviewType: filters.reviewType,
      status: filters.status,
      q: filters.q || null,
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
      proposalsPerTerm,
      reviewTypeDistribution,
      topColleges,
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
        ? a.project?.department ?? ""
        : sortField === "status"
        ? a.status
        : sortField === "reviewType"
        ? resolveSubmissionReviewType(a) ?? ""
        : new Date(a.receivedDate ?? 0).getTime();

    const vb =
      sortField === "projectCode"
        ? b.project?.projectCode ?? ""
        : sortField === "title"
        ? b.project?.title ?? ""
        : sortField === "college"
        ? normalizeCollege(b)
        : sortField === "department"
        ? b.project?.department ?? ""
        : sortField === "status"
        ? b.status
        : sortField === "reviewType"
        ? resolveSubmissionReviewType(b) ?? ""
        : new Date(b.receivedDate ?? 0).getTime();

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
    department: submission.project?.department?.trim() || "—",
    proponentCategory: resolveSubmissionCategory(submission) ?? "UNKNOWN",
    reviewType: resolveSubmissionReviewType(submission) ?? "UNCLASSIFIED",
    status: submission.status,
    receivedDate: submission.receivedDate,
  }));

  return {
    totalCount,
    page,
    pageSize,
    items,
  };
}
