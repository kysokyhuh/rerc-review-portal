import { SubmissionStatus, ReviewType } from "../../src/generated/prisma/client";
import prismaClient from "../../src/config/prismaClient";
import { classifySubmission, updateSubmissionStatus } from "../../src/services/submissions/submissionService";

jest.mock("../../src/config/prismaClient", () => ({
  __esModule: true,
  default: {
    submission: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
    submissionStatusHistory: {
      create: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit/auditService", () => ({
  __esModule: true,
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

const prisma = prismaClient as unknown as {
  submission: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
  submissionStatusHistory: {
    create: jest.Mock;
  };
};

describe("submission workflow rules", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("classifying a submission sets status to CLASSIFIED transactionally", async () => {
    prisma.submission.findUnique.mockResolvedValue({
      id: 101,
      status: SubmissionStatus.UNDER_CLASSIFICATION,
    });

    const tx = {
      classification: {
        upsert: jest.fn().mockResolvedValue({
          id: 88,
          submissionId: 101,
          reviewType: ReviewType.EXPEDITED,
        }),
      },
      submission: {
        update: jest.fn().mockResolvedValue({
          id: 101,
          status: SubmissionStatus.CLASSIFIED,
        }),
      },
      submissionStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 999 }),
      },
    };

    prisma.$transaction.mockImplementation(async (cb: (trx: typeof tx) => unknown) => cb(tx));

    await classifySubmission(
      101,
      {
        reviewType: ReviewType.EXPEDITED,
        classificationDate: new Date().toISOString(),
      },
      11
    );

    expect(tx.submission.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: { status: SubmissionStatus.CLASSIFIED },
    });
    expect(tx.submissionStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          submissionId: 101,
          newStatus: SubmissionStatus.CLASSIFIED,
          changedById: 11,
        }),
      })
    );
  });

  it("prevents backward workflow transitions", async () => {
    prisma.submission.findUnique.mockResolvedValue({
      status: SubmissionStatus.UNDER_CLASSIFICATION,
    });

    await expect(
      updateSubmissionStatus(
        101,
        SubmissionStatus.AWAITING_CLASSIFICATION,
        "rollback",
        11
      )
    ).rejects.toThrow(/only move forward/i);
  });
});
