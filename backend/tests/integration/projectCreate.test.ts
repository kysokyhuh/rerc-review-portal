import request from "supertest";
import app from "../../src/app";
import prismaClient from "../../src/config/prismaClient";

const txProjectCreate = jest.fn();
const txSubmissionCreate = jest.fn();
const txProtocolProfileCreate = jest.fn();

jest.mock("../../src/config/prismaClient", () => ({
  __esModule: true,
  default: {
    committee: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(async (callback: any) =>
      callback({
        project: { create: txProjectCreate },
        submission: { create: txSubmissionCreate },
        protocolProfile: { create: txProtocolProfileCreate },
      })
    ),
  },
}));

const prisma = prismaClient as unknown as {
  committee: { findFirst: jest.Mock; findMany: jest.Mock };
  project: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe("POST /projects", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    prisma.committee.findFirst.mockResolvedValue({ id: 10, code: "RERC-HUMAN" });
    prisma.project.findFirst.mockResolvedValue(null);
    txProjectCreate.mockResolvedValue({ id: 101 });
    txSubmissionCreate.mockResolvedValue({ id: 202 });
    txProtocolProfileCreate.mockResolvedValue({ id: 303 });
  });

  it("creates project + initial submission in one request", async () => {
    const response = await request(app)
      .post("/projects")
      .set("X-User-ID", "9")
      .set("X-User-Roles", "RESEARCH_ASSOCIATE")
      .send({
        projectCode: "  p-001  ",
        title: "New Protocol",
        piName: "Dr. Test",
        committeeCode: "rerc-human",
        submissionType: "INITIAL",
        receivedDate: "2026-02-09",
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ projectId: 101, submissionId: 202 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(txProjectCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectCode: "P-001",
          fundingType: null,
          createdById: 9,
        }),
      })
    );
    expect(txSubmissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 101,
          submissionType: "INITIAL",
          createdById: 9,
        }),
      })
    );
    expect(txProtocolProfileCreate).toHaveBeenCalled();
  });

  it("allows missing non-anchor fields and stores null for later backfill", async () => {
    const response = await request(app)
      .post("/projects")
      .set("X-User-ID", "9")
      .set("X-User-Roles", "RESEARCH_ASSOCIATE")
      .send({
        projectCode: "P-002",
        committeeCode: "RERC-HUMAN",
      });

    expect(response.status).toBe(201);
    expect(txProjectCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectCode: "P-002",
          title: null,
          piName: null,
          fundingType: null,
          initialSubmissionDate: null,
        }),
      })
    );
    expect(txSubmissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          submissionType: null,
          receivedDate: null,
        }),
      })
    );
  });

  it("rejects duplicate projectCode with 409 and existing projectId", async () => {
    prisma.project.findFirst.mockResolvedValue({ id: 777 });

    const response = await request(app)
      .post("/projects")
      .set("X-User-ID", "9")
      .set("X-User-Roles", "RESEARCH_ASSOCIATE")
      .send({
        projectCode: "P-001",
        title: "New Protocol",
        piName: "Dr. Test",
        committeeCode: "RERC-HUMAN",
        submissionType: "INITIAL",
        receivedDate: "2026-02-09",
      });

    expect(response.status).toBe(409);
    expect(response.body.projectId).toBe(777);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid enum/date", async () => {
    const response = await request(app)
      .post("/projects")
      .set("X-User-ID", "9")
      .set("X-User-Roles", "RESEARCH_ASSOCIATE")
      .send({
        projectCode: "P-001",
        title: "New Protocol",
        piName: "Dr. Test",
        committeeCode: "RERC-HUMAN",
        submissionType: "UNKNOWN",
        receivedDate: "2026-02-31",
      });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "submissionType" }),
      ])
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid receivedDate", async () => {
    const response = await request(app)
      .post("/projects")
      .set("X-User-ID", "9")
      .set("X-User-Roles", "RESEARCH_ASSOCIATE")
      .send({
        projectCode: "P-001",
        title: "New Protocol",
        piName: "Dr. Test",
        committeeCode: "RERC-HUMAN",
        submissionType: "INITIAL",
        receivedDate: "2026-02-31",
      });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "receivedDate" }),
      ])
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
