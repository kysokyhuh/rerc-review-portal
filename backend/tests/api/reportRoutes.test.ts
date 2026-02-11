import prismaClient from "../../src/config/prismaClient";
import {
  getAcademicYearSummaryHandler,
} from "../../src/routes/reportRoutes";
import {
  ReviewType,
  SubmissionStatus,
} from "../../src/generated/prisma/client";

jest.mock("../../src/config/prismaClient", () => ({
  __esModule: true,
  default: {
    academicTerm: {
      findMany: jest.fn(),
    },
    submission: {
      findMany: jest.fn(),
    },
    holiday: {
      findMany: jest.fn(),
    },
  },
}));

const prisma = prismaClient as unknown as {
  academicTerm: { findMany: jest.Mock };
  submission: { findMany: jest.Mock };
  holiday: { findMany: jest.Mock };
};

const createResponseMock = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("GET /reports/academic-year-summary", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    prisma.academicTerm.findMany.mockResolvedValue([
      {
        academicYear: "2025-2026",
        term: 1,
        startDate: new Date("2025-06-01T00:00:00.000Z"),
        endDate: new Date("2025-09-30T00:00:00.000Z"),
      },
      {
        academicYear: "2025-2026",
        term: 2,
        startDate: new Date("2025-10-01T00:00:00.000Z"),
        endDate: new Date("2026-01-31T00:00:00.000Z"),
      },
    ]);

    prisma.holiday.findMany.mockResolvedValue([]);

    prisma.submission.findMany.mockResolvedValue([
      {
        id: 101,
        receivedDate: new Date("2025-06-12T00:00:00.000Z"),
        sequenceNumber: 1,
        status: SubmissionStatus.CLOSED,
        finalDecision: "APPROVED",
        finalDecisionDate: new Date("2025-06-20T00:00:00.000Z"),
        classification: { reviewType: ReviewType.EXPEDITED },
        project: {
          id: 1,
          piAffiliation: "College of Science",
          collegeOrUnit: "College of Science",
          proponentCategory: "UNDERGRAD",
          approvalStartDate: new Date("2025-06-20T00:00:00.000Z"),
          committee: { code: "RERC-HUMAN" },
        },
        statusHistory: [
          {
            newStatus: SubmissionStatus.UNDER_REVIEW,
            effectiveDate: new Date("2025-06-15T00:00:00.000Z"),
          },
          {
            newStatus: SubmissionStatus.CLOSED,
            effectiveDate: new Date("2025-06-20T00:00:00.000Z"),
          },
        ],
      },
      {
        id: 102,
        receivedDate: new Date("2025-10-10T00:00:00.000Z"),
        sequenceNumber: 1,
        status: SubmissionStatus.WITHDRAWN,
        finalDecision: null,
        finalDecisionDate: null,
        classification: { reviewType: ReviewType.FULL_BOARD },
        project: {
          id: 2,
          piAffiliation: "College of Science",
          collegeOrUnit: "College of Science",
          proponentCategory: "FACULTY",
          approvalStartDate: null,
          committee: { code: "RERC-HUMAN" },
        },
        statusHistory: [
          {
            newStatus: SubmissionStatus.UNDER_REVIEW,
            effectiveDate: new Date("2025-10-12T00:00:00.000Z"),
          },
          {
            newStatus: SubmissionStatus.WITHDRAWN,
            effectiveDate: new Date("2025-10-18T00:00:00.000Z"),
          },
        ],
      },
    ]);
  });

  it("returns expected shape and totals", async () => {
    const req: any = {
      query: {
        academicYear: "2025-2026",
        term: "ALL",
      },
    };
    const res = createResponseMock();

    await getAcademicYearSummaryHandler(req, res as any);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledTimes(1);

    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty("dateRange");
    expect(body).toHaveProperty("totals");
    expect(body).toHaveProperty("breakdownByCollegeOrUnit");
    expect(body).toHaveProperty("averages");

    expect(body.totals.received).toBe(2);
    expect(body.totals.withdrawn).toBe(1);
    expect(body.totals.expedited).toBe(1);
    expect(body.totals.fullReview).toBe(1);

    const breakdownTotal = body.breakdownByCollegeOrUnit.reduce(
      (sum: number, row: { received: number }) => sum + row.received,
      0
    );
    expect(breakdownTotal).toBe(body.totals.received);
  });
});
