import request from "supertest";
import app from "../../src/app";
import prismaClient from "../../src/config/prismaClient";

jest.mock("../../src/config/prismaClient", () => ({
  __esModule: true,
  default: {
    review: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/submissions/submissionService", () => {
  const actual = jest.requireActual("../../src/services/submissions/submissionService");
  return {
    __esModule: true,
    ...actual,
    classifySubmission: jest.fn(),
    updateSubmissionStatus: jest.fn(),
    recordReviewDecision: jest.fn(),
  };
});

const prisma = prismaClient as unknown as {
  review: {
    findUnique: jest.Mock;
  };
};

const submissionService = jest.requireMock("../../src/services/submissions/submissionService") as {
  classifySubmission: jest.Mock;
  updateSubmissionStatus: jest.Mock;
  recordReviewDecision: jest.Mock;
};

describe("submission RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("denies assistant when not assigned to the review", async () => {
    prisma.review.findUnique.mockResolvedValue({
      id: 50,
      reviewerId: 99,
      submissionId: 77,
    });

    const response = await request(app)
      .post("/reviews/50/decision")
      .set("X-User-ID", "44")
      .set("X-User-Roles", "RESEARCH_ASSISTANT")
      .send({ decision: "APPROVED", remarks: "ok" });

    expect(response.status).toBe(403);
    expect(submissionService.recordReviewDecision).not.toHaveBeenCalled();
  });

  it("allows assigned assistant and attributes actor", async () => {
    prisma.review.findUnique.mockResolvedValue({
      id: 50,
      reviewerId: 44,
      submissionId: 77,
    });
    submissionService.recordReviewDecision.mockResolvedValue({ id: 50, decision: "APPROVED" });

    const response = await request(app)
      .post("/reviews/50/decision")
      .set("X-User-ID", "44")
      .set("X-User-Roles", "RESEARCH_ASSISTANT")
      .send({ decision: "APPROVED", remarks: "ok" });

    expect(response.status).toBe(200);
    expect(submissionService.recordReviewDecision).toHaveBeenCalledWith(
      50,
      "APPROVED",
      44,
      "ok"
    );
  });

  it("denies assistant from changing workflow stage", async () => {
    const response = await request(app)
      .patch("/submissions/10/status")
      .set("X-User-ID", "44")
      .set("X-User-Roles", "RESEARCH_ASSISTANT")
      .send({ newStatus: "UNDER_CLASSIFICATION" });

    expect(response.status).toBe(403);
    expect(submissionService.updateSubmissionStatus).not.toHaveBeenCalled();
  });

  it("denies assistant from setting classification review track", async () => {
    const response = await request(app)
      .post("/submissions/10/classifications")
      .set("X-User-ID", "44")
      .set("X-User-Roles", "RESEARCH_ASSISTANT")
      .send({
        reviewType: "EXPEDITED",
        classificationDate: new Date().toISOString(),
      });

    expect(response.status).toBe(403);
    expect(submissionService.classifySubmission).not.toHaveBeenCalled();
  });
});
