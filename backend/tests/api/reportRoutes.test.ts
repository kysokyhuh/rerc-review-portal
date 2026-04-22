import prismaClient from "../../src/config/prismaClient";
import {
  getAcademicYearSummaryHandler,
  getReportSubmissionsHandler,
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
          panel: { name: "Panel 1", code: "P1" },
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
          protocolProfile: {
            dateOfSubmission: new Date("2025-06-12T00:00:00.000Z"),
            typeOfReview: "Expedited",
            status: null,
            finishDate: new Date("2025-06-20T00:00:00.000Z"),
            panel: "Panel 1",
          },
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
        reviews: [],
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
          panel: { name: "Panel 2", code: "P2" },
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
          protocolProfile: {
            dateOfSubmission: new Date("2025-10-10T00:00:00.000Z"),
            typeOfReview: "Full board",
            status: "Withdrawn",
            finishDate: null,
            panel: "Panel 2",
          },
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
        reviews: [],
      },
      {
        id: 103,
        createdAt: new Date("2026-04-13T00:00:00.000Z"),
        receivedDate: new Date("2025-09-15T00:00:00.000Z"),
        sequenceNumber: 1,
        status: SubmissionStatus.CLASSIFIED,
        resultsNotifiedAt: null,
        finalDecision: null,
        finalDecisionDate: null,
        classification: {
          reviewType: ReviewType.EXEMPT,
          classificationDate: new Date("2025-09-16T00:00:00.000Z"),
          panel: null,
        },
        project: {
          id: 3,
          projectCode: "RERC-2024-003",
          title: "Imported Protocol",
          proponent: "Faculty Team",
          piName: "Faculty Team",
          piAffiliation: "College of Science",
          collegeOrUnit: "College of Science",
          department: "Physics",
          proponentCategory: "FACULTY",
          committeeId: 10,
          origin: "LEGACY_IMPORT",
          approvalStartDate: null,
          protocolProfile: {
            dateOfSubmission: new Date("2025-09-15T00:00:00.000Z"),
            typeOfReview: "Exempt",
            status: "Exempted",
            finishDate: null,
            panel: null,
          },
          committee: { code: "RERC-HUMAN", name: "RERC Human" },
        },
        statusHistory: [
          {
            newStatus: SubmissionStatus.AWAITING_CLASSIFICATION,
            effectiveDate: new Date("2025-09-15T00:00:00.000Z"),
          },
          {
            newStatus: SubmissionStatus.CLASSIFIED,
            effectiveDate: new Date("2025-09-16T00:00:00.000Z"),
          },
        ],
        reviews: [],
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

    expect(body.summaryCounts.received).toBe(3);
    expect(body.summaryCounts.exempted).toBe(1);
    expect(body.summaryCounts.withdrawn).toBe(1);
    expect(body.summaryCounts.expedited).toBe(1);
    expect(body.summaryCounts.fullReview).toBe(1);
    expect(body.charts.receivedByMonth).toEqual([
      { label: "Jun", count: 1 },
      { label: "Jul", count: 0 },
      { label: "Aug", count: 0 },
      { label: "Sep", count: 1 },
      { label: "Oct", count: 1 },
      { label: "Nov", count: 0 },
      { label: "Dec", count: 0 },
      { label: "Jan", count: 0 },
    ]);
    expect(body.performanceCharts.averages.daysToResults[0].value).toBe(6);
    expect(body.performanceCharts.workflowFunnel[0]).toEqual({
      label: "Received",
      count: 3,
    });

    const breakdownTotal = body.breakdownByCollege.reduce(
      (sum: number, row: { received: number }) => sum + row.received,
      0
    );
    expect(breakdownTotal).toBe(body.summaryCounts.received);
  });

  it("filters report results by panel", async () => {
    const req: any = {
      query: {
        ay: "2025-2026",
        term: "ALL",
        panel: "Panel 1",
      },
    };
    const res = createResponseMock();

    await getAcademicYearSummaryHandler(req, res as any, jest.fn());

    const body = res.json.mock.calls[0][0];
    expect(body.selection.panel).toBe("Panel 1");
    expect(body.summaryCounts.received).toBe(1);
    expect(body.summaryCounts.expedited).toBe(1);
    expect(body.summaryCounts.fullReview).toBe(0);
  });

  it("uses imported review type and request status for unclassified imported rows", async () => {
    prisma.submission.findMany.mockResolvedValue([
      {
        id: 501,
        createdAt: new Date("2025-10-13T04:00:00.000Z"),
        receivedDate: new Date("2024-03-01T00:00:00.000Z"),
        sequenceNumber: 1,
        status: SubmissionStatus.WITHDRAWN,
        resultsNotifiedAt: null,
        finalDecision: null,
        finalDecisionDate: null,
        classification: {
          reviewType: ReviewType.EXPEDITED,
          classificationDate: new Date("2024-03-02T00:00:00.000Z"),
          panel: null,
        },
        project: {
          id: 50,
          projectCode: "RERC-LEG-001",
          title: "Imported Protocol",
          proponent: "Faculty Team",
          piName: "Dr. Example",
          piAffiliation: "College of Science",
          collegeOrUnit: "College of Science",
          department: "Biology",
          proponentCategory: "FACULTY",
          committeeId: 10,
          origin: "LEGACY_IMPORT",
          approvalStartDate: null,
          protocolProfile: {
            typeOfReview: "Expedited",
            status: "Under Review",
            classificationOfProposalRerc: null,
            college: "College of Science",
            department: "Biology",
            dateOfSubmission: new Date("2024-03-01T00:00:00.000Z"),
            proponent: "Faculty",
            finishDate: null,
            panel: "Panel 3",
          },
          committee: { code: "RERC-HUMAN", name: "RERC Human" },
        },
        statusHistory: [
          {
            newStatus: SubmissionStatus.AWAITING_CLASSIFICATION,
            effectiveDate: new Date("2024-03-01T00:00:00.000Z"),
          },
          {
            newStatus: SubmissionStatus.UNDER_REVIEW,
            effectiveDate: new Date("2024-03-03T00:00:00.000Z"),
          },
          {
            newStatus: SubmissionStatus.WITHDRAWN,
            effectiveDate: new Date("2024-03-04T00:00:00.000Z"),
          },
        ],
        reviews: [],
      },
    ]);

    const req: any = {
      query: {
        periodMode: "CUSTOM",
        startDate: "2024-03-01",
        endDate: "2024-03-31",
      },
    };
    const res = createResponseMock();

    await getAcademicYearSummaryHandler(req, res as any, jest.fn());

    const body = res.json.mock.calls[0][0];
    expect(body.summaryCounts.received).toBe(1);
    expect(body.summaryCounts.expedited).toBe(1);
    expect(body.summaryCounts.withdrawn).toBe(1);
  });

  it("groups imported rows by historical submission date for academic-year terms", async () => {
    prisma.academicTerm.findMany.mockResolvedValue([
      {
        academicYear: "2022-2023",
        term: 1,
        startDate: new Date("2022-09-01T00:00:00.000Z"),
        endDate: new Date("2022-12-31T00:00:00.000Z"),
      },
      {
        academicYear: "2022-2023",
        term: 2,
        startDate: new Date("2023-01-01T00:00:00.000Z"),
        endDate: new Date("2023-04-30T00:00:00.000Z"),
      },
      {
        academicYear: "2022-2023",
        term: 3,
        startDate: new Date("2023-05-01T00:00:00.000Z"),
        endDate: new Date("2023-08-31T00:00:00.000Z"),
      },
    ]);

    prisma.submission.findMany.mockResolvedValue([
      {
        id: 601,
        createdAt: new Date("2026-04-14T00:00:00.000Z"),
        receivedDate: new Date("2023-02-13T00:00:00.000Z"),
        sequenceNumber: 1,
        status: SubmissionStatus.CLASSIFIED,
        resultsNotifiedAt: null,
        finalDecision: null,
        finalDecisionDate: null,
        classification: {
          reviewType: ReviewType.EXPEDITED,
          classificationDate: new Date("2023-02-14T00:00:00.000Z"),
          panel: null,
        },
        project: {
          id: 60,
          projectCode: "RERC-LEG-TERM",
          title: "Historical Imported Protocol",
          proponent: "Faculty Team",
          piName: "Dr. Example",
          piAffiliation: "College of Science",
          collegeOrUnit: "College of Science",
          department: "Biology",
          proponentCategory: "FACULTY",
          committeeId: 10,
          origin: "LEGACY_IMPORT",
          approvalStartDate: null,
          protocolProfile: {
            typeOfReview: "Expedited",
            status: "Classified",
            classificationOfProposalRerc: null,
            college: "College of Science",
            department: "Biology",
            dateOfSubmission: new Date("2023-02-13T00:00:00.000Z"),
            proponent: "Faculty",
            finishDate: null,
            panel: "Panel 3",
          },
          committee: { code: "RERC-HUMAN", name: "RERC Human" },
        },
        statusHistory: [
          {
            newStatus: SubmissionStatus.AWAITING_CLASSIFICATION,
            effectiveDate: new Date("2023-02-13T00:00:00.000Z"),
          },
          {
            newStatus: SubmissionStatus.CLASSIFIED,
            effectiveDate: new Date("2023-02-14T00:00:00.000Z"),
          },
        ],
        reviews: [],
      },
    ]);

    const req: any = {
      query: {
        ay: "2022-2023",
        term: "ALL",
      },
    };
    const res = createResponseMock();

    await getAcademicYearSummaryHandler(req, res as any, jest.fn());

    const body = res.json.mock.calls[0][0];
    expect(body.summaryCounts.received).toBe(1);
    expect(body.overviewTable.rows).toEqual([
      { label: "Term 1", received: 0, exempted: 0, expedited: 0, fullReview: 0, withdrawn: 0 },
      { label: "Term 2", received: 1, exempted: 0, expedited: 1, fullReview: 0, withdrawn: 0 },
      { label: "Term 3", received: 0, exempted: 0, expedited: 0, fullReview: 0, withdrawn: 0 },
    ]);
  });

  it("returns historical receivedDate for imported rows in report records", async () => {
    prisma.academicTerm.findMany.mockResolvedValue([
      {
        academicYear: "2022-2023",
        term: 2,
        startDate: new Date("2023-01-01T00:00:00.000Z"),
        endDate: new Date("2023-04-30T00:00:00.000Z"),
      },
    ]);

    prisma.submission.findMany.mockResolvedValue([
      {
        id: 701,
        createdAt: new Date("2026-04-14T00:00:00.000Z"),
        receivedDate: new Date("2023-03-22T00:00:00.000Z"),
        sequenceNumber: 1,
        status: SubmissionStatus.CLASSIFIED,
        resultsNotifiedAt: null,
        finalDecision: null,
        finalDecisionDate: null,
        classification: {
          reviewType: ReviewType.EXEMPT,
          classificationDate: new Date("2023-03-23T00:00:00.000Z"),
          panel: null,
        },
        project: {
          id: 70,
          projectCode: "RERC-LEG-REC",
          title: "Imported Records Row",
          proponent: "Faculty Team",
          piName: "Dr. Example",
          piAffiliation: "College of Science",
          collegeOrUnit: "College of Science",
          department: "Biology",
          proponentCategory: "FACULTY",
          committeeId: 10,
          origin: "LEGACY_IMPORT",
          approvalStartDate: null,
          protocolProfile: {
            typeOfReview: "Exempt",
            status: "Classified",
            classificationOfProposalRerc: null,
            college: "College of Science",
            department: "Biology",
            dateOfSubmission: new Date("2023-03-22T00:00:00.000Z"),
            proponent: "Faculty",
            finishDate: null,
            panel: "Panel 4",
          },
          committee: { code: "RERC-HUMAN", name: "RERC Human" },
        },
        statusHistory: [
          {
            newStatus: SubmissionStatus.AWAITING_CLASSIFICATION,
            effectiveDate: new Date("2023-03-22T00:00:00.000Z"),
          },
          {
            newStatus: SubmissionStatus.CLASSIFIED,
            effectiveDate: new Date("2023-03-23T00:00:00.000Z"),
          },
        ],
        reviews: [],
      },
    ]);

    const req: any = {
      query: {
        periodMode: "CUSTOM",
        startDate: "2023-03-01",
        endDate: "2023-03-31",
        sort: "receivedDate:asc",
      },
    };
    const res = createResponseMock();

    await getReportSubmissionsHandler(req, res as any, jest.fn());

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      totalCount: 1,
      page: 1,
      pageSize: 20,
      items: [
        expect.objectContaining({
          submissionId: 701,
          projectCode: "RERC-LEG-REC",
          receivedDate: new Date("2023-03-22T00:00:00.000Z"),
          panel: "Panel 4",
        }),
      ],
    });
  });
});
