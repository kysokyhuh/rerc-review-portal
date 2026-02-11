import {
  computeResubmissionDurations,
  resolveReviewResultsNotificationDate,
  type ReportSubmissionRecord,
} from "../../src/services/reports/reportMetrics";
import {
  ReviewDecision,
  ReviewType,
  SubmissionStatus,
} from "../../src/generated/prisma/client";

const baseSubmission = (): ReportSubmissionRecord => ({
  id: 1,
  receivedDate: new Date("2026-01-05T00:00:00.000Z"),
  sequenceNumber: 1,
  status: SubmissionStatus.AWAITING_REVISIONS,
  finalDecision: ReviewDecision.MINOR_REVISIONS,
  finalDecisionDate: null,
  classification: {
    reviewType: ReviewType.EXPEDITED,
  },
  project: {
    id: 10,
    committee: { code: "RERC-HUMAN" },
    piAffiliation: "Science",
    collegeOrUnit: "Science",
    proponentCategory: null,
    approvalStartDate: null,
  },
  statusHistory: [
    {
      newStatus: SubmissionStatus.UNDER_REVIEW,
      effectiveDate: new Date("2026-01-07T00:00:00.000Z"),
    },
    {
      newStatus: SubmissionStatus.AWAITING_REVISIONS,
      effectiveDate: new Date("2026-01-12T00:00:00.000Z"),
    },
    {
      newStatus: SubmissionStatus.REVISION_SUBMITTED,
      effectiveDate: new Date("2026-01-15T00:00:00.000Z"),
    },
  ],
});

describe("report metrics date mapping", () => {
  it("resolves review results notification from status history", () => {
    const submission = baseSubmission();
    const resultDate = resolveReviewResultsNotificationDate(submission);
    expect(resultDate?.toISOString()).toBe("2026-01-12T00:00:00.000Z");
  });

  it("computes resubmission durations from revision cycles", () => {
    const submission = baseSubmission();
    const holidays = [new Date("2026-01-13T00:00:00.000Z")];
    const durations = computeResubmissionDurations(submission, holidays);

    expect(durations).toEqual([2]);
  });
});
