import request from "supertest";
import app from "../../src/app";
import prismaClient from "../../src/config/prismaClient";

jest.mock("../../src/config/prismaClient", () => ({
  __esModule: true,
  default: {
    review: {
      findUnique: jest.fn(),
    },
    submission: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/submissions/submissionService", () => {
  const actual = jest.requireActual("../../src/services/submissions/submissionService");
  return {
    __esModule: true,
    ...actual,
    assignProtocolAssistant: jest.fn(),
    bulkAssignReviewerToSubmissions: jest.fn(),
    bulkAssignProtocolAssistant: jest.fn(),
    bulkCreateSubmissionReminders: jest.fn(),
    bulkRunSubmissionStatusAction: jest.fn(),
    classifySubmission: jest.fn(),
    listAssistantCandidates: jest.fn(),
    listReviewerCandidates: jest.fn(),
    startSubmissionReview: jest.fn(),
    updateSubmissionStatus: jest.fn(),
    recordReviewDecision: jest.fn(),
  };
});

jest.mock("../../src/utils/projectSoftDelete", () => ({
  __esModule: true,
  hasProjectSoftDeleteColumns: jest.fn().mockResolvedValue(true),
}));

const prisma = prismaClient as unknown as {
  review: {
    findUnique: jest.Mock;
  };
  submission: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
  };
};

const submissionService = jest.requireMock("../../src/services/submissions/submissionService") as {
  assignProtocolAssistant: jest.Mock;
  bulkAssignReviewerToSubmissions: jest.Mock;
  bulkAssignProtocolAssistant: jest.Mock;
  bulkCreateSubmissionReminders: jest.Mock;
  bulkRunSubmissionStatusAction: jest.Mock;
  classifySubmission: jest.Mock;
  listAssistantCandidates: jest.Mock;
  listReviewerCandidates: jest.Mock;
  startSubmissionReview: jest.Mock;
  updateSubmissionStatus: jest.Mock;
  recordReviewDecision: jest.Mock;
};

describe("submission RBAC", () => {
  const csrfHeaders = {
    Origin: "http://localhost:5173",
    Cookie: "csrfToken=test-csrf",
    "X-CSRF-Token": "test-csrf",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.submission.findFirst.mockResolvedValue(null);
    prisma.submission.findUnique.mockResolvedValue({
      project: {
        deletedAt: null,
        purgedAt: null,
      },
    });
  });

  it("denies assistant when not assigned to the review", async () => {
    prisma.review.findUnique.mockResolvedValue({
      id: 50,
      reviewerId: 99,
      submissionId: 77,
    });

    const response = await request(app)
      .post("/reviews/50/decision")
      .set(csrfHeaders)
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
      .set(csrfHeaders)
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

  it("denies unassigned assistant from changing workflow stage", async () => {
    const response = await request(app)
      .patch("/submissions/10/status")
      .set(csrfHeaders)
      .set("X-User-ID", "44")
      .set("X-User-Roles", "RESEARCH_ASSISTANT")
      .send({ newStatus: "UNDER_CLASSIFICATION" });

    expect(response.status).toBe(403);
    expect(submissionService.updateSubmissionStatus).not.toHaveBeenCalled();
  });

  it("allows assigned protocol assistant to start eligible review workflow", async () => {
    prisma.submission.findFirst.mockResolvedValue({ id: 10 });
    submissionService.startSubmissionReview.mockResolvedValue({
      id: 10,
      status: "UNDER_REVIEW",
    });

    const response = await request(app)
      .post("/submissions/10/start-review")
      .set(csrfHeaders)
      .set("X-User-ID", "44")
      .set("X-User-Roles", "RESEARCH_ASSISTANT")
      .send({});

    expect(response.status).toBe(200);
    expect(submissionService.startSubmissionReview).toHaveBeenCalledWith(10, 44);
  });

  it("denies assigned protocol assistant from changing classification-stage status", async () => {
    prisma.submission.findFirst.mockResolvedValue({ id: 10 });

    const response = await request(app)
      .patch("/submissions/10/status")
      .set(csrfHeaders)
      .set("X-User-ID", "44")
      .set("X-User-Roles", "RESEARCH_ASSISTANT")
      .send({ newStatus: "UNDER_CLASSIFICATION" });

    expect(response.status).toBe(403);
    expect(submissionService.updateSubmissionStatus).not.toHaveBeenCalled();
  });

  it("denies assistant from setting classification review track", async () => {
    const response = await request(app)
      .post("/submissions/10/classifications")
      .set(csrfHeaders)
      .set("X-User-ID", "44")
      .set("X-User-Roles", "RESEARCH_ASSISTANT")
      .send({
        reviewType: "EXPEDITED",
        classificationDate: new Date().toISOString(),
      });

    expect(response.status).toBe(403);
    expect(submissionService.classifySubmission).not.toHaveBeenCalled();
  });

  it("denies assistant from fetching reviewer candidates", async () => {
    const response = await request(app)
      .get("/submissions/reviewer-candidates")
      .set(csrfHeaders)
      .set("X-User-ID", "44")
      .set("X-User-Roles", "RESEARCH_ASSISTANT");

    expect(response.status).toBe(403);
    expect(submissionService.listReviewerCandidates).not.toHaveBeenCalled();
  });

  it("denies assistant from fetching protocol assistant candidates", async () => {
    const response = await request(app)
      .get("/submissions/assistant-candidates")
      .set(csrfHeaders)
      .set("X-User-ID", "44")
      .set("X-User-Roles", "RESEARCH_ASSISTANT");

    expect(response.status).toBe(403);
    expect(submissionService.listAssistantCandidates).not.toHaveBeenCalled();
  });

  it("allows chair to assign a protocol assistant", async () => {
    submissionService.assignProtocolAssistant.mockResolvedValue({
      id: 10,
      staffInChargeId: 44,
    });

    const response = await request(app)
      .post("/submissions/10/assistant-assignment")
      .set(csrfHeaders)
      .set("X-User-ID", "7")
      .set("X-User-Roles", "CHAIR")
      .send({ assistantId: 44 });

    expect(response.status).toBe(200);
    expect(submissionService.assignProtocolAssistant).toHaveBeenCalledWith(10, 44, 7);
  });

  it("denies assistant from bulk assigning reviewers", async () => {
    const response = await request(app)
      .post("/submissions/bulk/assign-reviewer")
      .set(csrfHeaders)
      .set("X-User-ID", "44")
      .set("X-User-Roles", "RESEARCH_ASSISTANT")
      .send({
        submissionIds: [10, 11],
        reviewerId: 7,
        reviewerRole: "SCIENTIST",
      });

    expect(response.status).toBe(403);
    expect(submissionService.bulkAssignReviewerToSubmissions).not.toHaveBeenCalled();
  });

  it("denies assistant from bulk assigning protocol assistants", async () => {
    const response = await request(app)
      .post("/submissions/bulk/assign-assistant")
      .set(csrfHeaders)
      .set("X-User-ID", "44")
      .set("X-User-Roles", "RESEARCH_ASSISTANT")
      .send({
        submissionIds: [10, 11],
        assistantId: 7,
      });

    expect(response.status).toBe(403);
    expect(submissionService.bulkAssignProtocolAssistant).not.toHaveBeenCalled();
  });

  it("denies assistant from bulk changing status", async () => {
    const response = await request(app)
      .post("/submissions/bulk/status-action")
      .set(csrfHeaders)
      .set("X-User-ID", "44")
      .set("X-User-Roles", "RESEARCH_ASSISTANT")
      .send({
        submissionIds: [10, 11],
        action: "MOVE_TO_UNDER_CLASSIFICATION",
      });

    expect(response.status).toBe(403);
    expect(submissionService.bulkRunSubmissionStatusAction).not.toHaveBeenCalled();
  });

  it("denies assistant from bulk logging reminders", async () => {
    const response = await request(app)
      .post("/submissions/bulk/reminders")
      .set(csrfHeaders)
      .set("X-User-ID", "44")
      .set("X-User-Roles", "RESEARCH_ASSISTANT")
      .send({
        submissionIds: [10],
        target: "REVIEWER",
        note: "Follow up",
      });

    expect(response.status).toBe(403);
    expect(submissionService.bulkCreateSubmissionReminders).not.toHaveBeenCalled();
  });

  it("blocks submission mutation when parent project is deleted", async () => {
    prisma.submission.findUnique.mockResolvedValue({
      project: {
        deletedAt: new Date().toISOString(),
        purgedAt: null,
      },
    });

    const response = await request(app)
      .patch("/submissions/10/status")
      .set(csrfHeaders)
      .set("X-User-ID", "7")
      .set("X-User-Roles", "CHAIR")
      .send({ newStatus: "UNDER_CLASSIFICATION" });

    expect(response.status).toBe(409);
    expect(submissionService.updateSubmissionStatus).not.toHaveBeenCalled();
  });
});
