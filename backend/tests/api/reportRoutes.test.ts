import prismaClient from "../../src/config/prismaClient";
import {
  getAcademicYearSummaryHandler,
  getAcademicYearsHandler,
} from "../../src/routes/reportRoutes";
import { ReviewType, SubmissionStatus } from "../../src/generated/prisma/client";

jest.mock("../../src/config/prismaClient", () => ({
  __esModule: true,
  default: {
    academicTerm: {
      findMany: jest.fn(),
    },
    submission: {
      findMany: jest.fn(),
    },
    project: {
      update: jest.fn(),
    },
    submissionStatusHistory: {
      create: jest.fn(),
    },
    holiday: {
      findMany: jest.fn(),
    },
    configSLA: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(async (callback: any) =>
      callback({
        submission: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        project: {
          update: jest.fn().mockResolvedValue(null),
        },
        submissionStatusHistory: {
          create: jest.fn().mockResolvedValue(null),
        },
      })
    ),
  },
}));

const prisma = prismaClient as unknown as {
  academicTerm: { findMany: jest.Mock };
  submission: { findMany: jest.Mock };
  project: { update: jest.Mock };
  submissionStatusHistory: { create: jest.Mock };
  holiday: { findMany: jest.Mock };
  configSLA: { findMany: jest.Mock };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
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
    prisma.configSLA.findMany.mockResolvedValue([
      { committeeId: 10, stage: "COMPLETENESS", reviewType: null, workingDays: 1 },
      { committeeId: 10, stage: "CLASSIFICATION", reviewType: ReviewType.EXPEDITED, workingDays: 1 },
      { committeeId: 10, stage: "CLASSIFICATION", reviewType: ReviewType.FULL_BOARD, workingDays: 1 },
      { committeeId: 10, stage: "REVIEW", reviewType: ReviewType.EXPEDITED, workingDays: 20 },
      { committeeId: 10, stage: "REVIEW", reviewType: ReviewType.FULL_BOARD, workingDays: 30 },
      { committeeId: 10, stage: "REVISION_RESPONSE", reviewType: null, workingDays: 7 },
    ]);

    prisma.submission.findMany.mockResolvedValue([
      {
        id: 101,
        createdAt: new Date("2025-06-12T00:00:00.000Z"),
        receivedDate: new Date("2025-06-12T00:00:00.000Z"),
        sequenceNumber: 1,
        status: SubmissionStatus.CLOSED,
        resultsNotifiedAt: new Date("2025-06-20T00:00:00.000Z"),
        finalDecision: "APPROVED",
        finalDecisionDate: new Date("2025-06-20T00:00:00.000Z"),
        classification: {
          reviewType: ReviewType.EXPEDITED,
          classificationDate: new Date("2025-06-14T00:00:00.000Z"),
        },
        project: {
          id: 1,
          projectCode: "RERC-2025-001",
          title: "Protocol A",
          proponent: "Student Group",
          piName: "Student Group",
          piAffiliation: "College of Science",
          collegeOrUnit: "College of Science",
          department: "Biology",
          proponentCategory: "UNDERGRAD",
          committeeId: 10,
          approvalStartDate: new Date("2025-06-20T00:00:00.000Z"),
          protocolProfile: { typeOfReview: "Expedited" },
          committee: { code: "RERC-HUMAN", name: "RERC Human" },
        },
        statusHistory: [
          {
            newStatus: SubmissionStatus.UNDER_COMPLETENESS_CHECK,
            effectiveDate: new Date("2025-06-12T00:00:00.000Z"),
          },
          {
            newStatus: SubmissionStatus.AWAITING_CLASSIFICATION,
            effectiveDate: new Date("2025-06-13T00:00:00.000Z"),
          },
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
        createdAt: new Date("2025-10-10T00:00:00.000Z"),
        receivedDate: new Date("2025-10-10T00:00:00.000Z"),
        sequenceNumber: 1,
        status: SubmissionStatus.WITHDRAWN,
        resultsNotifiedAt: null,
        finalDecision: null,
        finalDecisionDate: null,
        classification: {
          reviewType: ReviewType.FULL_BOARD,
          classificationDate: new Date("2025-10-11T00:00:00.000Z"),
        },
        project: {
          id: 2,
          projectCode: "RERC-2025-002",
          title: "Protocol B",
          proponent: "Faculty Team",
          piName: "Faculty Team",
          piAffiliation: "College of Science",
          collegeOrUnit: "College of Science",
          department: "Chemistry",
          proponentCategory: "FACULTY",
          committeeId: 10,
          approvalStartDate: null,
          protocolProfile: { typeOfReview: "Full board" },
          committee: { code: "RERC-HUMAN", name: "RERC Human" },
        },
        statusHistory: [
          {
            newStatus: SubmissionStatus.UNDER_COMPLETENESS_CHECK,
            effectiveDate: new Date("2025-10-10T00:00:00.000Z"),
          },
          {
            newStatus: SubmissionStatus.AWAITING_CLASSIFICATION,
            effectiveDate: new Date("2025-10-10T12:00:00.000Z"),
          },
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

    prisma.$queryRaw.mockResolvedValue([
      {
        startDate: new Date("2025-06-12T00:00:00.000Z"),
        endDate: new Date("2025-10-10T00:00:00.000Z"),
      },
    ]);
  });

  it("returns academic-year options with fallback metadata", async () => {
    const res = createResponseMock();

    await getAcademicYearsHandler({} as any, res as any, jest.fn());

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      items: [
        {
          academicYear: "2025-2026",
          terms: [1, 2],
        },
      ],
      hasAcademicTerms: true,
      fallbackRange: {
        startDate: new Date("2025-06-12T00:00:00.000Z"),
        endDate: new Date("2025-10-10T00:00:00.000Z"),
      },
    });
  });

  it("returns expanded analytics and performance payloads", async () => {
    const req: any = {
      query: {
        ay: "2025-2026",
        term: "ALL",
      },
    };
    const res = createResponseMock();

    await getAcademicYearSummaryHandler(req, res as any, jest.fn());

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledTimes(1);

    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty("selection");
    expect(body).toHaveProperty("summaryCounts");
    expect(body).toHaveProperty("breakdownByCollege");
    expect(body).toHaveProperty("performanceCharts");
    expect(body.charts).toHaveProperty("receivedByMonth");
    expect(body.charts).toHaveProperty("reviewTypeByMonth");
    expect(body.charts).toHaveProperty("committeeDistribution");

    expect(body.summaryCounts.received).toBe(2);
    expect(body.summaryCounts.withdrawn).toBe(1);
    expect(body.summaryCounts.expedited).toBe(1);
    expect(body.summaryCounts.fullReview).toBe(1);
    expect(body.charts.receivedByMonth).toEqual([
      { label: "Jun", count: 1 },
      { label: "Jul", count: 0 },
      { label: "Aug", count: 0 },
      { label: "Sep", count: 0 },
      { label: "Oct", count: 1 },
      { label: "Nov", count: 0 },
      { label: "Dec", count: 0 },
      { label: "Jan", count: 0 },
    ]);
    expect(body.performanceCharts.averages.daysToResults[0].value).toBe(6);
    expect(body.performanceCharts.workflowFunnel[0]).toEqual({
      label: "Received",
      count: 2,
    });

    const breakdownTotal = body.breakdownByCollege.reduce(
      (sum: number, row: { received: number }) => sum + row.received,
      0
    );
    expect(breakdownTotal).toBe(body.summaryCounts.received);
  });
});
