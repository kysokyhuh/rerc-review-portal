import request from "supertest";
import app from "../../src/app";
import prismaClient from "../../src/config/prismaClient";

jest.mock("../../src/config/prismaClient", () => ({
  __esModule: true,
  default: {
    user: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit/auditService", () => ({
  __esModule: true,
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

const prisma = prismaClient as unknown as {
  user: {
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

describe("admin user routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /admin/users/pending allows chair", async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 101,
        fullName: "Pending User",
        email: "pending@urerb.com",
        status: "PENDING",
        roles: [],
        createdAt: new Date(),
      },
    ]);

    const response = await request(app)
      .get("/admin/users/pending")
      .set("X-User-ID", "1")
      .set("X-User-Roles", "CHAIR");

    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(1);
  });

  it("POST /admin/users/:id/approve forbids non-chair", async () => {
    const response = await request(app)
      .post("/admin/users/101/approve")
      .set("X-User-ID", "2")
      .set("X-User-Roles", "RESEARCH_ASSOCIATE")
      .send({ roles: ["RESEARCH_ASSISTANT"] });

    expect(response.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
