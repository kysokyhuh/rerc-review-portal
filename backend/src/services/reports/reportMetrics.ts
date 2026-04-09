import {
  ProponentCategory,
  ReviewDecision,
  ReviewType,
  SubmissionStatus,
} from "../../generated/prisma/client";
import { computeWorkingDaysBetween } from "../../utils/workingDays";

export interface ReportSubmissionHistoryEntry {
  newStatus: SubmissionStatus;
  effectiveDate: Date;
}

export interface ReportSubmissionRecord {
  id: number;
  receivedDate: Date;
  sequenceNumber: number;
  status: SubmissionStatus;
  resultsNotifiedAt: Date | null;
  finalDecision: ReviewDecision | null;
  finalDecisionDate: Date | null;
  classification: {
    reviewType: ReviewType;
    classificationDate: Date | null;
  } | null;
  project: {
    id: number;
    committee: {
      code: string;
    };
    committeeId: number;
    piAffiliation: string | null;
    collegeOrUnit: string | null;
    proponentCategory: ProponentCategory | null;
    approvalStartDate: Date | null;
  } | null;
  statusHistory: ReportSubmissionHistoryEntry[];
}

export interface ReportTermVolume {
  term: number;
  received: number;
}

export interface BreakdownByProponentType {
  undergrad: number;
  grad: number;
  faculty: number;
  other: number;
  unknown: number;
}

export interface ProponentTypeReviewTypeBreakdown {
  exempted: number;
  expedited: number;
  fullReview: number;
}

export interface ProponentTypeWithdrawnBreakdown {
  undergrad: number;
  grad: number;
  faculty: number;
  other: number;
  unknown: number;
}

export interface BreakdownByCollege {
  collegeOrUnit: string;
  received: number;
  withdrawn: number;
  exempted: number;
  expedited: number;
  fullReview: number;
  byProponentType: BreakdownByProponentType;
  byProponentTypeWithdrawn: ProponentTypeWithdrawnBreakdown;
  byProponentTypeAndReviewType: {
    undergrad: ProponentTypeReviewTypeBreakdown;
    grad: ProponentTypeReviewTypeBreakdown;
    faculty: ProponentTypeReviewTypeBreakdown;
    other: ProponentTypeReviewTypeBreakdown;
    unknown: ProponentTypeReviewTypeBreakdown;
  };
}

export interface ReportSummary {
  totals: {
    received: number;
    withdrawn: number;
    exempted: number;
    expedited: number;
    fullReview: number;
  };
  termVolume: ReportTermVolume[];
  breakdownByCollegeOrUnit: BreakdownByCollege[];
  classificationMatrix: {
    undergrad: {
      exempted: number;
      expedited: number;
      fullReview: number;
      withdrawn: number;
      total: number;
    };
    grad: {
      exempted: number;
      expedited: number;
      fullReview: number;
      withdrawn: number;
      total: number;
    };
    faculty: {
      exempted: number;
      expedited: number;
      fullReview: number;
      withdrawn: number;
      total: number;
    };
    other: {
      exempted: number;
      expedited: number;
      fullReview: number;
      withdrawn: number;
      total: number;
    };
    unknown: {
      exempted: number;
      expedited: number;
      fullReview: number;
      withdrawn: number;
      total: number;
    };
    total: {
      exempted: number;
      expedited: number;
      fullReview: number;
      withdrawn: number;
      total: number;
    };
  };
  withdrawnByProponentType: ProponentTypeWithdrawnBreakdown;
  averages: {
    avgDaysToResults: {
      expedited: number | null;
      fullReview: number | null;
    };
    avgDaysToResubmit: number | null;
    avgDaysToClearance: {
      expedited: number | null;
      fullReview: number | null;
    };
  };
}

const UNKNOWN_COLLEGE = "Unknown";
const PROPOSAL_SEQUENCE = 1;

type ProponentBucket = keyof BreakdownByProponentType;

type BreakdownKey = keyof ProponentTypeReviewTypeBreakdown;

const initReviewTypeBreakdown = (): ProponentTypeReviewTypeBreakdown => ({
  exempted: 0,
  expedited: 0,
  fullReview: 0,
});

const initCollegeBreakdown = (collegeOrUnit: string): BreakdownByCollege => ({
  collegeOrUnit,
  received: 0,
  withdrawn: 0,
  exempted: 0,
  expedited: 0,
  fullReview: 0,
  byProponentType: {
    undergrad: 0,
    grad: 0,
    faculty: 0,
    other: 0,
    unknown: 0,
  },
  byProponentTypeWithdrawn: {
    undergrad: 0,
    grad: 0,
    faculty: 0,
    other: 0,
    unknown: 0,
  },
  byProponentTypeAndReviewType: {
    undergrad: initReviewTypeBreakdown(),
    grad: initReviewTypeBreakdown(),
    faculty: initReviewTypeBreakdown(),
    other: initReviewTypeBreakdown(),
    unknown: initReviewTypeBreakdown(),
  },
});

const toBreakdownKey = (
  reviewType: ReviewType | null | undefined
): BreakdownKey | null => {
  if (reviewType === ReviewType.EXEMPT) return "exempted";
  if (reviewType === ReviewType.EXPEDITED) return "expedited";
  if (reviewType === ReviewType.FULL_BOARD) return "fullReview";
  return null;
};

const toProponentBucket = (
  category: ProponentCategory | null | undefined
): ProponentBucket => {
  if (category === ProponentCategory.UNDERGRAD) return "undergrad";
  if (category === ProponentCategory.GRAD) return "grad";
  if (category === ProponentCategory.FACULTY) return "faculty";
  if (category === ProponentCategory.OTHER) return "other";
  return "unknown";
};

const normalizeCollegeOrUnit = (project: ReportSubmissionRecord["project"]) => {
  const raw =
    project?.collegeOrUnit?.trim() || project?.piAffiliation?.trim() || UNKNOWN_COLLEGE;
  return raw || UNKNOWN_COLLEGE;
};

const mean = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
};

const sortHistory = (history: ReportSubmissionHistoryEntry[]) =>
  [...history].sort(
    (a, b) =>
      new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()
  );

/**
 * Proxy mapping for "review results notification" when no explicit timestamp exists:
 * 1) Prefer first status after UNDER_REVIEW that indicates review outcome was communicated
 *    (AWAITING_REVISIONS, CLOSED, WITHDRAWN).
 * 2) Fallback to finalDecisionDate when status transitions are incomplete.
 */
export const resolveReviewResultsNotificationDate = (
  submission: ReportSubmissionRecord
): Date | null => {
  if (submission.resultsNotifiedAt) {
    return new Date(submission.resultsNotifiedAt);
  }

  const history = sortHistory(submission.statusHistory);
  const underReview = history.find(
    (entry) => entry.newStatus === SubmissionStatus.UNDER_REVIEW
  );

  const candidate = history.find((entry) => {
    if (
      entry.newStatus !== SubmissionStatus.AWAITING_REVISIONS &&
      entry.newStatus !== SubmissionStatus.CLOSED &&
      entry.newStatus !== SubmissionStatus.WITHDRAWN
    ) {
      return false;
    }
    if (!underReview) return true;
    return (
      new Date(entry.effectiveDate).getTime() >=
      new Date(underReview.effectiveDate).getTime()
    );
  });

  if (candidate?.effectiveDate) return new Date(candidate.effectiveDate);
  if (submission.finalDecisionDate) return new Date(submission.finalDecisionDate);
  return null;
};

/**
 * "Clearance" mapping for reporting:
 * 1) Project.approvalStartDate if present (explicit clearance lifecycle field).
 * 2) Submission.finalDecisionDate when decision is APPROVED.
 * 3) First CLOSED status date as fallback when older records lack explicit fields.
 */
export const resolveClearanceDate = (
  submission: ReportSubmissionRecord
): Date | null => {
  if (submission.project?.approvalStartDate) {
    return new Date(submission.project.approvalStartDate);
  }
  if (
    submission.finalDecision === ReviewDecision.APPROVED &&
    submission.finalDecisionDate
  ) {
    return new Date(submission.finalDecisionDate);
  }

  const closedEntry = sortHistory(submission.statusHistory).find(
    (entry) => entry.newStatus === SubmissionStatus.CLOSED
  );
  return closedEntry?.effectiveDate ? new Date(closedEntry.effectiveDate) : null;
};

export const computeResubmissionDurations = (
  submission: ReportSubmissionRecord,
  holidayDates: Date[]
): number[] => {
  const history = sortHistory(submission.statusHistory);
  const pendingNotifications: Date[] = [];
  const durations: number[] = [];

  for (const entry of history) {
    if (entry.newStatus === SubmissionStatus.AWAITING_REVISIONS) {
      pendingNotifications.push(new Date(entry.effectiveDate));
      continue;
    }

    if (
      entry.newStatus === SubmissionStatus.REVISION_SUBMITTED &&
      pendingNotifications.length > 0
    ) {
      const notificationDate = pendingNotifications.shift()!;
      const resubmissionDate = new Date(entry.effectiveDate);
      durations.push(
        computeWorkingDaysBetween(notificationDate, resubmissionDate, holidayDates)
      );
    }
  }

  return durations;
};

export const buildAcademicYearSummary = ({
  submissions,
  holidayDates,
  termWindows,
}: {
  submissions: ReportSubmissionRecord[];
  holidayDates: Date[];
  termWindows: Array<{ term: number | null; startDate: Date; endDate: Date }>;
}): ReportSummary => {
  const proposalSubmissions = submissions.filter(
    (submission) => submission.sequenceNumber === PROPOSAL_SEQUENCE
  );

  const byCollege = new Map<string, BreakdownByCollege>();
  const classificationMatrix = {
    undergrad: { exempted: 0, expedited: 0, fullReview: 0, withdrawn: 0, total: 0 },
    grad: { exempted: 0, expedited: 0, fullReview: 0, withdrawn: 0, total: 0 },
    faculty: { exempted: 0, expedited: 0, fullReview: 0, withdrawn: 0, total: 0 },
    other: { exempted: 0, expedited: 0, fullReview: 0, withdrawn: 0, total: 0 },
    unknown: { exempted: 0, expedited: 0, fullReview: 0, withdrawn: 0, total: 0 },
    total: { exempted: 0, expedited: 0, fullReview: 0, withdrawn: 0, total: 0 },
  };

  const resultsExpedited: number[] = [];
  const resultsFull: number[] = [];
  const resubmissionDurations: number[] = [];
  const clearanceExpedited: number[] = [];
  const clearanceFull: number[] = [];

  let exempted = 0;
  let expedited = 0;
  let fullReview = 0;
  let withdrawn = 0;

  for (const submission of proposalSubmissions) {
    const reviewType = submission.classification?.reviewType ?? null;
    const breakdownKey = toBreakdownKey(reviewType);
    const proponentBucket = toProponentBucket(submission.project?.proponentCategory);
    const collegeOrUnit = normalizeCollegeOrUnit(submission.project);

    if (!byCollege.has(collegeOrUnit)) {
      byCollege.set(collegeOrUnit, initCollegeBreakdown(collegeOrUnit));
    }
    const college = byCollege.get(collegeOrUnit)!;

    college.received += 1;
    college.byProponentType[proponentBucket] += 1;
    classificationMatrix[proponentBucket].total += 1;
    classificationMatrix.total.total += 1;

    const isWithdrawn =
      submission.status === SubmissionStatus.WITHDRAWN ||
      submission.statusHistory.some(
        (entry) => entry.newStatus === SubmissionStatus.WITHDRAWN
      );
    if (isWithdrawn) {
      withdrawn += 1;
      college.withdrawn += 1;
      college.byProponentTypeWithdrawn[proponentBucket] += 1;
      classificationMatrix[proponentBucket].withdrawn += 1;
      classificationMatrix.total.withdrawn += 1;
    }

    if (breakdownKey === "exempted") {
      exempted += 1;
      college.exempted += 1;
      classificationMatrix[proponentBucket].exempted += 1;
      classificationMatrix.total.exempted += 1;
    }
    if (breakdownKey === "expedited") {
      expedited += 1;
      college.expedited += 1;
      classificationMatrix[proponentBucket].expedited += 1;
      classificationMatrix.total.expedited += 1;
    }
    if (breakdownKey === "fullReview") {
      fullReview += 1;
      college.fullReview += 1;
      classificationMatrix[proponentBucket].fullReview += 1;
      classificationMatrix.total.fullReview += 1;
    }

    if (breakdownKey) {
      college.byProponentTypeAndReviewType[proponentBucket][breakdownKey] += 1;
    }

    if (reviewType === ReviewType.EXPEDITED || reviewType === ReviewType.FULL_BOARD) {
      const resultNotificationDate = resolveReviewResultsNotificationDate(submission);
      if (resultNotificationDate) {
        const duration = computeWorkingDaysBetween(
          submission.receivedDate,
          resultNotificationDate,
          holidayDates
        );
        if (reviewType === ReviewType.EXPEDITED) {
          resultsExpedited.push(duration);
        } else {
          resultsFull.push(duration);
        }
      }

      const clearanceDate = resolveClearanceDate(submission);
      if (clearanceDate) {
        const duration = computeWorkingDaysBetween(
          submission.receivedDate,
          clearanceDate,
          holidayDates
        );
        if (reviewType === ReviewType.EXPEDITED) {
          clearanceExpedited.push(duration);
        } else {
          clearanceFull.push(duration);
        }
      }
    }

    resubmissionDurations.push(
      ...computeResubmissionDurations(submission, holidayDates)
    );
  }

  const termVolumeByTerm = new Map<number, number>();
  for (const termWindow of termWindows) {
    if (termWindow.term === null) continue;
    const start = new Date(termWindow.startDate).getTime();
    const endExclusive = new Date(termWindow.endDate).getTime();

    const received = proposalSubmissions.filter((submission) => {
      const timestamp = new Date(submission.receivedDate).getTime();
      return timestamp >= start && timestamp < endExclusive;
    }).length;

    termVolumeByTerm.set(
      termWindow.term,
      (termVolumeByTerm.get(termWindow.term) ?? 0) + received
    );
  }

  const termVolume = Array.from(termVolumeByTerm.entries())
    .sort(([termA], [termB]) => termA - termB)
    .map(([term, received]) => ({
      term,
      received,
    }));

  return {
    totals: {
      received: proposalSubmissions.length,
      withdrawn,
      exempted,
      expedited,
      fullReview,
    },
    termVolume,
    breakdownByCollegeOrUnit: Array.from(byCollege.values()).sort((a, b) =>
      a.collegeOrUnit.localeCompare(b.collegeOrUnit)
    ),
    classificationMatrix,
    withdrawnByProponentType: {
      undergrad: classificationMatrix.undergrad.withdrawn,
      grad: classificationMatrix.grad.withdrawn,
      faculty: classificationMatrix.faculty.withdrawn,
      other: classificationMatrix.other.withdrawn,
      unknown: classificationMatrix.unknown.withdrawn,
    },
    averages: {
      avgDaysToResults: {
        expedited: mean(resultsExpedited),
        fullReview: mean(resultsFull),
      },
      avgDaysToResubmit: mean(resubmissionDurations),
      avgDaysToClearance: {
        expedited: mean(clearanceExpedited),
        fullReview: mean(clearanceFull),
      },
    },
  };
};
